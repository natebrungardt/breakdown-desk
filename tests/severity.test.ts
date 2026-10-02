import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Category, FaultEvent } from "../lib/types";

// No database and no OpenAI: the LLM is replaced by a stub each test controls,
// and audit-trail writes are captured instead of inserted.
vi.mock("../lib/llm", () => ({ triage: vi.fn() }));
vi.mock("../lib/decisions/record", () => ({ recordDecision: vi.fn() }));

const { triage } = await import("../lib/llm");
const { recordDecision } = await import("../lib/decisions/record");
const { applyRules, decideSeverity } = await import("../lib/decisions/severity");

const fault = (category: Category, fmi: number | null = null): FaultEvent => ({
  source: "samsara",
  unitNumber: "3847",
  category,
  spn: null,
  fmi,
  description: "test fault",
  location: "I-80 W, MP 213",
  lat: 40.9,
  lng: -100.2,
  occurredAt: "2026-10-02T03:02:16Z",
});

const context = {
  truck: { unit_number: "3847", make: "Freightliner", model: "Cascadia", year: 2024, odometer_miles: 148230 },
  load: null,
} as unknown as Parameters<typeof decideSeverity>[2];

const llmSays = (severity: "stop_now" | "limp_to_shop" | "schedule_later", confidence: number) =>
  vi.mocked(triage).mockResolvedValue({ severity, confidence, reason: "stubbed LLM" });

beforeEach(() => vi.clearAllMocks());

describe("applyRules", () => {
  it.each([
    ["oil_pressure", 1, "stop_now", true],
    ["oil_pressure", 18, "limp_to_shop", false],
    ["coolant_temp", 0, "stop_now", true],
    ["coolant_temp", 16, "limp_to_shop", false],
    ["brakes", null, "stop_now", true],
    ["tire_pressure", 1, "limp_to_shop", false],
    ["tire_pressure", 18, "schedule_later", false],
    ["dpf", 16, "schedule_later", false],
    ["other", null, "limp_to_shop", false], // unknown faults never get the weakest floor
  ] as const)("%s (FMI %s) -> floor %s, hard %s", (category, fmi, floor, hard) => {
    const rule = applyRules(fault(category, fmi));
    expect(rule.floor).toBe(floor);
    expect(rule.hard).toBe(hard);
  });
});

describe("decideSeverity", () => {
  it("hard rule wins without calling the LLM and needs approval", async () => {
    const d = await decideSeverity("inc-1", fault("oil_pressure", 1), context);
    expect(triage).not.toHaveBeenCalled();
    expect(d).toMatchObject({ severity: "stop_now", source: "rule", needsApproval: true });
  });

  it("LLM cannot downgrade below the rule floor", async () => {
    llmSays("schedule_later", 0.95);
    const d = await decideSeverity("inc-1", fault("oil_pressure", 18), context);
    expect(d.severity).toBe("limp_to_shop");
    expect(d.source).toBe("rule");
    expect(d.reason).toContain("floor limp_to_shop holds");
  });

  it("LLM can escalate above the floor", async () => {
    llmSays("limp_to_shop", 0.9);
    const d = await decideSeverity("inc-1", fault("dpf", 16), context);
    expect(d).toMatchObject({ severity: "limp_to_shop", source: "llm", needsApproval: false });
  });

  it("LLM escalation to stop_now needs approval", async () => {
    llmSays("stop_now", 0.95);
    const d = await decideSeverity("inc-1", fault("other"), context);
    expect(d).toMatchObject({ severity: "stop_now", needsApproval: true });
  });

  it("confidence below 0.7 needs approval", async () => {
    llmSays("schedule_later", 0.6);
    const d = await decideSeverity("inc-1", fault("tire_pressure", 18), context);
    expect(d).toMatchObject({ severity: "schedule_later", needsApproval: true });
  });

  it("confident schedule_later does not need approval", async () => {
    llmSays("schedule_later", 0.9);
    const d = await decideSeverity("inc-1", fault("tire_pressure", 18), context);
    expect(d).toMatchObject({ severity: "schedule_later", needsApproval: false });
  });

  it("unclassified fault stays at limp_to_shop even if the LLM is confident it can wait", async () => {
    llmSays("schedule_later", 0.95);
    const d = await decideSeverity("inc-1", fault("other"), context);
    expect(d.severity).toBe("limp_to_shop");
  });

  it("LLM failure falls back to the rule floor and asks a human", async () => {
    vi.mocked(triage).mockRejectedValue(new Error("timeout"));
    const d = await decideSeverity("inc-1", fault("dpf", 16), context);
    expect(d).toMatchObject({ severity: "schedule_later", source: "rule", needsApproval: true, llmError: "timeout" });
  });

  it("writes every decision to the audit trail with its source", async () => {
    llmSays("limp_to_shop", 0.9);
    await decideSeverity("inc-1", fault("dpf", 16), context);
    expect(recordDecision).toHaveBeenCalledWith(
      expect.objectContaining({ incidentId: "inc-1", name: "severity", source: "llm", output: { severity: "limp_to_shop" } }),
    );
  });
});
