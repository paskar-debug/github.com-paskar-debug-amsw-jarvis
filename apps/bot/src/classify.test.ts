import { describe, expect, it } from "vitest";
import { toClassifyResult } from "./classify.js";

describe("toClassifyResult", () => {
  it("maps a task classification", () => {
    expect(toClassifyResult({ kind: "task", title: "Køb mælk", starts_at: null, ends_at: null, category: null })).toEqual({
      kind: "task",
      title: "Køb mælk",
    });
  });

  it("maps an event classification with both timestamps", () => {
    expect(
      toClassifyResult({
        kind: "event",
        title: "Møde med Lars",
        starts_at: "2026-08-10T14:00:00+02:00",
        ends_at: "2026-08-10T15:00:00+02:00",
        category: null,
      }),
    ).toEqual({
      kind: "event",
      title: "Møde med Lars",
      startsAt: "2026-08-10T14:00:00+02:00",
      endsAt: "2026-08-10T15:00:00+02:00",
    });
  });

  it("falls back to a task when an event is missing starts_at/ends_at", () => {
    expect(toClassifyResult({ kind: "event", title: "Ufuldstændig aftale", starts_at: null, ends_at: null, category: null })).toEqual({
      kind: "task",
      title: "Ufuldstændig aftale",
    });
  });

  it("maps a delete_event classification, using title as the search query", () => {
    expect(
      toClassifyResult({ kind: "delete_event", title: "tandlægeaftalen", starts_at: null, ends_at: null, category: null }),
    ).toEqual({
      kind: "delete_event",
      query: "tandlægeaftalen",
    });
  });

  it("maps a delete_task classification, using title as the search query", () => {
    expect(
      toClassifyResult({ kind: "delete_task", title: "indkøbsopgaven", starts_at: null, ends_at: null, category: null }),
    ).toEqual({
      kind: "delete_task",
      query: "indkøbsopgaven",
    });
  });

  it("maps a draft classification", () => {
    expect(toClassifyResult({ kind: "draft", title: "", starts_at: null, ends_at: null, category: null })).toEqual({ kind: "draft" });
  });

  it("maps a fact classification with its category", () => {
    expect(
      toClassifyResult({ kind: "fact", title: "Brugerens kone hedder Maria", starts_at: null, ends_at: null, category: "familie" }),
    ).toEqual({
      kind: "fact",
      fact: "Brugerens kone hedder Maria",
      category: "familie",
    });
  });

  it("defaults a fact's category to 'andet' when Claude omits it", () => {
    expect(toClassifyResult({ kind: "fact", title: "Foretrækker korte svar", starts_at: null, ends_at: null, category: null })).toEqual({
      kind: "fact",
      fact: "Foretrækker korte svar",
      category: "andet",
    });
  });
});
