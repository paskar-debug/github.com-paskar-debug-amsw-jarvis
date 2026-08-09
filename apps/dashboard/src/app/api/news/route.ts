import { NextRequest, NextResponse } from "next/server";

const FEEDS: Record<string, string> = {
  dr: "https://www.dr.dk/nyheder/service/feeds/allenyheder",
  tv2: "https://feeds.services.tv2.dk/api/feeds/nyheder/rss",
};

function extractTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  if (!match) return "";
  const value = match[1].trim();
  const cdata = value.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  return (cdata ? cdata[1] : value).trim();
}

function parseRssItems(xml: string, limit: number) {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return blocks.slice(0, limit).map((block) => ({
    title: extractTag(block, "title"),
    link: extractTag(block, "link"),
    pubDate: extractTag(block, "pubDate"),
  }));
}

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("source") ?? "";
  const feedUrl = FEEDS[source];
  if (!feedUrl) {
    return NextResponse.json({ error: "Ukendt kilde" }, { status: 400 });
  }

  const response = await fetch(feedUrl, { next: { revalidate: 900 } });
  if (!response.ok) {
    return NextResponse.json({ error: "Kunne ikke hente nyheder" }, { status: 502 });
  }

  const xml = await response.text();
  return NextResponse.json({ items: parseRssItems(xml, 8) });
}
