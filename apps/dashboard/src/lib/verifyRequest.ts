import { createClient } from "@supabase/supabase-js";

export function getBearerToken(req: Request): string | null {
  return req.headers.get("authorization")?.replace("Bearer ", "") ?? null;
}

/** Confirms the request carries a valid Supabase session for the logged-in owner, before we proxy
 *  anything to the assistant Edge Functions (which independently verify the same token again). */
export async function verifyRequest(req: Request): Promise<boolean> {
  const token = getBearerToken(req);
  if (!token) return false;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await supabase.auth.getUser(token);
  return !error && Boolean(data.user);
}
