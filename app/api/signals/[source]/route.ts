import { after } from "next/server";
import { createIncident, runPipeline } from "@/lib/pipeline";
import { SOURCES, type Source } from "@/lib/types";

// The pipeline pauses between layers and calls an LLM, so give it room on Vercel.
export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ source: string }> }) {
  const { source } = await ctx.params;
  if (!SOURCES.includes(source as Source)) {
    return Response.json({ error: `unknown source: ${source}` }, { status: 404 });
  }
  const payload = await req.json().catch(() => null);
  if (!payload) return Response.json({ error: "body must be JSON" }, { status: 400 });

  const incidentId = await createIncident(source as Source, payload);
  // Respond right away with the incident id; the pipeline streams its progress
  // through incident_events while it keeps running.
  after(() => runPipeline(incidentId, source as Source));
  return Response.json({ incidentId }, { status: 202 });
}
