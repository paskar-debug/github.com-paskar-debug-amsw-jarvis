import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/verifyRequest";

export async function POST(req: NextRequest) {
  if (!(await verifyRequest(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const botUrl = process.env.BOT_ASSISTANT_URL;
  const apiKey = process.env.ASSISTANT_API_KEY;
  if (!botUrl || !apiKey) return NextResponse.json({ error: "Assistenten er ikke konfigureret." }, { status: 503 });

  const audio = Buffer.from(await req.arrayBuffer());
  const contentType = req.headers.get("content-type") ?? "audio/webm";

  const res = await fetch(`${botUrl}/assistant/transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": contentType },
    body: audio,
  });
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 502 });
  return NextResponse.json(await res.json());
}
