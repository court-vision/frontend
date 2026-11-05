import { describe, expect, test } from "bun:test";
import { agreement, checkinLine, decisionKicker, reasonWords, verdictOf, withVerdict } from "../ai-checkins";
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
    ...over,
  };
}

describe("a check-in's row", () => {
  test("says its calls, changes, verdicts and cost", () => {
    expect(checkinLine(checkin())).toBe("3 calls · 1 change · 2 agree · $0.41");
    expect(checkinLine(checkin({ agree: 1, disagree: 1 }))).toBe("3 calls · 1 change · 1 agree, 1 disagree · $0.41");
    expect(checkinLine(checkin({ agree: 0, changes: 0 }))).toBe("3 calls · not rated · $0.41");
  });

  test("says why one didn't run, or didn't finish", () => {
    expect(checkinLine(checkin({ state: "missed", reason: "window_closed" }))).toBe(
      "Missed: its window closed before it could run"
    );
    expect(checkinLine(checkin({ state: "skipped", reason: "budget" }))).toBe("Skipped: this month's check-in budget is used up");
    expect(checkinLine(checkin({ state: "failed", reason: "AI_TIMEOUT", decisions: 1, changes: 0, agree: 0 }))).toBe(
      "Failed: it took too long · 1 call · not rated · $0.41"
    );
    expect(checkinLine(checkin({ state: "running" }))).toBe("Running…");
    expect(reasonWords("SOMETHING_NEW")).toBe("something new");
  });

  test("agreement counts only the rated calls", () => {
    expect(agreement([checkin(), checkin({ agree: 1, disagree: 2 }), checkin({ agree: 0 })])).toEqual({ agree: 3, rated: 5 });
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

describe("a shadow chip", () => {
  test("is never stageable, expired or not", () => {
    const chip = { proposal_id: 9, state: "shadow", expires_at: "2026-11-10T00:00:00Z", team_id: 23 } as AiProposalChip;
    expect(chipState(chip, Date.parse("2026-11-11T00:00:00Z"))).toBe("shadow");
    expect(stageProblem(chip, [])).toContain("can't be sent");
  });
});
