import { env } from "./env.js";
import { supabase } from "./supabase.js";
import { notifyOwner } from "./notify.js";

export type StatusSource = "google_calendar" | "shopify" | "supabase" | "vercel" | "railway" | "openai" | "anthropic" | "telegram";
export type StatusCategory = "integration" | "infrastructure";

const LABELS: Record<StatusSource, string> = {
  google_calendar: "Google Kalender",
  shopify: "Shopify",
  supabase: "Supabase",
  vercel: "Vercel",
  railway: "Railway",
  openai: "OpenAI",
  anthropic: "Anthropic",
  telegram: "Telegram",
};

async function getPreviousError(source: StatusSource): Promise<string | null> {
  const { data } = await supabase
    .from("integration_sync_state")
    .select("last_error")
    .eq("owner_id", env.ownerId)
    .eq("source", source)
    .maybeSingle();
  return data?.last_error ?? null;
}

/** Only notifies on a state transition (ok -> fejl or fejl -> ok), never while an error persists across checks. */
async function notifyOnTransition(source: StatusSource, previousError: string | null, newError: string | null) {
  if (previousError === newError) return;
  const label = LABELS[source];
  if (!previousError && newError) {
    await notifyOwner(`⚠️ ${label}: ${newError}`);
  } else if (previousError && !newError) {
    await notifyOwner(`✅ ${label} virker igen.`);
  }
}

export async function recordSuccess(
  source: StatusSource,
  category: StatusCategory,
  extra: { plan?: string | null; detail?: Record<string, unknown> } = {},
) {
  const previousError = await getPreviousError(source);
  await supabase.from("integration_sync_state").upsert(
    {
      owner_id: env.ownerId,
      source,
      category,
      plan: extra.plan ?? null,
      detail: extra.detail ?? {},
      last_synced_at: new Date().toISOString(),
      last_error: null,
      last_error_at: null,
    },
    { onConflict: "owner_id,source" },
  );
  await notifyOnTransition(source, previousError, null);
}

export async function recordFailure(source: StatusSource, category: StatusCategory, message: string) {
  const previousError = await getPreviousError(source);
  await supabase.from("integration_sync_state").upsert(
    { owner_id: env.ownerId, source, category, last_error: message, last_error_at: new Date().toISOString() },
    { onConflict: "owner_id,source" },
  );
  await notifyOnTransition(source, previousError, message);
}
