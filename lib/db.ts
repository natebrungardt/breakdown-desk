import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only: uses the service role key. Never import this from a client component.
let client: SupabaseClient | null = null;

export function admin(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase env vars are not set");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

// Throws on a Supabase error so pipeline failures surface instead of silently losing rows.
export function must<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<T>;
}
