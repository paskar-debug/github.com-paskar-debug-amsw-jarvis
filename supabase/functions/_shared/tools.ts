import { OWNER_ID, serviceClient } from "./db.ts";
import { createGoogleCalendarEvent } from "./google.ts";

export type FactCategory = "familie" | "forretning" | "praeference" | "andet";

export async function createTask(title: string): Promise<string> {
  const supabase = serviceClient();
  const { error } = await supabase.from("tasks").insert({ owner_id: OWNER_ID, title, source: "manual" });
  if (error) throw error;
  return `Opgave oprettet: "${title}"`;
}

export async function saveFact(fact: string, category: FactCategory = "andet"): Promise<string> {
  const supabase = serviceClient();
  const { error } = await supabase.from("user_facts").insert({ owner_id: OWNER_ID, fact, category });
  if (error) throw error;
  return `Noteret: "${fact}"`;
}

export async function createCalendarEvent(title: string, startsAt: string, endsAt: string): Promise<string> {
  const supabase = serviceClient();
  let externalId: string | null = null;
  let source: "manual" | "google" = "manual";

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN") ?? "";
  if (clientId && refreshToken) {
    try {
      externalId = await createGoogleCalendarEvent(
        {
          clientId,
          clientSecret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
          refreshToken,
          calendarId: Deno.env.get("GOOGLE_CALENDAR_ID") ?? "primary",
        },
        { title, startsAt, endsAt },
      );
      source = "google";
    } catch (err) {
      console.error("Kunne ikke oprette Google Kalender-begivenhed, gemmer kun lokalt:", err);
    }
  }

  const { error } = await supabase.from("calendar_events").insert({
    owner_id: OWNER_ID,
    title,
    starts_at: startsAt,
    ends_at: endsAt,
    source,
    external_id: externalId,
  });
  if (error) throw error;

  const when = new Date(startsAt).toLocaleString("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Copenhagen",
  });
  const suffix = source === "manual" ? " (kunne ikke skrives til Google Kalender, kun gemt lokalt)" : "";
  return `Aftale oprettet: "${title}" – ${when}${suffix}`;
}

/** Short plain-text summary of known facts + open tasks + upcoming events + latest business/health
 *  status, given to Claude as background for the assistant's replies. Mirrors apps/bot's
 *  buildAssistantContext so the dashboard chat sees the same picture as the Telegram bot. */
export async function buildAssistantContext(): Promise<string> {
  const supabase = serviceClient();
  const [factsRes, tasksRes, eventsRes, statusRes] = await Promise.all([
    supabase.from("user_facts").select("fact").eq("owner_id", OWNER_ID).order("created_at", { ascending: false }).limit(20),
    supabase.from("tasks").select("title, priority, due_at").eq("owner_id", OWNER_ID).neq("status", "done").neq("status", "cancelled").limit(20),
    supabase
      .from("calendar_events")
      .select("title, starts_at")
      .eq("owner_id", OWNER_ID)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(10),
    supabase.from("amsw_status").select("area, note, recorded_at").eq("owner_id", OWNER_ID).order("recorded_at", { ascending: false }).limit(10),
  ]);

  const parts: string[] = [];
  if (factsRes.data && factsRes.data.length > 0) {
    parts.push(`Om brugeren: ${factsRes.data.map((f) => f.fact).join(". ")}.`);
  }
  if (tasksRes.data && tasksRes.data.length > 0) {
    parts.push(`Åbne opgaver (${tasksRes.data.length} i alt): ${tasksRes.data.map((t) => `${t.title} [${t.priority}]`).join(", ")}.`);
  } else {
    parts.push("Ingen åbne opgaver lige nu.");
  }
  if (eventsRes.data && eventsRes.data.length > 0) {
    const events = eventsRes.data.map((e) => {
      const when = new Date(e.starts_at).toLocaleDateString("da-DK", { day: "numeric", month: "short", timeZone: "Europe/Copenhagen" });
      return `${e.title} (${when})`;
    });
    parts.push(`Kommende aftaler: ${events.join(", ")}.`);
  }
  if (statusRes.data && statusRes.data.length > 0) {
    const latestByArea = new Map<string, { note: string | null }>();
    for (const s of statusRes.data) if (!latestByArea.has(s.area)) latestByArea.set(s.area, s);
    const statusLines = [...latestByArea.entries()].map(([area, s]) => `${area}: ${s.note ?? "ingen note"}`);
    parts.push(`Seneste status: ${statusLines.join(", ")}.`);
  }
  return parts.join(" ");
}
