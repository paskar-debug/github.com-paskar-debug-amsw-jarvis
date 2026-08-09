import { env } from "./env.js";
import { supabase } from "./supabase.js";
import { notifyOwner } from "./notify.js";

function copenhagenTodayRange(): { start: string; end: string } {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const offsetName = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Copenhagen", timeZoneName: "shortOffset" })
    .formatToParts(now)
    .find((p) => p.type === "timeZoneName")?.value;
  const offsetHours = Number(offsetName?.match(/GMT([+-]\d+)/)?.[1] ?? 1);
  const offset = `${offsetHours >= 0 ? "+" : "-"}${String(Math.abs(offsetHours)).padStart(2, "0")}:00`;

  return { start: `${dateStr}T00:00:00${offset}`, end: `${dateStr}T23:59:59${offset}` };
}

export interface BriefingData {
  events: { title: string; startsAt: string; location: string | null }[];
  openTasks: { title: string; priority: string }[];
  statusByArea: { area: string; state: string; note: string | null }[];
  activeErrors: { source: string; error: string }[];
}

const SOURCE_LABELS: Record<string, string> = {
  google_calendar: "Google Kalender",
  shopify: "Shopify",
  supabase: "Supabase",
  vercel: "Vercel",
  railway: "Railway",
  openai: "OpenAI",
  anthropic: "Anthropic",
  telegram: "Telegram",
};

const PRIORITY_ORDER: Record<string, number> = { p1: 0, p2: 1, p3: 2, p4: 3 };

/** Pure formatter - no network/DB, so it's cheap to unit test against fixed data. */
export function formatBriefing(data: BriefingData): string {
  const lines: string[] = ["☀️ Godmorgen! Her er dagens overblik:"];

  lines.push("");
  if (data.events.length > 0) {
    lines.push("📅 I dag:");
    for (const e of data.events) {
      const time = new Date(e.startsAt).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Copenhagen" });
      lines.push(`- ${time} ${e.title}${e.location ? ` (${e.location})` : ""}`);
    }
  } else {
    lines.push("📅 Ingen aftaler i dag.");
  }

  const sortedTasks = [...data.openTasks].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));
  lines.push("");
  lines.push(sortedTasks.length > 0 ? `✅ Åbne opgaver (${sortedTasks.length}):` : "✅ Ingen åbne opgaver.");
  for (const t of sortedTasks.slice(0, 8)) {
    lines.push(`- [${t.priority.toUpperCase()}] ${t.title}`);
  }
  if (sortedTasks.length > 8) lines.push(`  …og ${sortedTasks.length - 8} mere.`);

  if (data.statusByArea.length > 0) {
    lines.push("");
    lines.push("📊 Status:");
    for (const s of data.statusByArea) {
      const icon = s.state === "green" ? "🟢" : s.state === "yellow" ? "🟡" : "🔴";
      lines.push(`- ${icon} ${s.area}${s.note ? `: ${s.note}` : ""}`);
    }
  }

  if (data.activeErrors.length > 0) {
    lines.push("");
    lines.push("⚠️ Kræver opmærksomhed:");
    for (const e of data.activeErrors) {
      lines.push(`- ${SOURCE_LABELS[e.source] ?? e.source}: ${e.error}`);
    }
  }

  return lines.join("\n");
}

async function loadBriefingData(): Promise<BriefingData> {
  const { start, end } = copenhagenTodayRange();

  const [eventsRes, tasksRes, statusRes, syncRes] = await Promise.all([
    supabase
      .from("calendar_events")
      .select("title, starts_at, location")
      .eq("owner_id", env.ownerId)
      .gte("starts_at", start)
      .lte("starts_at", end)
      .order("starts_at"),
    supabase.from("tasks").select("title, priority").eq("owner_id", env.ownerId).neq("status", "done").neq("status", "cancelled"),
    supabase.from("amsw_status").select("area, state, note, recorded_at").eq("owner_id", env.ownerId).order("recorded_at", { ascending: false }),
    supabase.from("integration_sync_state").select("source, last_error").eq("owner_id", env.ownerId).not("last_error", "is", null),
  ]);

  const latestByArea = new Map<string, { area: string; state: string; note: string | null }>();
  for (const row of statusRes.data ?? []) {
    if (!latestByArea.has(row.area)) latestByArea.set(row.area, row);
  }

  return {
    events: (eventsRes.data ?? []).map((e) => ({ title: e.title, startsAt: e.starts_at, location: e.location })),
    openTasks: (tasksRes.data ?? []).map((t) => ({ title: t.title, priority: t.priority })),
    statusByArea: [...latestByArea.values()],
    activeErrors: (syncRes.data ?? []).map((s) => ({ source: s.source, error: s.last_error as string })),
  };
}

export async function sendDailyBriefing(): Promise<void> {
  const data = await loadBriefingData();
  await notifyOwner(formatBriefing(data));
}
