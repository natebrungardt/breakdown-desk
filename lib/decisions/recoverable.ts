import { recordDecision } from "./record";
import type { Category, FaultEvent } from "../types";
import type { Coverage, Unit } from "../units";

export const componentFor = (c: Category): string | null =>
  ({ oil_pressure: "engine", coolant_temp: "engine", dpf: "aftertreatment", tire_pressure: "tires" } as Record<string, string>)[c] ?? null;

export type Recoverable = { component: string | null; recoverable: boolean; coverage: Coverage | null; reason: string };

// Is the failed component still under warranty (mileage and age)?
export async function decideRecoverable(incidentId: string, fault: FaultEvent, unit: Unit): Promise<Recoverable> {
  const component = componentFor(fault.category);
  const coverage = component ? (unit.coverage.find((c) => c.component === component) ?? null) : null;
  const k = (n: number) => `${Math.round(n / 1000)}k`;

  const reason = !component || !coverage
    ? "No warranty policy covers this component"
    : `${k(coverage.miles)} mi / ${coverage.months} mo vs ${k(coverage.maxMiles)} mi / ${coverage.maxMonths} mo limit`;
  const out: Recoverable = { component, recoverable: !!coverage?.covered, coverage, reason };

  await recordDecision({
    incidentId,
    name: "recoverable",
    output: { component, recoverable: out.recoverable },
    source: "rule",
    reason,
    inputs: { component, coverage },
  });
  return out;
}
