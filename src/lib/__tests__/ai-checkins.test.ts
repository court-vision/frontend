import { describe, expect, test } from "bun:test";
import { KIND_LABEL, VerdictSaves, decisionKicker, eventsShown, reasonWords, verdictOf, withVerdict } from "../ai-checkins";
import { stateLine } from "../ai-timeline";
import { chipState, stageProblem } from "../ai-proposals";
import type { AiCheckin, AiConversation, AiProposalChip } from "@/types/ai";

function checkin(over: Partial<AiCheckin> = {}): AiCheckin {
  return {
    checkin_id: 7,
    team_id: 23,
    kind: "morning",
    date: "2026-11-10",
    manual: false,
    state: "done",
    reason: null,
    due_at: "2026-11-10T14:00:00Z",
    started_at: "2026-11-10T14:00:05Z",
    finished_at: "2026-11-10T14:03:00Z",
    conversation_id: 31,
    title: "Morning check-in · Tue Nov 10",
    cost_usd: 0.41,
    decisions: 3,
    changes: 1,
    agree: 2,
    disagree: 0,
    sent: 0,
    events: [],
    ...over,
  };
}

function event(n: number, source: "availability" | "news" = "news") {
  return {
    source,
    player_id: 1628973 + n,
    summary: `Item ${n}`,
    received_at: "2026-11-10T22:00:00Z",
    verdict: source === "availability" ? "out" : null,
    news_id: source === "news" ? n : null,
  };
}

describe("a check-in that didn't run", () => {
  test("says why, or why it didn't finish", () => {
    expect(stateLine(checkin({ state: "missed", reason: "window_closed" }))).toBe("Missed: its window closed before it could run");
    expect(stateLine(checkin({ state: "skipped", reason: "budget" }))).toBe("Skipped: this month's check-in budget is used up");
    expect(stateLine(checkin({ state: "failed", reason: "AI_TIMEOUT" }))).toBe("Failed: it took too long");
    expect(reasonWords("SOMETHING_NEW")).toBe("something new");
  });
});

describe("a decision", () => {
  test("names the automation whose plan it reviewed", () => {
    expect(decisionKicker({ area: "lineup", automation: "auto_lineup" })).toBe("Lineup · auto-lineup's fill");
    expect(decisionKicker({ area: "adds_drops", automation: "none" })).toBe("Adds and drops");
  });
});

describe("a verdict in a cached conversation", () => {
  const decision = (decision_id: number, verdict: "agree" | "disagree" | null) => ({
    kind: "block",
    block: { type: "decision", id: `d${decision_id}`, decision_id, verdict },
  });
  const conv = {
    history: [
      { parts: [{ kind: "text", text: "Two calls" }, decision(1, null), decision(2, "agree")] },
      { parts: [{ kind: "text", text: "A follow-up" }] },
    ],
  } as unknown as AiConversation;

  test("reads one call's verdict, or says the call isn't there", () => {
    expect(verdictOf(conv, 1)).toBeNull();
    expect(verdictOf(conv, 2)).toBe("agree");
    expect(verdictOf(conv, 9)).toBeUndefined();
  });

  test("sets one call's verdict and leaves the others as they were", () => {
    // Rate call 1, then call 2; call 1's save fails: putting it back keeps call 2's new verdict
    const rated = withVerdict(withVerdict(conv, 1, "disagree"), 2, "disagree");
    const rolledBack = withVerdict(rated, 1, null);
    expect(verdictOf(rolledBack, 1)).toBeNull();
    expect(verdictOf(rolledBack, 2)).toBe("disagree");
    expect(verdictOf(conv, 1)).toBeNull(); // the original is untouched
  });
});

describe("verdict saves in flight", () => {
  test("an older save failing after a newer one on the same call puts nothing back", () => {
    const saves = new VerdictSaves();
    const agree = saves.start(1);
    const disagree = saves.start(1);
    expect(saves.settle()).toBe(false); // Disagree saved
    expect(saves.isNewest(1, agree)).toBe(false); // Agree fails: Disagree stays
    expect(saves.isNewest(1, disagree)).toBe(true);
    expect(saves.settle()).toBe(true); // nothing left in flight: read the conversation again
  });

  test("saves on two calls each stay the newest on their own call", () => {
    const saves = new VerdictSaves();
    const one = saves.start(1);
    const two = saves.start(2);
    expect(saves.isNewest(1, one)).toBe(true);
    expect(saves.isNewest(2, two)).toBe(true);
    saves.settle();
    expect(saves.settle()).toBe(true);
    // Numbers keep counting, so a save from before can never pass for a later one
    expect(saves.isNewest(1, saves.start(1))).toBe(true);
    expect(saves.isNewest(1, one)).toBe(false);
  });
});

describe("a shadow chip", () => {
  test("is never stageable, expired or not", () => {
    const chip = { proposal_id: 9, state: "shadow", expires_at: "2026-11-10T00:00:00Z", team_id: 23 } as AiProposalChip;
    expect(chipState(chip, Date.parse("2026-11-11T00:00:00Z"))).toBe("shadow");
    expect(stageProblem(chip, [])).toContain("can't be sent");
  });
});

describe("an event check-in", () => {
  test("is labelled", () => {
    expect(KIND_LABEL.event).toBe("Event");
  });

  test("one with nothing left to take says why it was skipped", () => {
    expect(stateLine(checkin({ kind: "event", state: "skipped", reason: "no_events" }))).toBe(
      "Skipped: the news it was for went to another check-in"
    );
  });

  test("its row shows the first three, then how many more", () => {
    const { shown, more } = eventsShown(checkin({ events: [1, 2, 3, 4, 5].map((n) => event(n)) }));
    expect(shown.map((e) => e.summary)).toEqual(["Item 1", "Item 2", "Item 3"]);
    expect(more).toBe(2);
    expect(eventsShown(checkin())).toEqual({ shown: [], more: 0 });
  });
});
