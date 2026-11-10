import { describe, expect, test } from "bun:test";
import { aiLocation, aiSearch, holdsConversation, showsConversation, viewOfKind, type AiLocation } from "../ai-desk";

describe("the AI desk's URL", () => {
  test("reads a conversation, Dime's views, and a check-in opened from its list", () => {
    expect(aiLocation(null, null)).toEqual({ view: "chat", conversation: null });
    expect(aiLocation(null, "12")).toEqual({ view: "chat", conversation: 12 });
    expect(aiLocation("checkins", null)).toEqual({ view: "checkins", conversation: null });
    expect(aiLocation("checkins", "31")).toEqual({ view: "checkins", conversation: 31 });
    expect(aiLocation("memory", "12")).toEqual({ view: "memory", conversation: null });
    expect(aiLocation("results", null)).toEqual({ view: "results", conversation: null });
    expect(aiLocation("moves", "7")).toEqual({ view: "moves", conversation: null });
    expect(aiLocation("drafts", null)).toEqual({ view: "drafts", conversation: null });
    expect(aiLocation("drafts", "40")).toEqual({ view: "drafts", conversation: 40 });
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
      { view: "moves", conversation: null },
      { view: "memory", conversation: null },
      { view: "results", conversation: null },
      { view: "drafts", conversation: null },
      { view: "drafts", conversation: 40 },
    ];
    for (const loc of all) {
      const q = new URLSearchParams(aiSearch(loc));
      expect(aiLocation(q.get("v"), q.get("c"))).toEqual(loc);
    }
    expect(aiSearch({ view: "chat", conversation: null })).toBe("");
    expect(aiSearch({ view: "checkins", conversation: 31 })).toBe("?v=checkins&c=31");
    expect(aiSearch({ view: "moves", conversation: null })).toBe("?v=moves");
    expect(aiSearch({ view: "drafts", conversation: 40 })).toBe("?v=drafts&c=40");
  });

  test("shows a conversation for a chat or an opened check-in, a list otherwise", () => {
    expect(showsConversation({ view: "chat", conversation: null })).toBe(true);
    expect(showsConversation({ view: "checkins", conversation: 31 })).toBe(true);
    expect(showsConversation({ view: "checkins", conversation: null })).toBe(false);
    expect(showsConversation({ view: "memory", conversation: null })).toBe(false);
    expect(showsConversation({ view: "drafts", conversation: 40 })).toBe(true);
    expect(showsConversation({ view: "drafts", conversation: null })).toBe(false);
  });

  test("a conversation opens under the section of its kind", () => {
    expect(viewOfKind("checkin")).toBe("checkins");
    expect(viewOfKind("draft")).toBe("drafts");
    expect(viewOfKind("chat")).toBe("chat");
    expect(viewOfKind(undefined)).toBe("chat");
    expect(["chat", "checkins", "drafts"].every((v) => holdsConversation(v as AiLocation["view"]))).toBe(true);
    expect(holdsConversation("memory")).toBe(false);
  });
});
