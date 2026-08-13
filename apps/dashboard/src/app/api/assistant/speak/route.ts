import { NextRequest, NextResponse } from "next/server";
import { getBearerToken, verifyRequest } from "@/lib/verifyRequest";

export async function POST(req: NextRequest) {
  if (!(await verifyRequest(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { text?: string; voice?: string } | null;
  if (!body?.text) return NextResponse.json({ error: "Mangler tekst." }, { status: 400 });

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assistant-speak`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getBearerToken(req)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: body.text, voice: body.voice }),
  });
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 502 });

  const audio = Buffer.from(await res.arrayBuffer());
  return new NextResponse(audio, { headers: { "Content-Type": res.headers.get("content-type") ?? "audio/ogg" } });
}
