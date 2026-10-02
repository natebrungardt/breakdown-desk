import { admin } from "@/lib/db";
import { recordDecision } from "@/lib/decisions/record";
import { emit } from "@/lib/events";

// Human approval of a pending action: mark it approved and log a human decision.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = admin();

  const { data: action } = await db.from("actions").select("*").eq("id", id).maybeSingle();
  if (!action) return Response.json({ error: "action not found" }, { status: 404 });
  if (action.status === "approved") return Response.json({ id, status: "approved" });

  // Only flip pending -> approved, so a double click logs one human decision, not two.
  const { data: updated, error } = await db
    .from("actions")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!updated?.length) return Response.json({ id, status: "approved" });

  const label = String(action.type).replace("_", " ");
  await recordDecision({
    incidentId: action.incident_id,
    name: "action_approval",
    output: { action_id: id, type: action.type, status: "approved" },
    source: "human",
    reason: `Approved from the dashboard: ${label} to ${action.recipient}`,
    inputs: { action_id: id },
  });
  await emit(action.incident_id, "actions", "booked", `Approved by a person: ${label} to ${action.recipient}.`);
  return Response.json({ id, status: "approved" });
}
