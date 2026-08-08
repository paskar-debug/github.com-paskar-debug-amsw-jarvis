import { NextRequest, NextResponse } from "next/server";

// One-time bootstrap endpoint: completes the Shopify OAuth code exchange so
// we can read the resulting Admin API access token once, then this route
// should be deleted - it has no other purpose in the running app.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const shop = request.nextUrl.searchParams.get("shop");
  if (!code || !shop) {
    return new NextResponse("Mangler code eller shop parameter", { status: 400 });
  }

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      code,
    }),
  });

  if (!response.ok) {
    return new NextResponse(`Token-udveksling fejlede: ${response.status} ${await response.text()}`, { status: 500 });
  }

  const data = (await response.json()) as { access_token: string; scope: string };
  return new NextResponse(`Access token: ${data.access_token}\nScope: ${data.scope}`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
