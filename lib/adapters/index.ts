import { adaptDriver } from "./driver";
import { adaptGeotab } from "./geotab";
import { adaptSamsara } from "./samsara";
import type { FaultEvent, Source } from "../types";

export function adapt(source: Source, payload: unknown): FaultEvent {
  switch (source) {
    case "geotab":
      return adaptGeotab(payload);
    case "samsara":
      return adaptSamsara(payload);
    case "driver":
      return adaptDriver(payload);
  }
}
