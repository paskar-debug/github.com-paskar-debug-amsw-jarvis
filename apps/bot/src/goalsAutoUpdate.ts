import type { ShopifySummary } from "@amsw/integrations";
import { supabase } from "./supabase.js";
import { env } from "./env.js";

// DKK is ERM II-pegged to EUR by Danmarks Nationalbank, held within a narrow band around this
// rate for decades - a fixed constant is accurate enough as a fallback without an extra FX API
// call, for the unlikely case a sync's revenue ever comes back in EUR instead of DKK.
const EUR_TO_DKK = 7.46;

/** Metric keys a goal's `metric_key` column can reference - each maps to one live, computed
 *  number. Extend this map (and the goal's metric_key/metric_target) to auto-track a new goal;
 *  a goal with no metric_key stays fully manual, updated only via /maal_fremgang or the dashboard. */
function metricValues(summary: ShopifySummary): Record<string, number> {
  // revenueLast30Days is already presentmentMoney - the amount customers actually paid, in DKK
  // for this shop's market - so normally no conversion at all, not even by the fixed rate above.
  const dkkFactor = summary.currency === "EUR" ? EUR_TO_DKK : 1;
  return {
    shopify_orders_7d: summary.ordersLast7Days,
    shopify_orders_30d: summary.ordersLast30Days,
    shopify_orders_1d_peak: summary.peakDayOrders,
    shopify_customers: summary.totalCustomers ?? 0,
    shopify_revenue_30d_dkk: summary.revenueLast30Days * dkkFactor,
  };
}

/** Updates progress on every active goal that has a metric_key, using the latest Shopify sync
 *  results. Called after each Shopify sync so goal progress never drifts stale between /maal_fremgang
 *  updates - the whole point being the user shouldn't have to keep these current by hand. */
export async function updateGoalsFromShopify(summary: ShopifySummary): Promise<void> {
  const { data: goals, error } = await supabase
    .from("goals")
    .select("id, progress, metric_key, metric_target")
    .eq("owner_id", env.ownerId)
    .eq("status", "active")
    .not("metric_key", "is", null);
  if (error) throw error;
  if (!goals || goals.length === 0) return;

  const values = metricValues(summary);

  for (const goal of goals) {
    if (!goal.metric_key || !goal.metric_target) continue;
    const current = values[goal.metric_key];
    if (current === undefined) continue;

    const progress = Math.max(0, Math.min(100, Math.round((current / goal.metric_target) * 100)));
    if (progress === goal.progress) continue;

    const status = progress >= 100 ? "done" : "active";
    const { error: updateError } = await supabase.from("goals").update({ progress, status }).eq("id", goal.id);
    if (updateError) throw updateError;
  }
}
