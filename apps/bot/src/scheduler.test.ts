import { describe, expect, it } from "vitest";
import { msUntilNextLocalTime } from "./scheduler.js";

describe("msUntilNextLocalTime", () => {
  it("schedules later today when the target time hasn't passed yet", () => {
    // 05:00 UTC = 07:00 Europe/Copenhagen in August (summer time, UTC+2)
    const now = new Date("2026-08-09T05:00:00Z");
    const ms = msUntilNextLocalTime(9, 0, "Europe/Copenhagen", now);
    expect(ms).toBe(2 * 60 * 60 * 1000);
  });

  it("rolls over to tomorrow when the target time already passed today", () => {
    const now = new Date("2026-08-09T10:00:00Z"); // 12:00 Copenhagen
    const ms = msUntilNextLocalTime(9, 0, "Europe/Copenhagen", now);
    expect(ms).toBe(21 * 60 * 60 * 1000);
  });

  it("returns a full day, not zero, when now is exactly the target time", () => {
    const now = new Date("2026-08-09T05:00:00Z"); // exactly 07:00 Copenhagen
    const ms = msUntilNextLocalTime(7, 0, "Europe/Copenhagen", now);
    expect(ms).toBe(24 * 60 * 60 * 1000);
  });
});
