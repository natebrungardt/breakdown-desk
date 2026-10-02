import { categoryForSpn } from "./spn";
import type { FaultEvent } from "../types";

// Samsara vehicle fault webhook (simplified): J1939 fields live under data.fault.j1939,
// the vehicle name is the unit number.
type SamsaraPayload = {
  eventTime?: string;
  data?: {
    vehicle?: { id?: string; name?: string };
    fault?: { j1939?: { spn?: number; fmi?: number; description?: string } };
    location?: { latitude?: number; longitude?: number; address?: string };
  };
};

export function adaptSamsara(raw: unknown): FaultEvent {
  const p = raw as SamsaraPayload;
  const unit = p.data?.vehicle?.name;
  const j = p.data?.fault?.j1939;
  const loc = p.data?.location;
  if (!unit || j?.spn == null || j.fmi == null || loc?.latitude == null || loc?.longitude == null) {
    throw new Error("samsara payload missing vehicle.name, fault.j1939.spn/fmi or location");
  }
  return {
    source: "samsara",
    unitNumber: String(unit),
    category: categoryForSpn(j.spn),
    spn: j.spn,
    fmi: j.fmi,
    description: j.description ?? `SPN ${j.spn} / FMI ${j.fmi}`,
    location: loc.address ?? `${loc.latitude.toFixed(3)}, ${loc.longitude.toFixed(3)}`,
    lat: loc.latitude,
    lng: loc.longitude,
    occurredAt: p.eventTime ?? new Date().toISOString(),
  };
}
