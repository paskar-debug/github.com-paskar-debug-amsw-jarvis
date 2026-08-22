import { env } from "./env.js";
import { supabase } from "./supabase.js";
import { notifyOwner } from "./notify.js";

// A goal with no progress update in this long is called out as possibly stalled - not urgent
// enough to change daily, so a rolling ~2-week window feels right without being noisy weekly.
const STALL_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000;

interface GoalSummary {
  title: string;
  category: string | null;
  status: string;
  progress: number;
  updatedAt: string;
  targetDate: string | null;
}

function formatGoalsForPrompt(goals: GoalSummary[]): string {
  const now = Date.now();
  return goals
    .map((g) => {
      const daysSinceUpdate = Math.floor((now - new Date(g.updatedAt).getTime()) / (24 * 60 * 60 * 1000));
      const stalled = g.status === "active" && new Date(g.updatedAt).getTime() < now - STALL_THRESHOLD_MS;
      return `- "${g.title}"${g.category ? ` (${g.category})` : ""}: ${g.progress}%, status ${g.status}${g.targetDate ? `, måldato ${g.targetDate}` : ""}, sidst opdateret for ${daysSinceUpdate} dage siden${stalled ? " [INGEN FREMGANG I OVER 2 UGER]" : ""}`;
    })
    .join("\n");
}

/** Builds the weekly goals check-in message via Claude - pure encouragement/observation, no
 *  proposed target/deadline changes (that's a deliberate scope choice, not a missing feature). */
export async function buildGoalsReview(): Promise<string | null> {
  const { data, error } = await supabase
    .from("goals")
    .select("title, category, status, progress, updated_at, target_date")
    .eq("owner_id", env.ownerId)
    .neq("status", "cancelled")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  if (!data || data.length === 0) return null;

  const goals: GoalSummary[] = data.map((g) => ({
    title: g.title,
    category: g.category,
    status: g.status,
    progress: g.progress,
    updatedAt: g.updated_at,
    targetDate: g.target_date,
  }));

  if (!env.anthropicApiKey) {
    return `🎯 Ugentligt mål-tjek:\n${formatGoalsForPrompt(goals)}`;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 600,
      system:
        "Du skriver en kort, varm, motiverende ugentlig status til en Telegram-besked om AMSW's mål (en personlig virksomheds forretningsmål). " +
        "Fremhæv det der går godt og giv anerkendelse. Nævn forsigtigt og uden at være dømmende de mål der er markeret som 'INGEN FREMGANG I OVER 2 UGER', som en blid observation, ikke en bebrejdelse. " +
        "Foreslå IKKE konkrete ændringer af måldatoer, targets eller procenter - det er bevidst uden for din rolle her, du observerer og opmuntrer, du justerer ikke. " +
        "Opfind aldrig tal eller fremgang der ikke står i dataene. Skriv på dansk, kort (maks 6-8 linjer), i en varm men ikke kunstig/overdrevet tone. Brug gerne 1-2 relevante emojis, ikke flere. " +
        "Skriv råt Telegram-venligt tekst, ingen markdown-overskrifter.",
      messages: [{ role: "user", content: `Her er den nuværende status på AMSW's mål:\n${formatGoalsForPrompt(goals)}` }],
    }),
  });
  if (!response.ok) {
    throw new Error(`Claude mål-gennemgang fejlede: ${response.status} ${await response.text()}`);
  }
  const json = (await response.json()) as { content: Array<{ type: string; text?: string }> };
  const text = json.content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n")
    .trim();
  return text || null;
}

function isMondayInCopenhagen(): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Copenhagen", weekday: "short" }).format(new Date());
  return weekday === "Mon";
}

/** Hook for the daily 08:00 scheduler - only actually sends anything on Mondays, so goals get a
 *  weekly cadence without needing a separate weekly-scheduling primitive. */
export async function runWeeklyGoalsCheck(): Promise<void> {
  if (!isMondayInCopenhagen()) return;
  const message = await buildGoalsReview();
  if (message) await notifyOwner(message);
}
