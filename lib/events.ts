import { admin, must } from "./db";
import type { EventStatus, Layer } from "./types";

// Every pipeline step reports through here. Rows land in incident_events, which
// Supabase Realtime streams to the dashboard feed.
export async function emit(incidentId: string, layer: Layer, status: EventStatus, message: string) {
  must(await admin().from("incident_events").insert({ incident_id: incidentId, layer, status, message }));
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const PAUSE_MS = 400;

// emit() then pause, so the feed is readable in a live demo.
export async function step(incidentId: string, layer: Layer, status: EventStatus, message: string) {
  await emit(incidentId, layer, status, message);
  await sleep(PAUSE_MS);
}
