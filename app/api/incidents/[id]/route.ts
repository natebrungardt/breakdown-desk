import { buildIncidentView } from "@/lib/incidentView";

export const dynamic = "force-dynamic";

// Read model for the incident panel: summary, audit trail, actions, records (+ events as a
// fallback if Realtime drops).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const result = await buildIncidentView(id);
  if (!result) return Response.json({ error: "incident not found" }, { status: 404 });
  return Response.json(result);
}
