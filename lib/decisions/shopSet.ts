import { admin, must } from "../db";
import { haversineMiles } from "../geo";
import { recordDecision } from "./record";
import type { FaultEvent } from "../types";
import type { Unit } from "../units";

export type Shop = {
  id: string;
  name: string;
  type: "oem_dealer" | "independent" | "tire";
  oem_make: string | null;
  city: string;
  state: string;
  lat: number;
  lng: number;
  capabilities: string[];
  in_network: boolean;
  labor_rate: number;
};
export type Candidate = { shop: Shop; distanceMiles: number; oemPreferred: boolean };

const CAPABILITY: Record<string, string> = {
  oil_pressure: "engine",
  coolant_temp: "engine",
  dpf: "aftertreatment",
  tire_pressure: "tires",
  brakes: "brakes",
};
export const capabilityFor = (c: string) => CAPABILITY[c] ?? "engine";

// Filter shops by capability (plus towing if a tow is needed), rank by straight-line
// distance, and put the truck's OEM dealer first when the repair is under warranty.
export async function decideShopSet(
  incidentId: string,
  fault: FaultEvent & { lat: number; lng: number }, // the pipeline stops earlier when location is unknown
  unit: Unit,
  tow: boolean,
  underWarranty: boolean,
  limit = 3,
): Promise<Candidate[]> {
  const shops = must(await admin().from("shops").select("*")) as Shop[];
  const need = [capabilityFor(fault.category), ...(tow ? ["towing"] : [])];

  const capable = shops
    .filter((s) => need.every((n) => s.capabilities.includes(n)))
    .map((shop) => ({
      shop,
      distanceMiles: Math.round(haversineMiles(fault.lat, fault.lng, shop.lat, shop.lng)),
      oemPreferred: underWarranty && shop.type === "oem_dealer" && shop.oem_make === unit.truck.make,
    }));
  capable.sort((a, b) => Number(b.oemPreferred) - Number(a.oemPreferred) || a.distanceMiles - b.distanceMiles);
  const picked = capable.slice(0, limit);

  await recordDecision({
    incidentId,
    name: "shop_set",
    output: { shops: picked.map((c) => ({ id: c.shop.id, name: c.shop.name, distanceMiles: c.distanceMiles })) },
    source: "rule",
    reason: underWarranty
      ? `Capable shops (${need.join(" + ")}), ${unit.truck.make} dealer preferred under warranty, then nearest`
      : `Capable shops (${need.join(" + ")}), nearest first`,
    inputs: { need, underWarranty, make: unit.truck.make, from: { lat: fault.lat, lng: fault.lng }, capableCount: capable.length },
  });
  return picked;
}
