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

// Whole words only, most specific first: "boiling" must not match oil, "attempt" must not
// match temp, "flatbed" must not match flat. Coolant goes before oil so "coolant is boiling
// over" or "oil and coolant mixing" land on the engine-temperature rule.
const KEYWORDS: [RegExp, Category][] = [
  [/\bbrak(e|es|ing)\b/i, "brakes"],
  [/\b(coolant|antifreeze|radiator|overheat(s|ing|ed)?|temp|temperature)\b/i, "coolant_temp"],
  [/\boil\b/i, "oil_pressure"],
  [/\b(dpf|regen|aftertreatment)\b/i, "dpf"],
  [/\b(tires?|tyres?|psi|flat tire|blowout|blew a tire)\b/i, "tire_pressure"],
];

export function adaptDriver(raw: unknown): FaultEvent {
  const p = raw as DriverPayload;
  const text = p.message?.trim();
  if (!p.unitNumber || !text) throw new Error("driver payload missing unitNumber or message");

  const category = KEYWORDS.find(([re]) => re.test(text))?.[1] ?? "other";
  const where = text.match(/(I-\d+)\s*([EW])?\b[^.]*?\bMP\s*(\d+)/i);
  const mp = where ? Number(where[3]) : null;
  // No milepost: leave the position unknown. The pipeline stops before picking shops and
  // asks dispatch to confirm where the truck is, rather than guessing a spot.
  const pos = mp != null ? milepostToLatLng(mp) : null;
  const location = where ? `${where[1].toUpperCase()} ${(where[2] ?? "").toUpperCase()}, MP ${mp}`.replace("  ", " ") : "Location not given";

  return {
    source: "driver",
    unitNumber: String(p.unitNumber),
    category,
    spn: null,
    fmi: null,
    description: text,
    location,
    lat: pos?.lat ?? null,
    lng: pos?.lng ?? null,
    occurredAt: p.receivedAt ?? new Date().toISOString(),
    driverName: p.driver?.name,
  };
}
