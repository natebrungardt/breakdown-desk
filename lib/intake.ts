import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { adapt } from "./adapters";
import { admin } from "./db";
import { createIncident, runPipeline } from "./pipeline";
import type { Source } from "./types";

// Every run can call the LLM, so cap how many incidents the whole app starts per window.
// Counted in the database so the cap holds across serverless instances.
const MAX_RUNS = 20;
const WINDOW_MINUTES = 10;

async function overBudget(): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { count, error } = await admin().from("incidents").select("id", { count: "exact", head: true }).gte("created_at", since);
  if (error) throw new Error(error.message);
  return (count ?? 0) >= MAX_RUNS;
}

// Shared secret for vendor webhooks (Geotab, Samsara, driver SMS gateway). Fails closed when unset.
export function hasWebhookSecret(req: Request): boolean {
  const expected = process.env.SIGNALS_WEBHOOK_SECRET;
  const given = req.headers.get("x-webhook-secret");
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Normalize a payload, open an incident and run the pipeline in the background.
// Returns the HTTP response for the route to send back.
export async function startIncident(source: Source, payload: unknown): Promise<Response> {
  let fault;
  try {
    fault = adapt(source, payload);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }

  if (await overBudget()) {
    return Response.json({ error: `run limit reached (${MAX_RUNS} per ${WINDOW_MINUTES} min), try again shortly` }, { status: 429 });
  }

  const incidentId = await createIncident(source, payload, fault);
  // Respond right away with the incident id; the pipeline streams its progress
  // through incident_events while it keeps running.
  after(() => runPipeline(incidentId, fault));
  return Response.json({ incidentId }, { status: 202 });
}
