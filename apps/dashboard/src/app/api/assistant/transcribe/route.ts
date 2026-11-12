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
  if (!res.ok) {
    // Vis en læsbar besked i stedet for rå JSON fra OpenAI.
    const raw = await res.text();
    let message = "Jeg kunne ikke høre optagelsen. Prøv igen.";
    try {
      const parsed = JSON.parse(raw) as { error?: string };
      if (parsed.error && !parsed.error.includes("{")) message = parsed.error;
    } catch {
      /* behold standardbeskeden */
    }
    console.error("transcribe fejl:", raw);
    return NextResponse.json({ error: message }, { status: 502 });
  }
  return NextResponse.json(await res.json());
}
