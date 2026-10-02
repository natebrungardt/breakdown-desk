import { triage, type TriageInput, type TriageResult } from "../llm";
import { recordDecision } from "./record";
import type { DecisionSource, FaultEvent, Severity } from "../types";

// The most important file. Order of operations:
//  1. Hard rules run first and win for clear safety cases => stop_now, source "rule", LLM not called.
//  2. For anything else the rules set a minimum FLOOR; the LLM classifies it.
//     Final = the more severe of floor and LLM. The LLM can escalate, never downgrade.
//  3. Low confidence (< 0.7) or stop_now => the decision needs human approval.
//  4. The decision row records its source.

const RANK: Record<Severity, number> = { schedule_later: 0, limp_to_shop: 1, stop_now: 2 };
const moreSevere = (a: Severity, b: Severity): Severity => (RANK[a] >= RANK[b] ? a : b);

export const CONFIDENCE_THRESHOLD = 0.7;

type Rule = { floor: Severity; hard: boolean; reason: string };

export function applyRules(f: FaultEvent): Rule {
  switch (f.category) {
    case "oil_pressure":
      if (f.fmi === 1) return { floor: "stop_now", hard: true, reason: "Critical oil pressure (FMI 1)" };
      return { floor: "limp_to_shop", hard: false, reason: "Oil pressure fault below critical" };
    case "coolant_temp":
      if (f.fmi === 0) return { floor: "stop_now", hard: true, reason: "Severe coolant temperature (FMI 0)" };
      return { floor: "limp_to_shop", hard: false, reason: "Elevated coolant temperature" };
    case "brakes":
      return { floor: "stop_now", hard: true, reason: "Brake failure" };
    case "tire_pressure":
      if (f.fmi === 1) return { floor: "limp_to_shop", hard: false, reason: "Tire pressure critically low" };
      return { floor: "schedule_later", hard: false, reason: "Tire pressure fault" };
    case "dpf":
      return { floor: "schedule_later", hard: false, reason: "Aftertreatment fault" };
    default:
      return { floor: "schedule_later", hard: false, reason: "Unclassified fault" };
  }
}

export type SeverityDecision = {
  severity: Severity;
  floor: Severity;
  source: DecisionSource;
  confidence: number;
  needsApproval: boolean;
  reason: string;
  llm: TriageResult | null;
  llmError?: string;
};

export async function decideSeverity(
  incidentId: string,
  fault: FaultEvent,
  context: Pick<TriageInput, "truck" | "load">,
  onLlmCall?: (floor: Severity) => Promise<void>,
): Promise<SeverityDecision> {
  const rule = applyRules(fault);
  let d: SeverityDecision;

  if (rule.hard) {
    d = {
      severity: rule.floor,
      floor: rule.floor,
      source: "rule",
      confidence: 1,
      needsApproval: true, // stop_now always needs approval
      reason: `${rule.reason}. Hard rule, LLM not called.`,
      llm: null,
    };
  } else {
    await onLlmCall?.(rule.floor);
    try {
      const llm = await triage({ fault, truck: context.truck, load: context.load, floor: rule.floor });
      const severity = moreSevere(rule.floor, llm.severity);
      const escalated = RANK[llm.severity] > RANK[rule.floor];
      const heldByFloor = RANK[rule.floor] > RANK[llm.severity];
      d = {
        severity,
        floor: rule.floor,
        source: heldByFloor ? "rule" : "llm",
        confidence: llm.confidence,
        needsApproval: llm.confidence < CONFIDENCE_THRESHOLD || severity === "stop_now",
        reason: `${llm.reason} (confidence ${llm.confidence.toFixed(2)}${
          escalated ? `, escalated from floor ${rule.floor}` : heldByFloor ? `, LLM said ${llm.severity} but floor ${rule.floor} holds` : ""
        })`,
        llm,
      };
    } catch (err) {
      // LLM unavailable: fall back to the rule floor and ask a human, rather than guessing.
      const msg = (err as Error).message;
      d = {
        severity: rule.floor,
        floor: rule.floor,
        source: "rule",
        confidence: 0,
        needsApproval: true,
        reason: `${rule.reason}. LLM unavailable (${msg}); using rule floor.`,
        llm: null,
        llmError: msg,
      };
    }
  }

  await recordDecision({
    incidentId,
    name: "severity",
    output: { severity: d.severity },
    source: d.source,
    reason: d.reason,
    inputs: {
      fault: { category: fault.category, spn: fault.spn, fmi: fault.fmi, description: fault.description },
      floor: d.floor,
      llm: d.llm,
      confidence: d.confidence,
      llmError: d.llmError,
    },
    needsApproval: d.needsApproval,
  });
  return d;
}
