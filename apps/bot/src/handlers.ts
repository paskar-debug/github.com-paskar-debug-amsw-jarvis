import type { AmswState } from "@amsw/core";
import { env } from "./env.js";
import { supabase } from "./supabase.js";
import { syncAll } from "./sync.js";

export async function createTask(title: string): Promise<string> {
  const { error } = await supabase.from("tasks").insert({
    owner_id: env.ownerId,
    title,
    source: "telegram",
  });
  if (error) throw error;
  return `Opgave oprettet: "${title}"`;
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
