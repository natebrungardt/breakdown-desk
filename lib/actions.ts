import { admin, must } from "./db";
import { recordDecision } from "./decisions/record";
import type { Quote } from "./counterparties";
import type { Recoverable } from "./decisions/recoverable";
import type { SeverityDecision } from "./decisions/severity";
import type { FaultEvent } from "./types";
import type { Unit } from "./units";

export type ActionRow = { id: string; type: string; recipient: string; body: string; status: "pending" | "approved" };

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

// Template-drafted (no LLM): shop booking, driver SMS, warranty claim.
export async function draftActions(
  incidentId: string,
  p: { fault: FaultEvent; unit: Unit; severity: SeverityDecision; tow: boolean; recov: Recoverable; best: Quote },
): Promise<ActionRow[]> {
  const { fault, unit, severity, tow, recov, best } = p;
  const { truck, load } = unit;
  const unitLabel = `Unit ${truck.unit_number} (${truck.year} ${truck.make} ${truck.model})`;
  const shopLabel = `${best.shop.name}, ${best.shop.city} ${best.shop.state}`;
  const issue = fault.category.replace("_", " ");

  const drafts: Omit<ActionRow, "id" | "status">[] = [
    {
      type: "shop_booking",
      recipient: best.shop.name,
      body:
        `${tow ? "Tow and shop" : "Shop"} booking request. ${unitLabel}, ${truck.odometer_miles.toLocaleString("en-US")} mi. ` +
        `Fault: ${issue} (${fault.spn != null ? `SPN ${fault.spn}/FMI ${fault.fmi}` : "driver report"}) at ${fault.location}. ` +
        `${tow ? "Tow required. " : ""}Estimate ${money(best.total)}, ${best.laborHours}h labor. ` +
        `Earliest bay ${best.slot}.${load ? ` Load for ${load.customer} due in ${unit.hoursToDeadline}h.` : ""}`,
    },
    {
      type: "driver_sms",
      recipient: `Driver, Unit ${truck.unit_number}`,
      body: tow
        ? `STOP the truck now at a safe spot. Do not drive it. A tow to ${shopLabel} is being arranged, ETA about ${best.etaHours}h. Dispatch will call you.`
        : severity.severity === "limp_to_shop"
          ? `Drive carefully and directly to ${shopLabel}, about ${best.distanceMiles} mi (${best.etaHours}h). Avoid heavy load or hard acceleration. Dispatch has booked you in.`
          : `You're booked at ${shopLabel}, about ${best.distanceMiles} mi away, for ${best.slot}. Keep an eye on the gauge and call dispatch if it gets worse.`,
    },
  ];
  if (recov.recoverable && recov.component) {
    drafts.push({
      type: "warranty_claim",
      recipient: `${truck.make} warranty`,
      body:
        `Warranty claim, ${recov.component}. ${unitLabel}, ${truck.odometer_miles.toLocaleString("en-US")} mi, in service ${truck.in_service_date}. ` +
        `Failure: ${fault.description} at ${fault.location}. Repair at ${best.shop.name}, estimate ${money(best.total)}.`,
    });
  }

  // Shop booking and driver SMS go out automatically only for a confident schedule_later.
  // Warranty claims always wait for a person.
  const auto = severity.severity === "schedule_later" && !severity.needsApproval;
  const rows = drafts.map((d) => ({
    incident_id: incidentId,
    ...d,
    status: auto && d.type !== "warranty_claim" ? "approved" : "pending",
    approved_at: auto && d.type !== "warranty_claim" ? new Date().toISOString() : null,
  }));
  const saved = must(await admin().from("actions").insert(rows).select("id, type, recipient, body, status")) as ActionRow[];

  if (auto) {
    await recordDecision({
      incidentId,
      name: "action_approval",
      output: { auto_approved: saved.filter((a) => a.status === "approved").map((a) => a.type) },
      source: "rule",
      reason: `schedule_later with confidence ${severity.confidence.toFixed(2)} (>= 0.7): booking and SMS auto-approved; warranty claims still need a person`,
      inputs: { severity: severity.severity, confidence: severity.confidence },
    });
  }
  return saved;
}
