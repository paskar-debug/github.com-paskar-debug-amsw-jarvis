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

/** Both RSS and og:image URLs come out of markup with entities like &amp; still literal - decode
 *  before use, or query strings past the first "&amp;" silently break. */
function decodeHtmlEntities(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

/** RSS items rarely carry an image directly - DR occasionally does via media:content, TV2 never does. */
function extractDirectImage(block: string): string | null {
  const match =
    block.match(/<media:content[^>]*url="([^"]+)"[^>]*medium="image"/) ||
    block.match(/<media:content[^>]*medium="image"[^>]*url="([^"]+)"/) ||
    block.match(/<media:thumbnail[^>]*url="([^"]+)"/) ||
    block.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image/);
  return match ? decodeHtmlEntities(match[1]) : null;
}

function parseRssItems(xml: string, limit: number) {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return blocks.slice(0, limit).map((block) => ({
    title: extractTag(block, "title"),
    link: extractTag(block, "link"),
    pubDate: extractTag(block, "pubDate"),
    image: extractDirectImage(block),
  }));
}

/** Falls back to the article page's og:image meta tag when the feed itself has no image -
 *  a stable, widely-supported convention (unlike scraping arbitrary page markup). Best-effort:
 *  a slow or missing tag just means no thumbnail, never an error for the whole list. */
async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(url, { signal: controller.signal, next: { revalidate: 900 } });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const html = await response.text();
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return match ? decodeHtmlEntities(match[1]) : null;
  } catch {
    return null;
  }
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
  const parsed = parseRssItems(xml, 8);
  const items = await Promise.all(
    parsed.map(async (item) => ({ ...item, image: item.image ?? (await fetchOgImage(item.link)) })),
  );
  return NextResponse.json({ items });
}
