import { syncGoogleCalendar, syncShopify, syncTodoist, syncWhoop, type ShopifySummary, type WhoopSummary } from "@amsw/integrations";
import { env } from "./env.js";
import { supabase } from "./supabase.js";
import { recordFailure, recordSuccess } from "./statusStore.js";
import { updateGoalsFromShopify } from "./goalsAutoUpdate.js";

export interface SyncSummary {
  googleCalendar?: number;
  todoist?: number;
  shopify?: ShopifySummary;
  whoop?: WhoopSummary;
  errors: string[];
}

// Whoop's refresh token is single-use and rotates on every call - two overlapping syncs (a manual
// /sync landing mid-interval, or two processes briefly alive during a redeploy) can race, and the
// loser is left holding an already-invalidated token. Serializing calls within this process closes
// the common case; it can't prevent a race across two separate processes.
let inFlight: Promise<SyncSummary> | null = null;

export async function syncAll(): Promise<SyncSummary> {
  if (inFlight) return inFlight;
  inFlight = runSync();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

async function runSync(): Promise<SyncSummary> {
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

  if (env.todoist.apiToken) {
    try {
      summary.todoist = await syncTodoist(supabase, env.ownerId, env.todoist);
      await recordSuccess("todoist", "integration");
    } catch (err) {
      const message = (err as Error).message;
      summary.errors.push(`Todoist: ${message}`);
      await recordFailure("todoist", "integration", message);
    }
  }

  if (env.shopify.storeDomain && env.shopify.adminApiToken) {
    try {
      summary.shopify = await syncShopify(supabase, env.ownerId, env.shopify);
      await recordSuccess("shopify", "integration");
      await updateGoalsFromShopify(summary.shopify);
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
