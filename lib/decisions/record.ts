import { admin, must } from "../db";
import type { DecisionSource } from "../types";

// Every decision, from every layer, goes through here: this table is the audit trail.
export async function recordDecision(d: {
  incidentId: string;
  name: string;
  output: unknown;
  source: DecisionSource;
  reason: string;
  inputs: unknown;
  needsApproval?: boolean;
}) {
  must(
    await admin().from("decisions").insert({
      incident_id: d.incidentId,
      name: d.name,
      output: d.output,
      source: d.source,
      reason: d.reason,
      inputs: d.inputs,
      needs_approval: d.needsApproval ?? false,
    }),
  );
}
