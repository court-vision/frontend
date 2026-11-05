import { describe, expect, test } from "bun:test";
import { demoDimeChange, demoDimeTeams } from "../account-demo";
import { actionLine, autonomyLine, checkinBanner, effectiveOf, heldBack, modeOf, pauseLine, policyLine } from "../ai-autonomy";
import type { AiActingPolicy, AiAutonomy, AiConversation } from "@/types/ai";

function autonomy(over: Partial<AiAutonomy> = {}): AiAutonomy {
  return {
    mode: "shadow",
    own: { lineup: null, streaming: null, adds_drops: null },
    effective: { lineup: "shadow", streaming: "shadow", adds_drops: "shadow" },
    ...over,
  };
}

describe("a team's modes", () => {
  test("a kind follows the team's unless it has its own", () => {
    const a = autonomy({ mode: "suggest", own: { lineup: null, streaming: null, adds_drops: "act" } });
    expect(modeOf(a, "lineup")).toBe("suggest");
    expect(modeOf(a, "adds_drops")).toBe("act");
  });

  test("the line names the team's mode, then any kind that differs", () => {
    expect(autonomyLine(autonomy())).toBe("Shadow");
    expect(autonomyLine(autonomy({ mode: "act" }))).toBe("Act");
    expect(autonomyLine(autonomy({ mode: "suggest", own: { lineup: "suggest", streaming: "shadow", adds_drops: "act" } }))).toBe(
      "Suggest · streaming shadow, adds and drops act"
    );
  });

  test("says why a kind does less than it is set to", () => {
    const off = autonomy({ mode: "act", effective: { lineup: "suggest", streaming: "suggest", adds_drops: "suggest" } });
    expect(heldBack(off, "lineup", false)).toBe("Suggests until acting is switched on");
    expect(heldBack(off, "lineup", true)).toBe("Paused, so in shadow until you resume it");
    expect(heldBack(autonomy(), "lineup", true)).toBeNull();
    const on = autonomy({ mode: "act", effective: { lineup: "act", streaming: "act", adds_drops: "act" } });
    expect(heldBack(on, "streaming", false)).toBeNull();
  });

  test("a pause Dime made itself says why", () => {
    expect(pauseLine({ paused_at: null, paused_by: null, paused_reason: null })).toBeNull();
    expect(pauseLine({ paused_at: "2026-11-10T20:00:00Z", paused_by: "user", paused_reason: null })).toBe("Paused");
    expect(pauseLine({ paused_at: "2026-11-10T20:00:00Z", paused_by: "system", paused_reason: "2 of its moves were refused today" })).toBe(
      "Dime paused itself: 2 of its moves were refused today"
    );
  });
});

describe("what each kind may do now", () => {
  test("its own mode or the team's; act suggests while acting is off; all shadow while paused", () => {
    const own = { lineup: "act" as const, streaming: null, adds_drops: "shadow" as const };
    expect(effectiveOf("suggest", own, false, true)).toEqual({ lineup: "act", streaming: "suggest", adds_drops: "shadow" });
    expect(effectiveOf("act", own, false, false)).toEqual({ lineup: "suggest", streaming: "suggest", adds_drops: "shadow" });
    expect(effectiveOf("act", own, true, true)).toEqual({ lineup: "shadow", streaming: "shadow", adds_drops: "shadow" });
  });
});

describe("the demo's Dime", () => {
  const NOW = Date.parse("2026-11-05T15:00:00Z");

  test("is one team in suggest, adds and drops kept in shadow, its next check-in tomorrow morning", () => {
    const [t] = demoDimeTeams(NOW);
    expect(autonomyLine(t.autonomy)).toBe("Suggest · adds and drops shadow");
    expect(t.next).toEqual({ kind: "morning", date: "2026-11-06", due_at: "2026-11-06T14:00:00Z" });
  });

  test("a change is answered as the server would: switching off is your pause, and modes are re-read", () => {
    const [t] = demoDimeTeams(NOW);
    const off = demoDimeChange(t, { on: false }, true, NOW);
    expect([off.on, off.paused_by, off.paused_at]).toEqual([false, "user", "2026-11-05T15:00:00.000Z"]);
    expect(off.autonomy.effective.lineup).toBe("shadow");
    const back = demoDimeChange(off, { on: true, mode: "act", own: { adds_drops: null } }, false, NOW);
    expect([back.on, back.paused_at, back.autonomy.mode, back.autonomy.own.adds_drops]).toEqual([true, null, "act", null]);
    expect(back.autonomy.effective).toEqual({ lineup: "suggest", streaming: "suggest", adds_drops: "suggest" });
  });
});

describe("the policy", () => {
  test("is two sentences of the server's numbers", () => {
    const p: AiActingPolicy = {
      adds_per_day: 2,
      adds_per_matchup: 5,
      adds_reserve: 1,
      protected_top: 6,
      churn_hours: 48,
      pause_refused: 2,
      pause_same_block: 2,
    };
    expect(policyLine(p)).toBe(
      "When Dime acts it makes at most 2 adds a day and 5 a matchup, leaves 1 of the league's adds for you, and never drops one of your top 6 or a player added in the last 48 hours unless he's out. It pauses itself and emails you after 2 refused moves, or the same rule stopping it 2 times, in a day."
    );
    expect(policyLine({ ...p, adds_per_day: 1 })).toContain("at most 1 add a day");
  });
});

describe("what became of a move", () => {
  test("a sent move says what went through; a held one that the chip is still yours", () => {
    expect(actionLine({ outcome: "sent", message: "Sent by Dime: Added Kawhi Leonard, dropped Anthony Edwards" })).toEqual({
      label: "Sent by Dime",
      text: "Added Kawhi Leonard, dropped Anthony Edwards",
    });
    expect(
      actionLine({ outcome: "blocked", message: "Dime has made its 2 add(s) for Wed Oct 21; left as a chip for the user" })
    ).toEqual({ label: "Held back", text: "Dime has made its 2 add(s) for Wed Oct 21. The chip is still yours to send." });
    expect(actionLine({ outcome: "sent", message: "Already handled: Sent by Dime: Set 1 hold(s)" }).text).toBe("Set 1 hold(s)");
  });

  function conversation(blocks: Array<Record<string, unknown>>): Pick<AiConversation, "history"> {
    return { history: [{ parts: blocks.map((block) => ({ kind: "block", block })) }] } as unknown as Pick<AiConversation, "history">;
  }

  test("a check-in's banner says what its changes did", () => {
    const sent = { type: "decision", action: { outcome: "sent", message: "Sent", rule: null, at: null } };
    const held = { type: "decision", action: { outcome: "blocked", message: "Held", rule: "cap_day", at: null } };
    expect(checkinBanner(conversation([sent, held]))).toBe(
      "Dime sent 1 move itself; 1 move it held back is a chip you can send. Mark each call agree or disagree; a follow-up here is an ordinary chat."
    );
    expect(checkinBanner(conversation([held, held]))).toMatch(/^Dime sent nothing itself; 2 moves it held back are chips/);
    expect(checkinBanner(conversation([{ type: "proposal", state: "proposed" }]))).toMatch(/^Its changes here are chips/);
    expect(checkinBanner(conversation([{ type: "proposal", state: "shadow" }, { type: "decision", action: null }]))).toMatch(
      /^In shadow: nothing in this check-in was sent to ESPN/
    );
  });
});
