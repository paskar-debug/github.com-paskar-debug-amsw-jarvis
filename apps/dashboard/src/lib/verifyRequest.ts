import { createClient } from "@supabase/supabase-js";

/** Confirms the request carries a valid Supabase session for the logged-in owner, before we proxy anything to the bot. */
export async function verifyRequest(req: Request): Promise<boolean> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await supabase.auth.getUser(token);
  return !error && Boolean(data.user);
}
