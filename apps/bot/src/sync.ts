import { syncGoogleCalendar, syncShopify, syncTodoist } from "@amsw/integrations";
import { env } from "./env.js";
import { supabase } from "./supabase.js";

export interface SyncSummary {
  googleCalendar?: number;
  todoist?: number;
  shopify?: { ordersToday: number; revenueToday: number };
  errors: string[];
}

export async function syncAll(): Promise<SyncSummary> {
  const summary: SyncSummary = { errors: [] };

  if (env.google.refreshToken && env.google.clientId) {
    try {
      summary.googleCalendar = await syncGoogleCalendar(supabase, env.ownerId, env.google);
    } catch (err) {
      summary.errors.push(`Google Kalender: ${(err as Error).message}`);
    }
  }

  if (env.todoist.apiToken) {
    try {
      summary.todoist = await syncTodoist(supabase, env.ownerId, env.todoist);
    } catch (err) {
      summary.errors.push(`Todoist: ${(err as Error).message}`);
    }
  }

  if (env.shopify.storeDomain && env.shopify.adminApiToken) {
    try {
      summary.shopify = await syncShopify(supabase, env.ownerId, env.shopify);
    } catch (err) {
      summary.errors.push(`Shopify: ${(err as Error).message}`);
    }
  }

  return summary;
}
