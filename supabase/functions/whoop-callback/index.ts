// Public OAuth redirect target - Whoop's own server sends the user's browser here after consent,
// with no way to attach an Authorization header. Deployed with --no-verify-jwt for that reason;
// the one-time authorization `code` param is the actual security boundary, not a bearer token.

function html(status: number, body: string): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui,sans-serif;background:#0b0f16;color:#f4f6f9;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:1rem"><div>${body}</div></body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return html(400, `<h1>Whoop-godkendelse afvist</h1><p>${oauthError}</p>`);
  }
  if (!code) {
    return html(400, "<h1>Mangler code-parameter</h1>");
  }

  try {
    const tokenRes = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: Deno.env.get("WHOOP_CLIENT_ID") ?? "",
        client_secret: Deno.env.get("WHOOP_CLIENT_SECRET") ?? "",
        redirect_uri: Deno.env.get("WHOOP_REDIRECT_URI") ?? "",
      }),
    });
    if (!tokenRes.ok) {
      return html(502, `<h1>Kunne ikke hente token fra Whoop</h1><pre style="white-space:pre-wrap">${await tokenRes.text()}</pre>`);
    }
    const tokens = (await tokenRes.json()) as { refresh_token: string };

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error: dbError } = await supabase
      .from("whoop_auth")
      .upsert(
        { owner_id: Deno.env.get("OWNER_USER_ID"), refresh_token: tokens.refresh_token, updated_at: new Date().toISOString() },
        { onConflict: "owner_id" },
      );
    if (dbError) throw dbError;

    return html(200, "<h1>Whoop er forbundet igen.</h1><p>Du kan lukke denne side.</p>");
  } catch (err) {
    return html(500, `<h1>Fejl</h1><pre style="white-space:pre-wrap">${(err as Error).message}</pre>`);
  }
});
