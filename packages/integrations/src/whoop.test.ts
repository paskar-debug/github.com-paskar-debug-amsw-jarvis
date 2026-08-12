import { describe, expect, it } from "vitest";
import { computeSleepDurationHours, recoveryState } from "./whoop.js";

describe("computeSleepDurationHours", () => {
  it("sums light + slow-wave + REM, excluding awake/no-data time", () => {
    const hours = computeSleepDurationHours({
      total_light_sleep_time_milli: 3 * 3_600_000,
      total_slow_wave_sleep_time_milli: 1.5 * 3_600_000,
      total_rem_sleep_time_milli: 2 * 3_600_000,
    });
    expect(hours).toBe(6.5);
  });

  it("returns null when there's no stage summary yet (unscored night)", () => {
    expect(computeSleepDurationHours(null)).toBeNull();
    expect(computeSleepDurationHours(undefined)).toBeNull();
  });
});

describe("recoveryState", () => {
  it("maps Whoop's own thresholds: green >=67, yellow 34-66, red <34", () => {
    expect(recoveryState(90)).toBe("green");
    expect(recoveryState(67)).toBe("green");
    expect(recoveryState(66)).toBe("yellow");
    expect(recoveryState(34)).toBe("yellow");
    expect(recoveryState(33)).toBe("red");
    expect(recoveryState(0)).toBe("red");
  });

  it("treats an unscored night (null) as yellow (unknown), not red (bad)", () => {
    expect(recoveryState(null)).toBe("yellow");
  });
});
