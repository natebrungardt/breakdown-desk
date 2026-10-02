import { admin, must } from "./db";
import type { FeedEvent, IncidentView } from "./types";

const ACTION_LABEL: Record<string, string> = {
  shop_booking: "Shop booking",
  driver_sms: "Driver SMS",
  warranty_claim: "Warranty claim",
};
const RECORD_LABEL: Record<string, string> = { repair_order: "Repair order", claim_line: "Claim line" };
const AUDIT_LABEL: Record<string, string> = {
  severity: "Severity",
  tow_need: "Tow",
  recoverable: "Recoverable",
  location: "Location",
  shop_set: "Shop set",
  quote_accept: "Shop",
  action_approval: "Approval",
};

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function auditValue(d: Row): string {
  const o = d.output ?? {};
  switch (d.name) {
    case "severity":
      return o.severity;
    case "tow_need":
      return o.tow ? "required" : "not needed";
    case "recoverable":
      return o.component ? `${o.component}, ${o.recoverable ? "in warranty" : "out of warranty"}` : "no policy";
    case "location":
      return o.known ? "known" : "unknown, call driver";
    case "shop_set":
      return `${o.shops?.length ?? 0} shops`;
    case "quote_accept":
      return o.shop;
    case "action_approval":
      return o.auto_approved ? `auto-approved: ${o.auto_approved.join(", ")}` : `${String(o.type).replace("_", " ")} approved`;
    default:
      return JSON.stringify(o);
  }
}

// Everything the incident panel and layer bar need, read with the service key
// (the browser's anon key can only read incident_events).
export async function buildIncidentView(incidentId: string): Promise<{ view: IncidentView; events: FeedEvent[] } | null> {
  const db = admin();
  const incident = must(await db.from("incidents").select("*").eq("id", incidentId).maybeSingle()) as Row | null;
  if (!incident) return null;

  const [truck, decisions, actions, records, events] = await Promise.all([
    incident.truck_id ? db.from("trucks").select("*").eq("id", incident.truck_id).maybeSingle().then(must) : Promise.resolve(null),
    db.from("decisions").select("*").eq("incident_id", incidentId).order("created_at").then(must),
    db.from("actions").select("*").eq("incident_id", incidentId).order("created_at").then(must),
    db.from("records").select("*").eq("incident_id", incidentId).order("created_at").then(must),
    db.from("incident_events").select("*").eq("incident_id", incidentId).order("id").then(must),
  ]);
  const load = truck ? ((await db.from("loads").select("*").eq("truck_id", truck.id).maybeSingle()).data as Row | null) : null;
  const recov = (decisions as Row[]).find((d) => d.name === "recoverable");

  const summary: IncidentView["summary"] = [];
  if (truck) {
    summary.push({
      k: "Truck",
      v: `Unit ${truck.unit_number} · ${truck.make} ${truck.model} ${truck.year}`,
      pill: recov?.output?.component ? `${recov.output.component} ${recov.output.recoverable ? "in" : "out of"} warranty` : undefined,
    });
  }
  summary.push({
    k: "Fault",
    v: incident.spn != null ? `SPN ${incident.spn} / FMI ${incident.fmi} · ${incident.description}` : String(incident.description),
    pill: incident.source,
  });
  if (incident.location) summary.push({ k: "Where", v: incident.location });
  if (load) {
    const hours = Math.round(((new Date(load.delivery_deadline).getTime() - Date.now()) / 36e5) * 10) / 10;
    summary.push({ k: "Load", v: `${load.customer} · due in ${hours}h` });
  }

  return {
    events: events as FeedEvent[],
    view: {
      status: incident.status,
      summary,
      audit: (decisions as Row[]).map((d) => ({
        k: AUDIT_LABEL[d.name] ?? d.name,
        v: auditValue(d),
        reason: d.reason ?? "",
        source: d.source,
        needsApproval: d.needs_approval,
      })),
      actions: (actions as Row[]).map((a) => ({
        id: a.id,
        text: `${ACTION_LABEL[a.type] ?? a.type} · ${a.recipient}`,
        detail: a.body,
        approved: a.status === "approved",
      })),
      records: (records as Row[]).map((r) => ({
        k: RECORD_LABEL[r.type] ?? r.type,
        v:
          r.type === "repair_order"
            ? `${r.payload.shop} · $${Number(r.payload.estimate_usd).toLocaleString("en-US")} · ${String(r.payload.status).replace("_", " ")}`
            : `${r.payload.component} · $${Number(r.payload.amount_usd).toLocaleString("en-US")} · ${String(r.payload.status).replace("_", " ")}`,
      })),
    },
  };
}
