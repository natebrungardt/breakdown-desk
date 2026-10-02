import { startIncident } from "@/lib/intake";
import { buildPayload } from "@/lib/mockPayloads";

// The pipeline pauses between layers and calls an LLM, so give it room on Vercel.
export const maxDuration = 60;

// Dashboard scenario buttons. The payload is built server-side from a fixed list, so
// this route can only replay the three demo scenarios, not accept arbitrary input.
// Runs are still capped by the run limit in lib/intake.ts.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const scenario = buildPayload(id);
  if (!scenario) return Response.json({ error: `unknown scenario: ${id}` }, { status: 404 });
  return startIncident(scenario.source, scenario.payload);
}
