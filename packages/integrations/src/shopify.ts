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
          totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
        };
      }>;
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

/** Summarizes today's orders/revenue and writes it as an amsw_status snapshot. */
export async function syncShopify(
  supabase: TypedSupabaseClient,
  ownerId: string,
  config: ShopifyConfig,
): Promise<{ ordersToday: number; revenueToday: number; currency: string | null }> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const query = `
    query OrdersToday($queryString: String!) {
      orders(first: 100, query: $queryString) {
        edges { node { id totalPriceSet { shopMoney { amount currencyCode } } } }
      }
    }
  `;

  const result = await shopifyGraphql<ShopifyOrdersResponse>(config, query, {
    queryString: `created_at:>='${startOfDay.toISOString()}'`,
  });

  const edges = result.data.orders.edges;
  const revenueToday = edges.reduce((sum, edge) => sum + Number(edge.node.totalPriceSet.shopMoney.amount), 0);
  const currency = edges[0]?.node.totalPriceSet.shopMoney.currencyCode ?? null;

  const { error } = await supabase.from("amsw_status").insert({
    owner_id: ownerId,
    area: "shopify",
    state: "green",
    note: `${edges.length} ordrer i dag`,
    metrics: { ordersToday: edges.length, revenueToday, currency },
  });
  if (error) throw error;

  await supabase
    .from("integration_sync_state")
    .upsert(
      { owner_id: ownerId, source: "shopify", last_synced_at: new Date().toISOString() },
      { onConflict: "owner_id,source" },
    );

  return { ordersToday: edges.length, revenueToday, currency };
}
