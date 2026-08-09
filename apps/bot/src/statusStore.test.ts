import { describe, expect, it } from "vitest";
import { transitionMessage } from "./statusStore.js";

describe("transitionMessage", () => {
  it("returns null when there was no error and still isn't one", () => {
    expect(transitionMessage("openai", null, null)).toBeNull();
  });

  it("returns null when the same error persists across checks (no repeat spam)", () => {
    expect(transitionMessage("openai", "ingen credits", "ingen credits")).toBeNull();
  });

  it("warns on an ok -> fejl transition", () => {
    expect(transitionMessage("openai", null, "ingen credits")).toBe("⚠️ OpenAI: ingen credits");
  });

  it("confirms recovery on a fejl -> ok transition", () => {
    expect(transitionMessage("shopify", "boom", null)).toBe("✅ Shopify virker igen.");
  });

  it("stays quiet when the error text changes but it's still in an error state (no double-alert)", () => {
    expect(transitionMessage("railway", "first error", "second error")).toBeNull();
  });
});
