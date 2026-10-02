import { milepostToLatLng } from "../geo";
import type { Category, FaultEvent } from "../types";

// Driver text message. There are no J1939 codes, so classify by keyword and pull the
// location out of the text ("I-80 E near MP 284"), geocoding the milepost along I-80.
type DriverPayload = {
  receivedAt?: string;
  driver?: { name?: string };
  unitNumber?: string;
  message?: string;
};

const KEYWORDS: [RegExp, Category][] = [
  [/brake/i, "brakes"],
  [/oil/i, "oil_pressure"],
  [/coolant|overheat|temp/i, "coolant_temp"],
  [/\b(dpf|regen|aftertreatment)\b/i, "dpf"],
  [/tire|tyre|psi|flat|blowout/i, "tire_pressure"],
];

export function adaptDriver(raw: unknown): FaultEvent {
  const p = raw as DriverPayload;
  const text = p.message?.trim();
  if (!p.unitNumber || !text) throw new Error("driver payload missing unitNumber or message");

  const category = KEYWORDS.find(([re]) => re.test(text))?.[1] ?? "other";
  const where = text.match(/(I-\d+)\s*([EW])?\b[^.]*?\bMP\s*(\d+)/i);
  const mp = where ? Number(where[3]) : null;
  const pos = mp != null ? milepostToLatLng(mp) : milepostToLatLng(272); // no location given: assume mid-Nebraska
  const location = where ? `${where[1].toUpperCase()} ${(where[2] ?? "").toUpperCase()}, MP ${mp}`.replace("  ", " ") : "Location not given";

  return {
    source: "driver",
    unitNumber: String(p.unitNumber),
    category,
    spn: null,
    fmi: null,
    description: text,
    location,
    lat: pos.lat,
    lng: pos.lng,
    occurredAt: p.receivedAt ?? new Date().toISOString(),
    driverName: p.driver?.name,
  };
}
