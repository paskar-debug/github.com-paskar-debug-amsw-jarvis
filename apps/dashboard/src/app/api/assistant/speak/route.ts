import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/verifyRequest";

export async function POST(req: NextRequest) {
  if (!(await verifyRequest(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  if (!body?.text) return NextResponse.json({ error: "Mangler tekst." }, { status: 400 });

  const botUrl = process.env.BOT_ASSISTANT_URL;
  const apiKey = process.env.ASSISTANT_API_KEY;
  if (!botUrl || !apiKey) return NextResponse.json({ error: "Assistenten er ikke konfigureret." }, { status: 503 });

  const res = await fetch(`${botUrl}/assistant/speak`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: body.text }),
  });
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 502 });

  const audio = Buffer.from(await res.arrayBuffer());
  return new NextResponse(audio, { headers: { "Content-Type": res.headers.get("content-type") ?? "audio/ogg" } });
}
