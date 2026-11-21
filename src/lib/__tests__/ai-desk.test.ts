import { describe, expect, test } from "bun:test";
import { aiLocation, aiSearch, draftsRedirect, nextExpand, type AiLocation } from "../ai-desk";

describe("the AI desk's URL", () => {
  test("reads the left pane, the open conversation and the day", () => {
    expect(aiLocation(null, null)).toEqual({ view: "timeline", conversation: null, day: null });
    expect(aiLocation(null, "12")).toEqual({ view: "timeline", conversation: 12, day: null });
    expect(aiLocation("notebook", null)).toEqual({ view: "notebook", conversation: null, day: null });
    expect(aiLocation("results", "7", "2026-11-19")).toEqual({ view: "results", conversation: 7, day: "2026-11-19" });
    expect(aiLocation(null, null, "2026-11-19")).toEqual({ view: "timeline", conversation: null, day: "2026-11-19" });
  });

  test("the old desk's links land on the closest place, a check-in still opening in the chat", () => {
    expect(aiLocation("checkins", null)).toEqual({ view: "timeline", conversation: null, day: null });
    expect(aiLocation("checkins", "31")).toEqual({ view: "timeline", conversation: 31, day: null });
    expect(aiLocation("moves", null).view).toBe("timeline");
    expect(aiLocation("memory", null).view).toBe("notebook");
    expect(aiLocation("results", null).view).toBe("results");
  });

  test("anything it doesn't know is today's timeline and a new conversation", () => {
    expect(aiLocation("chats", null)).toEqual({ view: "timeline", conversation: null, day: null });
    for (const c of ["", "0", "-3", "1.5", "abc"]) expect(aiLocation(null, c).conversation).toBeNull();
    for (const d of ["", "today", "2026-13-01", "2026-02-30", "2026-1-5", "20261119"]) expect(aiLocation(null, null, d).day).toBeNull();
  });

  test("writes each location back the way it reads", () => {
    const all: AiLocation[] = [
      { view: "timeline", conversation: null, day: null },
      { view: "timeline", conversation: 12, day: null },
      { view: "timeline", conversation: 31, day: "2026-11-19" },
      { view: "notebook", conversation: null, day: null },
      { view: "results", conversation: 4, day: null },
    ];
    for (const loc of all) {
      const q = new URLSearchParams(aiSearch(loc));
      expect(aiLocation(q.get("v"), q.get("c"), q.get("d"))).toEqual(loc);
    }
    expect(aiSearch({ view: "timeline", conversation: null, day: null })).toBe("");
    expect(aiSearch({ view: "timeline", conversation: 31, day: "2026-11-19" })).toBe("?d=2026-11-19&c=31");
    expect(aiSearch({ view: "notebook", conversation: null, day: null })).toBe("?v=notebook");
  });

  test("an old Draft notes link goes to the note's conversation, or to the Draft desk's rooms", () => {
    expect(draftsRedirect("drafts", "40", "/draft", "/ai")).toBe("/ai?c=40");
    expect(draftsRedirect("drafts", null, "/draft", "/ai")).toBe("/draft");
    expect(draftsRedirect("drafts", "x", "/draft", "/ai")).toBe("/draft");
    expect(draftsRedirect("checkins", "40", "/draft", "/ai")).toBeNull();
    expect(draftsRedirect(null, null, "/draft", "/ai")).toBeNull();
  });

  test("E goes split, timeline alone, chat alone, split", () => {
    expect(nextExpand("none")).toBe("timeline");
    expect(nextExpand("timeline")).toBe("chat");
    expect(nextExpand("chat")).toBe("none");
  });
});
