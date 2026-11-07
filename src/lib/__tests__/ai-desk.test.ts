import { describe, expect, test } from "bun:test";
import { aiLocation, aiSearch, showsConversation, type AiLocation } from "../ai-desk";

describe("the AI desk's URL", () => {
  test("reads a conversation, Dime's views, and a check-in opened from its list", () => {
    expect(aiLocation(null, null)).toEqual({ view: "chat", conversation: null });
    expect(aiLocation(null, "12")).toEqual({ view: "chat", conversation: 12 });
    expect(aiLocation("checkins", null)).toEqual({ view: "checkins", conversation: null });
    expect(aiLocation("checkins", "31")).toEqual({ view: "checkins", conversation: 31 });
    expect(aiLocation("memory", "12")).toEqual({ view: "memory", conversation: null });
    expect(aiLocation("results", null)).toEqual({ view: "results", conversation: null });
  });

  test("anything it doesn't know is a new conversation", () => {
    expect(aiLocation("chats", null)).toEqual({ view: "chat", conversation: null });
    for (const c of ["", "0", "-3", "1.5", "abc"]) expect(aiLocation(null, c).conversation).toBeNull();
  });

  test("writes each location back the way it reads", () => {
    const all: AiLocation[] = [
      { view: "chat", conversation: null },
      { view: "chat", conversation: 12 },
      { view: "checkins", conversation: null },
      { view: "checkins", conversation: 31 },
      { view: "memory", conversation: null },
      { view: "results", conversation: null },
    ];
    for (const loc of all) {
      const q = new URLSearchParams(aiSearch(loc));
      expect(aiLocation(q.get("v"), q.get("c"))).toEqual(loc);
    }
    expect(aiSearch({ view: "chat", conversation: null })).toBe("");
    expect(aiSearch({ view: "checkins", conversation: 31 })).toBe("?v=checkins&c=31");
  });

  test("shows a conversation for a chat or an opened check-in, a list otherwise", () => {
    expect(showsConversation({ view: "chat", conversation: null })).toBe(true);
    expect(showsConversation({ view: "checkins", conversation: 31 })).toBe(true);
    expect(showsConversation({ view: "checkins", conversation: null })).toBe(false);
    expect(showsConversation({ view: "memory", conversation: null })).toBe(false);
  });
});
