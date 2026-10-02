// Shared types for the pipeline, API and dashboard.

export type Layer = "signals" | "units" | "decisions" | "counterparties" | "actions" | "records";
export const LAYER_ORDER: Layer[] = ["signals", "units", "decisions", "counterparties", "actions", "records"];

// Visual state of a feed row; maps to the .tk-state-* classes in globals.css.
export type EventStatus = "live" | "routing" | "review" | "booked" | "filed" | "complete";

export type Source = "geotab" | "samsara" | "driver";
export const SOURCES: Source[] = ["geotab", "samsara", "driver"];

export type Severity = "stop_now" | "limp_to_shop" | "schedule_later";
export type DecisionSource = "rule" | "llm" | "human";

export type FeedEvent = {
  id: number;
  incident_id: string;
  created_at: string;
  layer: Layer;
  status: EventStatus;
  message: string;
};

// What the incident panel renders. Built server-side from the database
// (lib/incidentView.ts) or client-side from a mock scenario (offline fallback).
export type IncidentView = {
  status: string;
  summary: { k: string; v: string; pill?: string }[];
  audit: { k: string; v: string; reason: string; source: DecisionSource }[];
  actions: { id?: string; text: string; approved: boolean }[];
  records: { k: string; v: string }[];
};

// What the fault is about. Drives severity rules, warranty component and shop capability.
export type Category = "oil_pressure" | "coolant_temp" | "dpf" | "tire_pressure" | "brakes" | "other";

// The one shape every vendor payload is normalized into.
export type FaultEvent = {
  source: Source;
  unitNumber: string;
  category: Category;
  spn: number | null; // J1939 suspect parameter number (null for driver messages)
  fmi: number | null; // J1939 failure mode identifier
  description: string;
  location: string; // e.g. "I-80 W, MP 213"
  lat: number;
  lng: number;
  occurredAt: string; // ISO timestamp
  driverName?: string;
};
