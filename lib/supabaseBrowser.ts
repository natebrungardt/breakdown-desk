import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser client (anon key). Only used to subscribe to incident_events; RLS allows
// anon to read nothing else.
let client: SupabaseClient | null | undefined;

export function browserClient(): SupabaseClient | null {
  if (client === undefined) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    client = url && key ? createClient(url, key) : null;
  }
  return client;
}
