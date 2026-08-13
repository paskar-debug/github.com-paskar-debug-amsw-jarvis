import { NextRequest, NextResponse } from "next/server";
import { getBearerToken, verifyRequest } from "@/lib/verifyRequest";

export async function POST(req: NextRequest) {
  if (!(await verifyRequest(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const audio = Buffer.from(await req.arrayBuffer());
  const contentType = req.headers.get("content-type") ?? "audio/webm";

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assistant-transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getBearerToken(req)}`, "Content-Type": contentType },
    body: audio,
  });
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 502 });
  return NextResponse.json(await res.json());
}
