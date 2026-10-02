import OpenAI from "openai";
import type { FaultEvent, Severity } from "./types";

// The only file that talks to an AI provider. Used ONLY for severity triage of
// ambiguous faults; everything else in the pipeline is rules and templates.

export type TriageInput = {
  fault: FaultEvent;
  truck: { make: string; model: string; year: number; odometer_miles: number };
  load: { customer: string; hoursToDeadline: number } | null;
  floor: Severity; // the minimum severity the rules already set
};

export type TriageResult = { severity: Severity; confidence: number; reason: string };

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const SYSTEM = `You triage heavy-truck fault alerts for a fleet maintenance desk.
Classify the fault into exactly one severity:
- stop_now: unsafe or likely to destroy the component if the truck keeps moving. Tow it.
- limp_to_shop: the truck can be driven, carefully and directly, to a repair shop now.
- schedule_later: safe to keep running; book a repair at a convenient stop.
Domain notes:
- J1939 FMI: 0/1 = most severe, 16/18 = moderately severe, 15/17 = least severe.
- An active DPF differential-pressure fault at moderately severe or worse means a clogged filter that will soon force an engine derate; the truck should go to a shop now (limp_to_shop), not wait for a convenient stop.
- A slow tire leak on a truck that is still rolling normally is schedule_later; a rapid loss, blowout or damaged tire is not.
You are given a minimum severity ("floor") set by hard rules. Never answer below the floor.
Report your confidence from 0 to 1 (use lower values when the information is thin or contradictory) and a one-sentence reason a dispatcher can read.`;

const SCHEMA = {
  type: "object",
  properties: {
    severity: { type: "string", enum: ["stop_now", "limp_to_shop", "schedule_later"] },
    confidence: { type: "number" },
    reason: { type: "string" },
  },
  required: ["severity", "confidence", "reason"],
  additionalProperties: false,
} as const;

export async function triage(input: TriageInput): Promise<TriageResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
  const client = new OpenAI({ timeout: 20_000, maxRetries: 1 });
  const { fault, truck, load, floor } = input;

  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: JSON.stringify({
          source: fault.source,
          fault: {
            category: fault.category,
            spn: fault.spn,
            fmi: fault.fmi,
            description: fault.description,
            location: fault.location,
          },
          truck,
          load,
          floor,
        }),
      },
    ],
    response_format: { type: "json_schema", json_schema: { name: "severity_triage", strict: true, schema: SCHEMA } },
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("LLM returned no content");
  const out = JSON.parse(text) as TriageResult;
  if (!["stop_now", "limp_to_shop", "schedule_later"].includes(out.severity)) throw new Error("LLM returned an invalid severity");
  return { severity: out.severity, confidence: Math.min(1, Math.max(0, out.confidence)), reason: out.reason };
}
