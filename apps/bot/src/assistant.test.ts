import { describe, expect, it } from "vitest";
import { extractText } from "./assistant.js";

describe("extractText", () => {
  it("joins multiple text blocks with newlines", () => {
    expect(extractText([{ type: "text", text: "Hej" }, { type: "text", text: "der" }])).toBe("Hej\nder");
  });

  it("ignores non-text blocks like tool_use", () => {
    expect(
      extractText([
        { type: "tool_use", id: "1", name: "create_task", input: { title: "x" } },
        { type: "text", text: "Opgave oprettet." },
      ]),
    ).toBe("Opgave oprettet.");
  });

  it("returns an empty string when there's no text block", () => {
    expect(extractText([{ type: "tool_use", id: "1", name: "create_task", input: {} }])).toBe("");
  });
});
