import { syncGoogleCalendar, syncShopify, syncWhoop, type ShopifySummary, type WhoopSummary } from "@amsw/integrations";
import { env } from "./env.js";
import { supabase } from "./supabase.js";
import { recordFailure, recordSuccess } from "./statusStore.js";

export interface SyncSummary {
  googleCalendar?: number;
  shopify?: ShopifySummary;
  whoop?: WhoopSummary;
  errors: string[];
}

export async function syncAll(): Promise<SyncSummary> {
  const summary: SyncSummary = { errors: [] };

  if (env.google.refreshToken && env.google.clientId) {
    try {
      summary.googleCalendar = await syncGoogleCalendar(supabase, env.ownerId, env.google);
      await recordSuccess("google_calendar", "integration");
    } catch (err) {
      const message = (err as Error).message;
      summary.errors.push(`Google Kalender: ${message}`);
      await recordFailure("google_calendar", "integration", message);
    }
  }

  if (env.shopify.storeDomain && env.shopify.adminApiToken) {
    try {
      summary.shopify = await syncShopify(supabase, env.ownerId, env.shopify);
      await recordSuccess("shopify", "integration");
    } catch (err) {
      const message = (err as Error).message;
      summary.errors.push(`Shopify: ${message}`);
      await recordFailure("shopify", "integration", message);
    }
  }

  if (env.whoop.clientId && env.whoop.clientSecret) {
    try {
      summary.whoop = await syncWhoop(supabase, env.ownerId, env.whoop);
      await recordSuccess("whoop", "integration");
    } catch (err) {
      const message = (err as Error).message;
      summary.errors.push(`Whoop: ${message}`);
      await recordFailure("whoop", "integration", message);
    }
  }

  return summary;
}
