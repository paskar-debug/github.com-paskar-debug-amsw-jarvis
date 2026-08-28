import type { TypedSupabaseClient } from "@amsw/db";

export interface ShopifyConfig {
  storeDomain: string;
  adminApiToken: string;
  apiVersion: string;
}

interface ShopifyOrdersResponse {
  data: {
    orders: {
      edges: Array<{
        node: {
          id: string;
          createdAt: string;
          // A cancelled order keeps its original displayFinancialStatus (often still "PAID") -
          // cancelledAt is the only reliable signal that it shouldn't count toward real revenue.
          cancelledAt: string | null;
          // shopMoney is the shop's own reporting currency (EUR here) - orders from before a
          // currency change can carry a different shopMoney currency than today's setting, which
          // silently corrupts a naive sum across orders. presentmentMoney is what the customer
          // actually paid in their local market currency (DKK) and is what the goals/dashboard
          // should show - it's Shopify's own figure, not something we convert ourselves.
          totalPriceSet: { presentmentMoney: { amount: string; currencyCode: string } };
        };
      }>;
    };
  };
  errors?: Array<{ message: string }>;
}

interface ShopifyCustomersCountResponse {
  data: { customersCount: { count: number } };
  errors?: Array<{ message: string }>;
}

async function shopifyGraphql<T>(config: ShopifyConfig, query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await fetch(
    `https://${config.storeDomain}/admin/api/${config.apiVersion}/graphql.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": config.adminApiToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    },
  );
  if (!response.ok) {
    throw new Error(`Shopify API fejlede: ${response.status} ${await response.text()}`);
  }
  const json = (await response.json()) as T & { errors?: Array<{ message: string }> };
  if ("errors" in json && json.errors?.length) {
    throw new Error(`Shopify GraphQL fejl: ${json.errors.map((e) => e.message).join(", ")}`);
  }
  return json;
}

export interface ShopifyDailyBucket {
  date: string;
  orders: number;
  revenue: number;
}

export interface ShopifySummary {
  ordersToday: number;
  revenueToday: number;
  ordersLast7Days: number;
  revenueLast7Days: number;
  ordersLast14Days: number;
  revenueLast14Days: number;
  ordersLast30Days: number;
  revenueLast30Days: number;
  /** Most orders placed on any single Copenhagen calendar day within the last 30 days. */
  peakDayOrders: number;
  totalCustomers: number | null;
  currency: string | null;
  dailyRevenue: ShopifyDailyBucket[];
}

function copenhagenDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/** Buckets orders into the last 7 Copenhagen calendar days, filling in zero-order days so the trend line has no gaps. */
export function bucketDailyRevenue(edges: ShopifyOrdersResponse["data"]["orders"]["edges"]): ShopifyDailyBucket[] {
  const byDate = new Map<string, { orders: number; revenue: number }>();
  for (const edge of edges) {
    const key = copenhagenDateKey(edge.node.createdAt);
    const existing = byDate.get(key) ?? { orders: 0, revenue: 0 };
    existing.orders += 1;
    existing.revenue += Number(edge.node.totalPriceSet.presentmentMoney.amount);
    byDate.set(key, existing);
  }

  const days: ShopifyDailyBucket[] = [];
  for (let i = 6; i >= 0; i--) {
    const key = copenhagenDateKey(new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString());
    const bucket = byDate.get(key) ?? { orders: 0, revenue: 0 };
    days.push({ date: key, orders: bucket.orders, revenue: Math.round(bucket.revenue * 100) / 100 });
  }
  return days;
}

/** Summarizes today's/weekly/monthly orders/revenue, peak single-day orders, and total customers,
 *  and writes it as an amsw_status snapshot. Fetches a single 30-day order window and derives every
 *  narrower figure (today, 7 days) from it, rather than issuing a separate query per window. */
export async function syncShopify(supabase: TypedSupabaseClient, ownerId: string, config: ShopifyConfig): Promise<ShopifySummary> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const ordersQuery = `
    query OrdersRecent($queryString: String!) {
      orders(first: 250, query: $queryString) {
        edges { node { id createdAt cancelledAt totalPriceSet { presentmentMoney { amount currencyCode } } } }
      }
    }
  `;

  const result = await shopifyGraphql<ShopifyOrdersResponse>(config, ordersQuery, {
    queryString: `created_at:>='${thirtyDaysAgo.toISOString()}'`,
  });

  // A cancelled order stays in this result set (it still "created_at:>=X") but shouldn't count
  // toward orders/revenue anywhere below - it never became real business.
  const edges30d = result.data.orders.edges.filter((edge) => !edge.node.cancelledAt);
  const edges7d = edges30d.filter((edge) => new Date(edge.node.createdAt) >= sevenDaysAgo);
  const edges14d = edges30d.filter((edge) => new Date(edge.node.createdAt) >= fourteenDaysAgo);
  const todayEdges = edges30d.filter((edge) => new Date(edge.node.createdAt) >= startOfDay);

  // Rounded to 2 decimals - summing money as floating point otherwise leaves artifacts like
  // 857.9000000000001 from binary rounding, which showed up raw on the dashboard.
  const sum = (list: typeof edges30d) =>
    Math.round(list.reduce((total, edge) => total + Number(edge.node.totalPriceSet.presentmentMoney.amount), 0) * 100) / 100;
  // The most recent order's currency is the most representative "current" value if presentment
  // currency ever varies across orders (different customer markets) - not averaged/guessed.
  const currency = edges30d[edges30d.length - 1]?.node.totalPriceSet.presentmentMoney.currencyCode ?? null;

  const ordersPerDay = new Map<string, number>();
  for (const edge of edges30d) {
    const key = copenhagenDateKey(edge.node.createdAt);
    ordersPerDay.set(key, (ordersPerDay.get(key) ?? 0) + 1);
  }
  const peakDayOrders = Math.max(0, ...ordersPerDay.values());

  // Kræver `read_customers`-scope på Shopify-appen. Fejler den (fx manglende scope),
  // skal det ikke vælte selve ordre-synken - kundetal er en ekstra, ikke-kritisk stat.
  let totalCustomers: number | null = null;
  try {
    const customersResult = await shopifyGraphql<ShopifyCustomersCountResponse>(config, "{ customersCount { count } }");
    totalCustomers = customersResult.data.customersCount.count;
  } catch {
    totalCustomers = null;
  }

  const summary: ShopifySummary = {
    ordersToday: todayEdges.length,
    revenueToday: sum(todayEdges),
    ordersLast7Days: edges7d.length,
    revenueLast7Days: sum(edges7d),
    ordersLast14Days: edges14d.length,
    revenueLast14Days: sum(edges14d),
    ordersLast30Days: edges30d.length,
    revenueLast30Days: sum(edges30d),
    peakDayOrders,
    totalCustomers,
    currency,
    dailyRevenue: bucketDailyRevenue(edges7d),
  };

  const { error } = await supabase.from("amsw_status").insert({
    owner_id: ownerId,
    area: "shopify",
    state: "green",
    note: `${summary.ordersToday} ordrer i dag`,
    metrics: { ...summary },
  });
  if (error) throw error;

  return summary;
}
