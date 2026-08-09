import { describe, expect, it } from "vitest";
import { formatBriefing, type BriefingData } from "./briefing.js";

const empty: BriefingData = { events: [], openTasks: [], statusByArea: [], activeErrors: [] };

describe("formatBriefing", () => {
  it("says there's nothing on when the day is empty", () => {
    const text = formatBriefing(empty);
    expect(text).toContain("Ingen aftaler i dag.");
    expect(text).toContain("Ingen åbne opgaver.");
  });

  it("sorts open tasks by priority (p1 first)", () => {
    const text = formatBriefing({
      ...empty,
      openTasks: [
        { title: "Lav mindre vigtigt", priority: "p3" },
        { title: "Ring til revisor", priority: "p1" },
        { title: "Sortér post", priority: "p2" },
      ],
    });
    const ringIndex = text.indexOf("Ring til revisor");
    const sorterIndex = text.indexOf("Sortér post");
    const lavIndex = text.indexOf("Lav mindre vigtigt");
    expect(ringIndex).toBeGreaterThan(-1);
    expect(ringIndex).toBeLessThan(sorterIndex);
    expect(sorterIndex).toBeLessThan(lavIndex);
  });

  it("caps the task list at 8 and notes the overflow count", () => {
    const openTasks = Array.from({ length: 11 }, (_, i) => ({ title: `Opgave ${i}`, priority: "p4" }));
    const text = formatBriefing({ ...empty, openTasks });
    expect(text).toContain("…og 3 mere.");
  });

  it("surfaces active integration/infra errors so they can't be missed", () => {
    const text = formatBriefing({ ...empty, activeErrors: [{ source: "openai", error: "ingen credits" }] });
    expect(text).toContain("Kræver opmærksomhed");
    expect(text).toContain("OpenAI: ingen credits");
  });

  it("omits the attention section entirely when nothing is broken", () => {
    const text = formatBriefing(empty);
    expect(text).not.toContain("Kræver opmærksomhed");
  });
});
