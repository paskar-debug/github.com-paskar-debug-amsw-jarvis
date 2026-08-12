import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@amsw/db";

// One-time OAuth callback to complete the Whoop authorization code exchange and
// store the resulting refresh token. Delete this route (and its env vars on
// Vercel) once the connection is established - the bot handles token refresh
// from here on, this only bootstraps the very first refresh token.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  if (error) return new NextResponse(`Whoop afviste godkendelsen: ${error}`, { status: 400 });
  if (!code) return new NextResponse("Mangler ?code fra Whoop.", { status: 400 });

  const tokenRes = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.WHOOP_CLIENT_ID ?? "",
      client_secret: process.env.WHOOP_CLIENT_SECRET ?? "",
      redirect_uri: process.env.WHOOP_REDIRECT_URI ?? "",
    }),
  });
  if (!tokenRes.ok) {
    return new NextResponse(`Whoop token-udveksling fejlede (${tokenRes.status}): ${await tokenRes.text()}`, { status: 500 });
  }
  const tokens = (await tokenRes.json()) as { refresh_token: string };

  const supabase = createServiceClient(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  const { error: dbError } = await supabase
    .from("whoop_auth")
    .upsert(
      { owner_id: process.env.SUPABASE_OWNER_USER_ID ?? "", refresh_token: tokens.refresh_token, updated_at: new Date().toISOString() },
      { onConflict: "owner_id" },
    );
  if (dbError) return new NextResponse(`Kunne ikke gemme Whoop-token: ${dbError.message}`, { status: 500 });

  return new NextResponse("Whoop er forbundet til AMSW Jarvis. Du kan lukke denne side.", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
