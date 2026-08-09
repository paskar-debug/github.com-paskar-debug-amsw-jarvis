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
    shop: {
      customersCount: { count: number } | null;
    };
  };
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

export interface ShopifySummary {
  ordersToday: number;
  revenueToday: number;
  ordersLast7Days: number;
  revenueLast7Days: number;
  totalCustomers: number | null;
  currency: string | null;
}

/** Summarizes today's and this week's orders/revenue, plus total customers, and writes it as an amsw_status snapshot. */
export async function syncShopify(supabase: TypedSupabaseClient, ownerId: string, config: ShopifyConfig): Promise<ShopifySummary> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const query = `
    query OrdersRecent($queryString: String!) {
      orders(first: 100, query: $queryString) {
        edges { node { id createdAt totalPriceSet { shopMoney { amount currencyCode } } } }
      }
      shop {
        customersCount { count }
      }
    }
  `;

  const result = await shopifyGraphql<ShopifyOrdersResponse>(config, query, {
    queryString: `created_at:>='${sevenDaysAgo.toISOString()}'`,
  });

  const edges = result.data.orders.edges;
  const todayEdges = edges.filter((edge) => new Date(edge.node.createdAt) >= startOfDay);

  const sum = (list: typeof edges) => list.reduce((total, edge) => total + Number(edge.node.totalPriceSet.shopMoney.amount), 0);
  const currency = edges[0]?.node.totalPriceSet.shopMoney.currencyCode ?? null;

  const summary: ShopifySummary = {
    ordersToday: todayEdges.length,
    revenueToday: sum(todayEdges),
    ordersLast7Days: edges.length,
    revenueLast7Days: sum(edges),
    totalCustomers: result.data.shop.customersCount?.count ?? null,
    currency,
  };

  const { error } = await supabase.from("amsw_status").insert({
    owner_id: ownerId,
    area: "shopify",
    state: "green",
    note: `${summary.ordersToday} ordrer i dag`,
    metrics: { ...summary },
  });
  if (error) throw error;

  await supabase
    .from("integration_sync_state")
    .upsert(
      { owner_id: ownerId, source: "shopify", last_synced_at: new Date().toISOString(), last_error: null, last_error_at: null },
      { onConflict: "owner_id,source" },
    );

  return summary;
}
