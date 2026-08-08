import type { AmswState } from "@amsw/core";
import { createGoogleCalendarEvent, deleteGoogleCalendarEvent } from "@amsw/integrations";
import { env } from "./env.js";
import { supabase } from "./supabase.js";
import { syncAll } from "./sync.js";
import { classifyMessage } from "./classify.js";
import { generateDraft } from "./draft.js";

export async function createTask(title: string): Promise<string> {
  const { error } = await supabase.from("tasks").insert({
    owner_id: env.ownerId,
    title,
    source: "telegram",
  });
  if (error) throw error;
  return `Opgave oprettet: "${title}"`;
}

export async function createCalendarEvent(title: string, startsAt: string, endsAt: string): Promise<string> {
  let externalId: string | null = null;
  let source: "manual" | "google" = "manual";

  if (env.google.refreshToken && env.google.clientId) {
    try {
      externalId = await createGoogleCalendarEvent(env.google, { title, startsAt, endsAt });
      source = "google";
    } catch (err) {
      console.error("Kunne ikke oprette Google Kalender-begivenhed, gemmer kun lokalt:", err);
    }
  }

  const { error } = await supabase.from("calendar_events").insert({
    owner_id: env.ownerId,
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

const SEARCH_STOPWORDS = new Set(["møde", "møder", "mødet", "aftale", "aftalen", "med", "og", "til", "den", "det", "min", "mit", "hos", "på", "af", "for"]);

function significantWords(query: string): string[] {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w.length >= 3 && !SEARCH_STOPWORDS.has(w));
  return words.length > 0 ? words : query.split(/\s+/).filter(Boolean);
}

type CalendarEventCandidate = { id: string; title: string; starts_at: string; source: "manual" | "google"; external_id: string | null };

// Single-user personal bot: an in-memory pending-list is enough to let a
// short follow-up ("begge", "alle", or a name from the list) resolve an
// ambiguous delete without re-running the fuzzy search from scratch.
let pendingDeleteCandidates: { candidates: CalendarEventCandidate[]; expiresAt: number } | null = null;
const PENDING_TTL_MS = 5 * 60 * 1000;

function formatCandidateLine(c: CalendarEventCandidate): string {
  const when = new Date(c.starts_at).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Copenhagen" });
  return `- ${c.title} (${when})`;
}

async function deleteCandidate(candidate: CalendarEventCandidate): Promise<void> {
  if (candidate.source === "google" && candidate.external_id && env.google.refreshToken && env.google.clientId) {
    try {
      await deleteGoogleCalendarEvent(env.google, candidate.external_id);
    } catch (err) {
      console.error("Kunne ikke slette Google Kalender-begivenhed:", err);
    }
  }
  const { error } = await supabase.from("calendar_events").delete().eq("id", candidate.id);
  if (error) throw error;
}

/** Tries to resolve a short follow-up ("begge", "alle", a name from the list) against the last ambiguous delete list. */
async function resolveFollowupDelete(text: string): Promise<string | null> {
  if (!pendingDeleteCandidates || pendingDeleteCandidates.expiresAt < Date.now()) {
    pendingDeleteCandidates = null;
    return null;
  }
  const { candidates } = pendingDeleteCandidates;
  const lower = text.toLowerCase();

  if (/\b(begge|alle|dem alle sammen|alle sammen)\b/.test(lower)) {
    for (const c of candidates) await deleteCandidate(c);
    pendingDeleteCandidates = null;
    return `Slettede ${candidates.length} aftaler:\n${candidates.map(formatCandidateLine).join("\n")}`;
  }

  const words = significantWords(text);
  const matches = candidates.filter((c) => words.some((w) => c.title.toLowerCase().includes(w)));
  if (matches.length === 1) {
    await deleteCandidate(matches[0]);
    pendingDeleteCandidates = null;
    return `Aftale slettet: "${matches[0].title}"`;
  }

  return null;
}

export async function deleteCalendarEvent(query: string): Promise<string> {
  // Match on individual significant words rather than the whole phrase: the
  // classifier occasionally mis-spells (e.g. Norwegian "møte" for Danish
  // "møde"), so a distinctive word like a name is far more robust than an
  // exact-substring match on the full query.
  const words = significantWords(query);
  const orFilter = words.map((w) => `title.ilike.%${w}%`).join(",");

  const { data: matches, error: searchError } = await supabase
    .from("calendar_events")
    .select("id, title, starts_at, source, external_id")
    .eq("owner_id", env.ownerId)
    .gte("starts_at", new Date().toISOString())
    .or(orFilter)
    .order("starts_at", { ascending: true });
  if (searchError) throw searchError;

  if (!matches || matches.length === 0) {
    return `Fandt ingen kommende aftale der matcher "${query}".`;
  }

  if (matches.length > 1) {
    pendingDeleteCandidates = { candidates: matches, expiresAt: Date.now() + PENDING_TTL_MS };
    return `Fandt flere aftaler der matcher "${query}" – sig "begge"/"alle", eller vær mere specifik:\n${matches.map(formatCandidateLine).join("\n")}`;
  }

  await deleteCandidate(matches[0]);
  pendingDeleteCandidates = null;
  return `Aftale slettet: "${matches[0].title}"`;
}

/** Classifies a free-form message and routes it to the right action. */
export async function handleFreeformMessage(text: string): Promise<string> {
  const followup = await resolveFollowupDelete(text);
  if (followup) return followup;

  if (!env.anthropicApiKey) {
    return createTask(text);
  }
  try {
    const result = await classifyMessage(text, env.anthropicApiKey);
    if (result.kind === "event") {
      return createCalendarEvent(result.title, result.startsAt, result.endsAt);
    }
    if (result.kind === "delete_event") {
      return deleteCalendarEvent(result.query);
    }
    if (result.kind === "draft") {
      const content = await generateDraft(text, env.anthropicApiKey);
      const { error } = await supabase.from("drafts").insert({ owner_id: env.ownerId, request: text, content });
      if (error) console.error("Kunne ikke gemme udkast i databasen:", error);
      return content;
    }
    return createTask(result.title);
  } catch (err) {
    console.error("Klassificering fejlede, opretter som opgave:", err);
    return createTask(text);
  }
}

export async function setStatus(area: string, state: AmswState, note?: string): Promise<string> {
  const { error } = await supabase.from("amsw_status").insert({
    owner_id: env.ownerId,
    area,
    state,
    note: note ?? null,
    metrics: {},
  });
  if (error) throw error;
  return `Status for "${area}" sat til ${state}${note ? ` (${note})` : ""}`;
}

export async function createGoal(title: string): Promise<string> {
  const { error } = await supabase.from("goals").insert({
    owner_id: env.ownerId,
    title,
  });
  if (error) throw error;
  return `Mål oprettet: "${title}"`;
}

export async function logWellbeing(mood: number, energy: number, sleepHours?: number, note?: string): Promise<string> {
  const { error } = await supabase.from("wellbeing_entries").insert({
    owner_id: env.ownerId,
    mood,
    energy,
    sleep_hours: sleepHours ?? null,
    note: note ?? null,
  });
  if (error) throw error;
  return `Velvære logget: humør ${mood}/5, energi ${energy}/5${sleepHours ? `, søvn ${sleepHours}t` : ""}`;
}

export async function runSync(): Promise<string> {
  const summary = await syncAll();
  const lines: string[] = [];
  if (summary.googleCalendar !== undefined) lines.push(`Google Kalender: ${summary.googleCalendar} begivenheder`);
  if (summary.todoist !== undefined) lines.push(`Todoist: ${summary.todoist} opgaver`);
  if (summary.shopify) lines.push(`Shopify: ${summary.shopify.ordersToday} ordrer, ${summary.shopify.revenueToday} i omsætning i dag`);
  if (summary.errors.length > 0) lines.push(`Fejl: ${summary.errors.join("; ")}`);
  if (lines.length === 0) lines.push("Ingen integrationer er konfigureret endnu (se .env.example).");
  return lines.join("\n");
}
