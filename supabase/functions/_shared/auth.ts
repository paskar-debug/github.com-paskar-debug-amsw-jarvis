import { createClient } from "npm:@supabase/supabase-js@2";

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Verifies the caller's bearer token is a real, currently-valid Supabase session
 *  belonging to the single owner user - not just any signed JWT (the anon key is
 *  also a valid JWT, so platform-level verify_jwt alone isn't enough). */
export async function requireOwner(req: Request): Promise<Response | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return jsonResponse(401, { error: "Unauthorized" });

  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user || data.user.id !== Deno.env.get("OWNER_USER_ID")) {
    return jsonResponse(401, { error: "Unauthorized" });
  }
  return null;
}
