import type { Source } from "./types";

// Mock vendor payloads for the three demo scenarios. The shapes follow the vendors'
// fault-event structure (simplified); the adapters in lib/adapters parse them for real.
// Ids match the scenarios in mockScenarios.ts.

export type ScenarioPayload = { id: string; source: Source; payload: unknown };

export function buildPayload(id: string): ScenarioPayload | null {
  const now = new Date().toISOString();
  switch (id) {
    case "oil":
      return {
        id,
        source: "geotab",
        payload: {
          device: { id: "b2A1", name: "3847" },
          diagnostic: { id: "DiagnosticEngineOilPressureId", code: 100, name: "Engine oil pressure" },
          failureMode: { code: 1, name: "Data valid but below normal operational range - most severe level" },
          faultState: "Active",
          dateTime: now,
          location: { x: -100.16, y: 40.93, address: "I-80 W, MP 213" },
        },
      };
    case "dpf":
      return {
        id,
        source: "samsara",
        payload: {
          eventType: "VehicleFault",
          eventTime: now,
          data: {
            vehicle: { id: "281474977", name: "4120" },
            fault: {
              j1939: {
                spn: 3251,
                fmi: 16,
                description: "Diesel particulate filter differential pressure - data valid but above normal operating range - moderately severe level",
              },
            },
            location: { latitude: 40.78, longitude: -98.8, address: "I-80 E, MP 291" },
          },
        },
      };
    case "tire":
      return {
        id,
        source: "driver",
        payload: {
          channel: "sms",
          receivedAt: now,
          driver: { name: "Marcus Hale" },
          unitNumber: "4590",
          message:
            "Left rear drive tire is losing air slowly, dropping about 3 psi an hour. Still rolling fine on I-80 E near MP 284.",
        },
      };
    default:
      return null;
  }
}
