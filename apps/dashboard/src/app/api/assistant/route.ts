import { NextRequest, NextResponse } from "next/server";
import { getBearerToken, verifyRequest } from "@/lib/verifyRequest";

export async function POST(req: NextRequest) {
  if (!(await verifyRequest(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { message?: string } | null;
  if (!body?.message) return NextResponse.json({ error: "Mangler besked." }, { status: 400 });

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assistant-chat`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getBearerToken(req)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: body.message }),
  });
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 502 });
  return NextResponse.json(await res.json());
}
