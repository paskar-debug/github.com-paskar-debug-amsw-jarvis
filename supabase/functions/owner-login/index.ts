// Backup login path for browser contexts where Supabase's normal email flows can't complete -
// specifically macOS/iOS "installed web app" windows, which use storage isolated from regular
// Safari (so a session established there never appears here) and have no address bar (so a
// clicked email link can't land back in this exact window either). Gated by a secret passphrase
// instead of an email round-trip, since the email round-trip is the thing that doesn't work here.
//
// Mechanism: generate a real magic-link token via the admin API, then do server-side exactly what
// clicking that link does (follow the redirect, read the session tokens out of the fragment) -
// reusing the one auth path already proven reliable in this project, just without needing an
// actual browser redirect to land back in the right window.

const OWNER_EMAIL = "paskar@paramasamy.dk";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://paskars-kontor.vercel.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

  const body = (await req.json().catch(() => null)) as { secret?: string } | null;
  const expected = Deno.env.get("OWNER_LOGIN_SECRET");
  if (!expected || !body?.secret || body.secret !== expected) {
    return json(401, { error: "Forkert adgangskode." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const genRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", email: OWNER_EMAIL }),
  });
  if (!genRes.ok) return json(502, { error: `Kunne ikke generere login: ${await genRes.text()}` });
  const gen = (await genRes.json()) as { action_link: string };

  const verifyRes = await fetch(gen.action_link, { redirect: "manual" });
  const location = verifyRes.headers.get("location");
  if (!location) return json(502, { error: "Uventet svar fra Supabase (intet redirect)." });

  const fragment = new URL(location).hash.replace(/^#/, "");
  const params = new URLSearchParams(fragment);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) {
    return json(502, { error: params.get("error_description") ?? "Login fejlede - ingen tokens i redirect." });
  }

  return json(200, { access_token, refresh_token });
});
