import type { AmswState } from "@amsw/core";
import { createGoogleCalendarEvent } from "@amsw/integrations";
import { env } from "./env.js";
import { supabase } from "./supabase.js";
import { syncAll } from "./sync.js";
import { classifyMessage } from "./classify.js";

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

/** Classifies a free-form message as a task or calendar event and creates the right thing. */
export async function handleFreeformMessage(text: string): Promise<string> {
  if (!env.anthropicApiKey) {
    return createTask(text);
  }
  try {
    const result = await classifyMessage(text, env.anthropicApiKey);
    if (result.kind === "event") {
      return createCalendarEvent(result.title, result.startsAt, result.endsAt);
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
