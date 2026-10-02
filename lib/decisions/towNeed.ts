import { recordDecision } from "./record";
import type { Severity } from "../types";

// stop_now => the truck must not move => tow needed.
export async function decideTow(incidentId: string, severity: Severity): Promise<boolean> {
  const tow = severity === "stop_now";
  await recordDecision({
    incidentId,
    name: "tow_need",
    output: { tow },
    source: "rule",
    reason: tow ? "stop_now means the truck cannot be driven" : `${severity} means the truck can be driven`,
    inputs: { severity },
  });
  return tow;
}
