import type { Candidate, Shop } from "./decisions/shopSet";
import { sleep } from "./events";
import type { Category } from "./types";

// Mock shops: each one "answers" after a short random delay, all in parallel.
export type Quote = {
  shop: Shop;
  distanceMiles: number;
  oemPreferred: boolean;
  etaHours: number; // tow or drive time to the shop
  laborHours: number;
  total: number; // USD, labor + parts estimate
  slot: string; // earliest bay
};

const BASE_HOURS: Record<string, number> = { oil_pressure: 9, coolant_temp: 6, dpf: 5, tire_pressure: 1.5, brakes: 4, other: 4 };
const BASE_PARTS: Record<string, number> = { oil_pressure: 4200, coolant_temp: 1800, dpf: 2600, tire_pressure: 480, brakes: 900, other: 700 };
const jitter = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const round = (n: number, step: number) => Math.round(n / step) * step;

async function quoteFrom(c: Candidate, category: Category, tow: boolean): Promise<Quote> {
  await sleep(jitter(250, 1100));
  const laborHours = round(BASE_HOURS[category] * jitter(0.85, 1.25), 0.5);
  const parts = BASE_PARTS[category] * jitter(0.9, 1.2);
  const etaHours = round(c.distanceMiles / (tow ? 35 : 55) + (tow ? 1 : 0), 0.25);
  return {
    shop: c.shop,
    distanceMiles: c.distanceMiles,
    oemPreferred: c.oemPreferred,
    etaHours,
    laborHours,
    total: round(laborHours * c.shop.labor_rate + parts, 10),
    slot: `${Math.max(1, Math.round(etaHours + jitter(0, 6)))}h after arrival`,
  };
}

// Request quotes from every candidate in parallel; onQuote fires as each one arrives.
export async function requestQuotes(
  candidates: Candidate[],
  category: Category,
  tow: boolean,
  onQuote?: (q: Quote) => Promise<void> | void,
): Promise<Quote[]> {
  return Promise.all(
    candidates.map(async (c) => {
      const q = await quoteFrom(c, category, tow);
      await onQuote?.(q);
      return q;
    }),
  );
}

// OEM-preferred (under warranty) first, then soonest to arrive, then cheapest.
export function rankQuotes(quotes: Quote[]): Quote[] {
  return [...quotes].sort(
    (a, b) => Number(b.oemPreferred) - Number(a.oemPreferred) || a.etaHours - b.etaHours || a.total - b.total,
  );
}
