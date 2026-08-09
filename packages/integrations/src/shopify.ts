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
          totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
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
    existing.revenue += Number(edge.node.totalPriceSet.shopMoney.amount);
    byDate.set(key, existing);
  }

  const days: ShopifyDailyBucket[] = [];
  for (let i = 6; i >= 0; i--) {
    const key = copenhagenDateKey(new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString());
    const bucket = byDate.get(key) ?? { orders: 0, revenue: 0 };
    days.push({ date: key, ...bucket });
  }
  return days;
}

/** Summarizes today's and this week's orders/revenue, plus total customers, and writes it as an amsw_status snapshot. */
export async function syncShopify(supabase: TypedSupabaseClient, ownerId: string, config: ShopifyConfig): Promise<ShopifySummary> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const ordersQuery = `
    query OrdersRecent($queryString: String!) {
      orders(first: 100, query: $queryString) {
        edges { node { id createdAt totalPriceSet { shopMoney { amount currencyCode } } } }
      }
    }
  `;

  const result = await shopifyGraphql<ShopifyOrdersResponse>(config, ordersQuery, {
    queryString: `created_at:>='${sevenDaysAgo.toISOString()}'`,
  });

  const edges = result.data.orders.edges;
  const todayEdges = edges.filter((edge) => new Date(edge.node.createdAt) >= startOfDay);

  const sum = (list: typeof edges) => list.reduce((total, edge) => total + Number(edge.node.totalPriceSet.shopMoney.amount), 0);
  const currency = edges[0]?.node.totalPriceSet.shopMoney.currencyCode ?? null;

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
    ordersLast7Days: edges.length,
    revenueLast7Days: sum(edges),
    totalCustomers,
    currency,
    dailyRevenue: bucketDailyRevenue(edges),
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
