import { describe, expect, it, vi } from "vitest";
import { bucketDailyRevenue } from "./shopify.js";

function edge(createdAt: string, amount: string, currencyCode = "DKK") {
  return { node: { id: crypto.randomUUID(), createdAt, totalPriceSet: { presentmentMoney: { amount, currencyCode } } } };
}

describe("bucketDailyRevenue", () => {
  it("returns exactly 7 buckets, oldest first, even with no orders", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T12:00:00Z"));
    const buckets = bucketDailyRevenue([]);
    expect(buckets).toHaveLength(7);
    expect(buckets.every((b) => b.orders === 0 && b.revenue === 0)).toBe(true);
    expect(buckets[6].date).toBe("2026-08-09");
    expect(buckets[0].date).toBe("2026-08-03");
    vi.useRealTimers();
  });

  it("sums multiple orders on the same day into one bucket", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T20:00:00Z")); // 22:00 Copenhagen, still Aug 9 there
    const buckets = bucketDailyRevenue([edge("2026-08-09T08:00:00Z", "100.00"), edge("2026-08-09T09:00:00Z", "50.50")]);
    const today = buckets.find((b) => b.date === "2026-08-09");
    expect(today).toEqual({ date: "2026-08-09", orders: 2, revenue: 150.5 });
    vi.useRealTimers();
  });
});
