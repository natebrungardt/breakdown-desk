import { admin, must } from "./db";

export type Truck = {
  id: string;
  unit_number: string;
  make: string;
  model: string;
  year: number;
  odometer_miles: number;
  in_service_date: string;
};
export type Load = { id: string; customer: string; origin: string; destination: string; delivery_deadline: string };
export type Coverage = {
  component: string;
  covered: boolean;
  miles: number;
  months: number;
  maxMiles: number;
  maxMonths: number;
};
export type Unit = { truck: Truck; load: Load | null; hoursToDeadline: number | null; coverage: Coverage[] };

// Seed deadlines are "now + N hours" at seed time, so they go stale. These are the original
// offsets, used to re-base a load's deadline (here when it has lapsed, and on Reset).
export const LOAD_HOURS: Record<string, number> = {
  L9001: 9, L9002: 14, L9003: 11, L9004: 20, L9005: 16, L9006: 18, L9007: 26, L9008: 22, L9009: 13, L9010: 8,
};

export async function rebaseLoadDeadlines() {
  const now = Date.now();
  await Promise.all(
    Object.entries(LOAD_HOURS).map(([id, h]) =>
      admin().from("loads").update({ delivery_deadline: new Date(now + h * 36e5).toISOString() }).eq("id", id),
    ),
  );
}

function monthsBetween(from: string, to: Date): number {
  const d = new Date(from);
  let m = (to.getFullYear() - d.getFullYear()) * 12 + (to.getMonth() - d.getMonth());
  if (to.getDate() < d.getDate()) m -= 1;
  return Math.max(0, m);
}

// Resolve the truck from the unit number in the signal, its current load, and its
// warranty coverage per component (mileage and age against each policy).
export async function resolveUnit(unitNumber: string): Promise<Unit | null> {
  const db = admin();
  const truck = must(await db.from("trucks").select("*").eq("unit_number", unitNumber).maybeSingle()) as Truck | null;
  if (!truck) return null;
  let load = (must(await db.from("loads").select("*").eq("truck_id", truck.id).maybeSingle()) as Load | null) ?? null;
  if (load && LOAD_HOURS[load.id] && new Date(load.delivery_deadline).getTime() < Date.now()) {
    const deadline = new Date(Date.now() + LOAD_HOURS[load.id] * 36e5).toISOString();
    await db.from("loads").update({ delivery_deadline: deadline }).eq("id", load.id);
    load = { ...load, delivery_deadline: deadline };
  }
  const policies = must(await db.from("warranty_policies").select("*"));

  const now = new Date();
  const months = monthsBetween(truck.in_service_date, now);
  const coverage: Coverage[] = policies.map((p: { component: string; max_miles: number; max_months: number }) => ({
    component: p.component,
    covered: truck.odometer_miles <= p.max_miles && months <= p.max_months,
    miles: truck.odometer_miles,
    months,
    maxMiles: p.max_miles,
    maxMonths: p.max_months,
  }));
  const hoursToDeadline = load ? Math.round(((new Date(load.delivery_deadline).getTime() - now.getTime()) / 36e5) * 10) / 10 : null;
  return { truck, load, hoursToDeadline, coverage };
}
