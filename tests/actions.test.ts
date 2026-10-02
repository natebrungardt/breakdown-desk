import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SeverityDecision } from "../lib/decisions/severity";

// Capture the action rows instead of inserting them; echo them back as the database would.
let inserted: Record<string, unknown>[] = [];
vi.mock("../lib/db", () => ({
  admin: () => ({
    from: () => ({
      insert: (rows: Record<string, unknown>[]) => {
        inserted = rows;
        return { select: async () => ({ data: rows.map((r, i) => ({ id: `a${i}`, ...r })), error: null }) };
      },
    }),
  }),
  must: (res: { data: unknown }) => res.data,
}));
vi.mock("../lib/decisions/record", () => ({ recordDecision: vi.fn() }));

const { draftActions } = await import("../lib/actions");

type Args = Parameters<typeof draftActions>[1];

const base = {
  fault: { category: "tire_pressure", spn: null, fmi: null, description: "slow leak", location: "I-80 E, MP 284" },
  unit: {
    truck: { unit_number: "4590", year: 2023, make: "Peterbilt", model: "579", odometer_miles: 276340, in_service_date: "2023-01-01" },
    load: null,
    hoursToDeadline: null,
    coverage: [],
  },
  tow: false,
  recov: { component: "tires", recoverable: true, coverage: null, reason: "in warranty" },
  best: {
    shop: { name: "Kearney Tire & Wheel", city: "Kearney", state: "NE" },
    distanceMiles: 13,
    etaHours: 0.25,
    laborHours: 1.5,
    total: 680,
    slot: "today 14:00",
  },
} as unknown as Omit<Args, "severity">;

const severity = (s: SeverityDecision["severity"], needsApproval: boolean) =>
  ({ severity: s, needsApproval, confidence: needsApproval ? 0.6 : 0.9 }) as SeverityDecision;

const statusOf = () => Object.fromEntries(inserted.map((r) => [r.type, r.status]));

beforeEach(() => {
  inserted = [];
});

describe("draftActions approval", () => {
  it("auto-approves booking and SMS for a confident schedule_later, never the warranty claim", async () => {
    await draftActions("inc-1", { ...base, severity: severity("schedule_later", false) });
    expect(statusOf()).toEqual({ shop_booking: "approved", driver_sms: "approved", warranty_claim: "pending" });
  });

  it.each([
    ["schedule_later needing approval", severity("schedule_later", true)],
    ["limp_to_shop", severity("limp_to_shop", false)],
    ["stop_now", severity("stop_now", true)],
  ])("leaves everything pending for %s", async (_label, sev) => {
    await draftActions("inc-1", { ...base, severity: sev });
    expect(Object.values(statusOf())).toEqual(["pending", "pending", "pending"]);
  });
});
