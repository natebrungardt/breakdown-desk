import { admin } from "@/lib/db";
import { rebaseLoadDeadlines } from "@/lib/units";

// Clears runtime data (incidents and everything hanging off them via ON DELETE CASCADE).
// Reference data (trucks, shops, warranty policies, loads) is kept; load deadlines are re-based.
export async function POST() {
  const { error } = await admin().from("incidents").delete().not("id", "is", null);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  await rebaseLoadDeadlines();
  return Response.json({ ok: true });
}
