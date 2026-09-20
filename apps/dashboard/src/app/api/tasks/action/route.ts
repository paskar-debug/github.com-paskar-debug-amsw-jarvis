import { NextRequest, NextResponse } from "next/server";
import { getBearerToken, verifyRequest } from "@/lib/verifyRequest";

export async function POST(req: NextRequest) {
  if (!(await verifyRequest(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { action: "create"; title?: string }
    | { action: "complete" | "delete"; taskId?: string }
    | null;
  if (!body?.action) return NextResponse.json({ error: "Mangler action." }, { status: 400 });

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/task-action`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getBearerToken(req)}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 502 });
  return NextResponse.json(await res.json());
}
