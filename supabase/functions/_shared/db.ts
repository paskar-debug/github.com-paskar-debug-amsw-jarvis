import { createClient } from "npm:@supabase/supabase-js@2";

export const OWNER_ID = Deno.env.get("OWNER_USER_ID")!;

export function serviceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}
