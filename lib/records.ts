import { admin, must } from "./db";
import type { Quote } from "./counterparties";
import type { Recoverable } from "./decisions/recoverable";
import type { SeverityDecision } from "./decisions/severity";
import type { FaultEvent } from "./types";
import type { Unit } from "./units";

// Stand-in for writing to the fleet's maintenance system / TMS.
export async function writeRecords(
  incidentId: string,
  p: { fault: FaultEvent; unit: Unit; severity: SeverityDecision; tow: boolean; recov: Recoverable; best: Quote; autoApproved: boolean },
): Promise<{ repairOrder: boolean; claimLine: boolean }> {
  const { fault, unit, severity, tow, recov, best, autoApproved } = p;
  const rows: { incident_id: string; type: string; payload: unknown }[] = [
    {
      incident_id: incidentId,
      type: "repair_order",
      payload: {
        unit: unit.truck.unit_number,
        odometer: unit.truck.odometer_miles,
        shop: best.shop.name,
        shop_id: best.shop.id,
        fault: { category: fault.category, spn: fault.spn, fmi: fault.fmi, description: fault.description, location: fault.location },
        severity: severity.severity,
        tow,
        estimate_usd: best.total,
        labor_hours: best.laborHours,
        load_id: unit.load?.id ?? null,
        status: autoApproved ? "scheduled" : "pending_approval",
      },
    },
  ];
  if (recov.recoverable) {
    rows.push({
      incident_id: incidentId,
      type: "claim_line",
      payload: {
        unit: unit.truck.unit_number,
        component: recov.component,
        amount_usd: best.total,
        basis: recov.reason,
        status: "pending_approval",
      },
    });
  }
  must(await admin().from("records").insert(rows));
  return { repairOrder: true, claimLine: recov.recoverable };
}
