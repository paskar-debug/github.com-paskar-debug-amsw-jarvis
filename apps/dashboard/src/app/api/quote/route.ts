import { NextResponse } from "next/server";

// Proxies ZenQuotes server-side to avoid browser CORS issues, and caches for
// an hour since the underlying "quote of the day" only changes once daily.
export async function GET() {
  const response = await fetch("https://zenquotes.io/api/today", {
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Kunne ikke hente citat" }, { status: 502 });
  }

  const [entry] = (await response.json()) as Array<{ q: string; a: string; date: string }>;
  return NextResponse.json({ quote: entry.q, author: entry.a, date: entry.date });
}
