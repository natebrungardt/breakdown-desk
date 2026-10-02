import { admin, must } from "./db";
import { step } from "./events";
import type { FaultEvent, Source } from "./types";

// STEP 1 skeleton: all six layers run in order with ~400ms pauses and emit events.
// Layer logic is filled in by the following steps (adapters, severity, units, ...).

export async function createIncident(source: Source, payload: unknown, fault: FaultEvent): Promise<string> {
  const row = must(
    await admin()
      .from("incidents")
      .insert({
        source,
        raw_payload: payload,
        spn: fault.spn,
        fmi: fault.fmi,
        description: fault.description,
        location: fault.location,
        lat: fault.lat,
        lng: fault.lng,
      })
      .select("id")
      .single(),
  );
  return row.id as string;
}

export async function runPipeline(incidentId: string, fault: FaultEvent) {
  try {
    await step(incidentId, "signals", "live", `Signal received from ${fault.source}. Normalized to ${fault.spn != null ? `SPN ${fault.spn} / FMI ${fault.fmi}` : "a driver report"} (${fault.category.replace("_", " ")}), ${fault.location}.`);
    await step(incidentId, "units", "live", "Resolving unit, load and warranty coverage.");
    await step(incidentId, "decisions", "routing", "Deciding severity, tow, warranty recovery and shop set.");
    await step(incidentId, "counterparties", "routing", "Requesting quotes from shops.");
    await step(incidentId, "actions", "review", "Drafting actions.");
    await admin().from("incidents").update({ status: "complete" }).eq("id", incidentId);
    await step(incidentId, "records", "filed", "Records written.");
  } catch (err) {
    await admin().from("incidents").update({ status: "error" }).eq("id", incidentId);
    console.error("pipeline failed", incidentId, err);
  }
}
