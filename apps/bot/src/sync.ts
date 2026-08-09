import { syncGoogleCalendar, syncShopify, type ShopifySummary } from "@amsw/integrations";
import { env } from "./env.js";
import { supabase } from "./supabase.js";

export interface SyncSummary {
  googleCalendar?: number;
  shopify?: ShopifySummary;
  errors: string[];
}

async function recordError(source: "google_calendar" | "shopify", message: string) {
  await supabase.from("integration_sync_state").upsert(
    { owner_id: env.ownerId, source, last_error: message, last_error_at: new Date().toISOString() },
    { onConflict: "owner_id,source" },
  );
}

export async function syncAll(): Promise<SyncSummary> {
  const summary: SyncSummary = { errors: [] };

  if (env.google.refreshToken && env.google.clientId) {
    try {
      summary.googleCalendar = await syncGoogleCalendar(supabase, env.ownerId, env.google);
    } catch (err) {
      const message = (err as Error).message;
      summary.errors.push(`Google Kalender: ${message}`);
      await recordError("google_calendar", message);
    }
  }

  if (env.shopify.storeDomain && env.shopify.adminApiToken) {
    try {
      summary.shopify = await syncShopify(supabase, env.ownerId, env.shopify);
    } catch (err) {
      const message = (err as Error).message;
      summary.errors.push(`Shopify: ${message}`);
      await recordError("shopify", message);
    }
  }

  return summary;
}
