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
          // Orders placed through Shopify's "Bogus Gateway" test payment method (e.g. while trying
          // something out in the store admin) - never real business, exclude unconditionally.
          test: boolean;
          // A cancelled order keeps its original displayFinancialStatus (often still "PAID") -
          // cancelledAt is the only reliable signal that it shouldn't count toward real revenue.
          cancelledAt: string | null;
          // shopMoney is the shop's own reporting currency (EUR here) - orders from before a
          // currency change can carry a different shopMoney currency than today's setting, which
          // silently corrupts a naive sum across orders. presentmentMoney is what the customer
          // actually paid in their local market currency (DKK) and is what the goals/dashboard
          // should show - it's Shopify's own figure, not something we convert ourselves.
          totalPriceSet: { presentmentMoney: { amount: string; currencyCode: string } };
          // Money actually given back to the customer - a fully refunded order kept
          // displayFinancialStatus "REFUNDED" but its totalPriceSet still shows the original
          // amount, so without this a refund never reduces revenue at all.
          totalRefundedSet: { presentmentMoney: { amount: string } };
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

interface ShopifyLineItemsResponse {
  data: {
    orders: {
      edges: Array<{
        node: {
          test: boolean;
          cancelledAt: string | null;
          lineItems: {
            edges: Array<{
              node: {
                title: string;
                quantity: number;
                discountedTotalSet: { presentmentMoney: { amount: string } };
                variant: { inventoryItem: { unitCost: { amount: string } | null } } | null;
              };
            }>;
          };
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

export interface ShopifyDailyBucket {
  date: string;
  orders: number;
  revenue: number;
}

export interface ShopifyProductProfit {
  title: string;
  quantity: number;
  revenue: number;
  /** Null when cost-per-item isn't set in Shopify for every unit of this product sold in the
   *  window - showing a partial/averaged cost would be more misleading than showing nothing. */
  cost: number | null;
  profit: number | null;
  marginPercent: number | null;
}

export interface ShopifySummary {
  ordersToday: number;
  revenueToday: number;
  ordersLast7Days: number;
  revenueLast7Days: number;
  /** The 7 days before that - lets the dashboard show "vs. last week" instead of a bare number. */
  ordersPrevious7Days: number;
  revenuePrevious7Days: number;
  ordersLast14Days: number;
  revenueLast14Days: number;
  ordersLast30Days: number;
  revenueLast30Days: number;
  /** Most orders placed on any single Copenhagen calendar day within the last 30 days. */
  peakDayOrders: number;
  totalCustomers: number | null;
  currency: string | null;
  dailyRevenue: ShopifyDailyBucket[];
  /** Null when the app token doesn't have the read_products scope needed to see cost-per-item -
   *  not the same as an empty array (which would mean "no sales", a real and different state). */
  productProfitLast30Days: ShopifyProductProfit[] | null;
  /** Share of the last 30 days' line-item revenue that had a cost-per-item on file, 0-100. Lets
   *  the dashboard warn when profit figures are based on only a sliver of what was actually sold. */
  costDataCoveragePercent: number | null;
}

function copenhagenDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/** What the order is actually still worth after refunds - never below 0. Partial refunds reduce
 *  this without removing the order; a full refund brings it to 0 (the order is filtered out
 *  entirely before this is used, same as a cancelled one - see syncShopify). */
function netAmount(edge: ShopifyOrdersResponse["data"]["orders"]["edges"][number]): number {
  const total = Number(edge.node.totalPriceSet.presentmentMoney.amount);
  const refunded = Number(edge.node.totalRefundedSet.presentmentMoney.amount);
  return Math.max(0, total - refunded);
}

/** Buckets orders into the last 7 Copenhagen calendar days, filling in zero-order days so the trend line has no gaps. */
export function bucketDailyRevenue(edges: ShopifyOrdersResponse["data"]["orders"]["edges"]): ShopifyDailyBucket[] {
  const byDate = new Map<string, { orders: number; revenue: number }>();
  for (const edge of edges) {
    const key = copenhagenDateKey(edge.node.createdAt);
    const existing = byDate.get(key) ?? { orders: 0, revenue: 0 };
    existing.orders += 1;
    existing.revenue += netAmount(edge);
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

/** Per-product revenue, cost and margin over the window, from Shopify's own cost-per-item field -
 *  needs the read_products scope, which the app may not have. Kept as a fully separate query
 *  (not merged into the main orders query) so a missing scope only silently disables this one
 *  feature instead of throwing and taking down the whole sync - see shopifyGraphql's error
 *  handling, which throws on ANY GraphQL error in the response. Line-item revenue is gross (not
 *  reduced by order-level refunds) - refunds aren't broken out per line item, so per-product
 *  profit is a slight overestimate on orders with partial refunds; the aggregate revenue figures
 *  elsewhere in this file remain the refund-adjusted source of truth. */
async function fetchProductProfit(
  config: ShopifyConfig,
  since: Date,
): Promise<{ products: ShopifyProductProfit[]; coveragePercent: number } | null> {
  const query = `
    query OrdersLineItems($queryString: String!) {
      orders(first: 250, query: $queryString) {
        edges {
          node {
            test
            cancelledAt
            lineItems(first: 20) {
              edges {
                node {
                  title
                  quantity
                  discountedTotalSet { presentmentMoney { amount } }
                  variant { inventoryItem { unitCost { amount } } }
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const result = await shopifyGraphql<ShopifyLineItemsResponse>(config, query, {
      queryString: `created_at:>='${since.toISOString()}'`,
    });

    const byProduct = new Map<string, { quantity: number; revenue: number; cost: number; costedQuantity: number }>();
    let totalRevenue = 0;
    let costedRevenue = 0;

    for (const orderEdge of result.data.orders.edges) {
      if (orderEdge.node.test || orderEdge.node.cancelledAt) continue;
      for (const li of orderEdge.node.lineItems.edges) {
        const revenue = Number(li.node.discountedTotalSet.presentmentMoney.amount);
        totalRevenue += revenue;
        const existing = byProduct.get(li.node.title) ?? { quantity: 0, revenue: 0, cost: 0, costedQuantity: 0 };
        existing.quantity += li.node.quantity;
        existing.revenue += revenue;
        const unitCost = li.node.variant?.inventoryItem?.unitCost?.amount;
        if (unitCost != null) {
          existing.cost += Number(unitCost) * li.node.quantity;
          existing.costedQuantity += li.node.quantity;
          costedRevenue += revenue;
        }
        byProduct.set(li.node.title, existing);
      }
    }

    const products: ShopifyProductProfit[] = [...byProduct.entries()]
      .map(([title, v]) => {
        const hasFullCost = v.costedQuantity > 0 && v.costedQuantity === v.quantity;
        const cost = hasFullCost ? Math.round(v.cost * 100) / 100 : null;
        const profit = hasFullCost ? Math.round((v.revenue - v.cost) * 100) / 100 : null;
        const marginPercent = hasFullCost && v.revenue > 0 ? Math.round(((v.revenue - v.cost) / v.revenue) * 1000) / 10 : null;
        return { title, quantity: v.quantity, revenue: Math.round(v.revenue * 100) / 100, cost, profit, marginPercent };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const coveragePercent = totalRevenue > 0 ? Math.round((costedRevenue / totalRevenue) * 1000) / 10 : 0;
    return { products, coveragePercent };
  } catch {
    return null;
  }
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
        edges {
          node {
            id
            createdAt
            test
            cancelledAt
            totalPriceSet { presentmentMoney { amount currencyCode } }
            totalRefundedSet { presentmentMoney { amount } }
          }
        }
      }
    }
  `;

  const result = await shopifyGraphql<ShopifyOrdersResponse>(config, ordersQuery, {
    queryString: `created_at:>='${thirtyDaysAgo.toISOString()}'`,
  });

  // A cancelled or fully-refunded order stays in this result set (it still "created_at:>=X") but
  // shouldn't count toward orders/revenue anywhere below - neither one ended up as real business.
  // A partial refund keeps the order but reduces its counted amount (handled by netAmount).
  const edges30d = result.data.orders.edges.filter((edge) => !edge.node.test && !edge.node.cancelledAt && netAmount(edge) > 0);
  const edges7d = edges30d.filter((edge) => new Date(edge.node.createdAt) >= sevenDaysAgo);
  const edgesPrevious7d = edges30d.filter(
    (edge) => new Date(edge.node.createdAt) >= fourteenDaysAgo && new Date(edge.node.createdAt) < sevenDaysAgo,
  );
  const edges14d = edges30d.filter((edge) => new Date(edge.node.createdAt) >= fourteenDaysAgo);
  const todayEdges = edges30d.filter((edge) => new Date(edge.node.createdAt) >= startOfDay);

  // Rounded to 2 decimals - summing money as floating point otherwise leaves artifacts like
  // 857.9000000000001 from binary rounding, which showed up raw on the dashboard.
  const sum = (list: typeof edges30d) => Math.round(list.reduce((total, edge) => total + netAmount(edge), 0) * 100) / 100;
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

  const productProfit = await fetchProductProfit(config, thirtyDaysAgo);

  const summary: ShopifySummary = {
    ordersToday: todayEdges.length,
    revenueToday: sum(todayEdges),
    ordersLast7Days: edges7d.length,
    revenueLast7Days: sum(edges7d),
    ordersPrevious7Days: edgesPrevious7d.length,
    revenuePrevious7Days: sum(edgesPrevious7d),
    ordersLast14Days: edges14d.length,
    revenueLast14Days: sum(edges14d),
    ordersLast30Days: edges30d.length,
    revenueLast30Days: sum(edges30d),
    peakDayOrders,
    totalCustomers,
    currency,
    dailyRevenue: bucketDailyRevenue(edges7d),
    productProfitLast30Days: productProfit?.products ?? null,
    costDataCoveragePercent: productProfit?.coveragePercent ?? null,
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
