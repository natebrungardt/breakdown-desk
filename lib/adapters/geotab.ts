import { categoryForSpn } from "./spn";
import type { FaultEvent } from "../types";

// Geotab fault data: the diagnostic code carries the SPN, failureMode.code the FMI,
// and the device name is the fleet's unit number.
type GeotabPayload = {
  device?: { id?: string; name?: string };
  diagnostic?: { code?: number; name?: string };
  failureMode?: { code?: number; name?: string };
  dateTime?: string;
  location?: { x?: number; y?: number; address?: string };
};

export function adaptGeotab(raw: unknown): FaultEvent {
  const p = raw as GeotabPayload;
  const unit = p.device?.name;
  const spn = p.diagnostic?.code;
  const fmi = p.failureMode?.code;
  const loc = p.location;
  if (!unit || spn == null || fmi == null || loc?.x == null || loc?.y == null) {
    throw new Error("geotab payload missing device.name, diagnostic.code, failureMode.code or location");
  }
  return {
    source: "geotab",
    unitNumber: String(unit),
    category: categoryForSpn(spn),
    spn,
    fmi,
    description: `${p.diagnostic?.name ?? `SPN ${spn}`}: ${p.failureMode?.name ?? `FMI ${fmi}`}`,
    location: loc.address ?? `${loc.y.toFixed(3)}, ${loc.x.toFixed(3)}`,
    lat: loc.y,
    lng: loc.x,
    occurredAt: p.dateTime ?? new Date().toISOString(),
  };
}
