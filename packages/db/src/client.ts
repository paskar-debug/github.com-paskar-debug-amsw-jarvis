import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types.js";

export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Server-side client using the service-role key. Bypasses RLS, so callers
 * must always set owner_id explicitly when writing rows.
 */
export function createServiceClient(url: string, serviceRoleKey: string): TypedSupabaseClient {
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Browser-side client using the anon key. Relies on Supabase Auth + RLS to
 * scope every query to the logged-in user.
 */
export function createBrowserClient(url: string, anonKey: string): TypedSupabaseClient {
  return createClient<Database>(url, anonKey);
}
