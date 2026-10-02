import { admin, must } from "./db";
import { draftActions } from "./actions";
import { rankQuotes, requestQuotes } from "./counterparties";
import { recordDecision } from "./decisions/record";
import { decideRecoverable } from "./decisions/recoverable";
import { decideSeverity } from "./decisions/severity";
import { decideShopSet } from "./decisions/shopSet";
import { decideTow } from "./decisions/towNeed";
import { emit, step } from "./events";
import { writeRecords } from "./records";
import { resolveUnit } from "./units";
import type { FaultEvent, Source } from "./types";

// Runs the six layers in order: Signals -> Units -> Decisions -> Counterparties -> Actions -> Records.
// Every step emits an event (the live feed) and every decision is written to the audit trail.

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
  const db = admin();
  try {
    // 1. Signals
    await step(
      incidentId,
      "signals",
      "live",
      `Signal received from ${fault.source}. Normalized to ${
        fault.spn != null ? `SPN ${fault.spn} / FMI ${fault.fmi}` : "a driver report"
      } (${fault.category.replace("_", " ")}), ${fault.location}.`,
    );

    // 2. Units
    const unit = await resolveUnit(fault.unitNumber);
    if (!unit) {
      await emit(incidentId, "units", "review", `Unit ${fault.unitNumber} not found in the fleet. Stopping.`);
      await db.from("incidents").update({ status: "error" }).eq("id", incidentId);
      return;
    }
    const { truck, load } = unit;
    await db.from("incidents").update({ truck_id: truck.id }).eq("id", incidentId);
    await step(
      incidentId,
      "units",
      "live",
      `Unit ${truck.unit_number} resolved. ${truck.make} ${truck.model} ${truck.year}, ${truck.odometer_miles.toLocaleString("en-US")} mi.` +
        (load ? ` Load ${load.id} for ${load.customer} due in ${unit.hoursToDeadline}h.` : " No active load."),
    );

    // 3. Decisions
    const severity = await decideSeverity(
      incidentId,
      fault,
      { truck, load: load ? { customer: load.customer, hoursToDeadline: unit.hoursToDeadline ?? 0 } : null },
      (floor) => step(incidentId, "decisions", "routing", `Rules set floor: ${floor}. Asking LLM to triage.`),
    );
    await db.from("incidents").update({ severity: severity.severity }).eq("id", incidentId);
    await step(
      incidentId,
      "decisions",
      severity.needsApproval ? "review" : "live",
      `Severity ${severity.severity.toUpperCase()} (${severity.source}). ${severity.reason}` +
        (severity.needsApproval ? " Flagged for approval." : ""),
    );

    const tow = await decideTow(incidentId, severity.severity);
    await step(incidentId, "decisions", tow ? "review" : "live", tow ? "Tow required." : "Tow not needed. Truck can be driven.");

    const recov = await decideRecoverable(incidentId, fault, unit);
    await step(
      incidentId,
      "decisions",
      "live",
      recov.component
        ? `${recov.component} ${recov.recoverable ? "under warranty" : "out of warranty"} (${recov.reason}). ${
            recov.recoverable ? "Claim recoverable." : "No claim."
          }`
        : recov.reason,
    );

    const candidates = await decideShopSet(incidentId, fault, unit, tow, recov.recoverable);
    if (candidates.length === 0) {
      await emit(incidentId, "decisions", "review", "No capable shop found along the route. Escalate to dispatch.");
      await db.from("incidents").update({ status: "error" }).eq("id", incidentId);
      return;
    }

    // 4. Counterparties
    await step(
      incidentId,
      "counterparties",
      "routing",
      `Requesting quotes from ${candidates.length} capable shops.` + (recov.recoverable ? ` ${truck.make} dealer preferred under warranty.` : ""),
    );
    const quotes = await requestQuotes(candidates, fault.category, tow, (q) =>
      emit(
        incidentId,
        "counterparties",
        "live",
        `Quote from ${q.shop.name} (${q.shop.city}): $${q.total.toLocaleString("en-US")}, ${q.etaHours}h to arrive, ${q.distanceMiles} mi.`,
      ),
    );
    const best = rankQuotes(quotes)[0];
    await recordDecision({
      incidentId,
      name: "shop_selection",
      output: { shop_id: best.shop.id, shop: best.shop.name, total: best.total, etaHours: best.etaHours },
      source: "rule",
      reason: best.oemPreferred
        ? `${best.shop.name} is the ${truck.make} dealer and the repair is under warranty`
        : "Soonest to arrive, then cheapest",
      inputs: { quotes: quotes.map((q) => ({ shop: q.shop.name, total: q.total, etaHours: q.etaHours, oem: q.oemPreferred })) },
    });
    await step(incidentId, "counterparties", "booked", `${quotes.length} quotes received. ${best.shop.name} (${best.shop.city}) ranked first.`);

    // 5. Actions
    const actions = await draftActions(incidentId, { fault, unit, severity, tow, recov, best });
    const pending = actions.filter((a) => a.status === "pending").length;
    await step(
      incidentId,
      "actions",
      pending ? "review" : "booked",
      pending
        ? `Drafted ${actions.length} actions (${actions.map((a) => a.type.replace("_", " ")).join(", ")}). ${pending} pending approval.`
        : `Shop booking and driver SMS auto-approved.`,
    );

    // 6. Records
    await writeRecords(incidentId, { fault, unit, severity, tow, recov, best, autoApproved: pending === 0 });
    await db.from("incidents").update({ status: "complete" }).eq("id", incidentId);
    await emit(
      incidentId,
      "records",
      "filed",
      `Repair order${recov.recoverable ? " and claim line" : ""} written. Audit trail saved.`,
    );
  } catch (err) {
    console.error("pipeline failed", incidentId, err);
    await db.from("incidents").update({ status: "error" }).eq("id", incidentId);
    await emit(incidentId, "records", "review", `Pipeline error: ${(err as Error).message}`).catch(() => {});
  }
}
