import { hasWebhookSecret, startIncident } from "@/lib/intake";
import { SOURCES, type Source } from "@/lib/types";

// The pipeline pauses between layers and calls an LLM, so give it room on Vercel.
export const maxDuration = 60;

// Vendor webhook: accepts any payload from a caller holding the shared secret.
// The dashboard does not call this; its buttons go through /api/scenarios/[id].
export async function POST(req: Request, ctx: { params: Promise<{ source: string }> }) {
  if (!hasWebhookSecret(req)) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { source } = await ctx.params;
  if (!SOURCES.includes(source as Source)) {
    return Response.json({ error: `unknown source: ${source}` }, { status: 404 });
  }
  const payload = await req.json().catch(() => null);
  if (!payload) return Response.json({ error: "body must be JSON" }, { status: 400 });

  return startIncident(source as Source, payload);
}
