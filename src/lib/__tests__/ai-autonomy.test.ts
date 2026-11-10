import { describe, expect, test } from "bun:test";
import { DEMO_PREFS, DEMO_TEAM_PREFS, demoDime, demoDimeChange, demoDimeTeam } from "../account-demo";
import {
  EMAIL_OFF,
  accountOptions,
  actionLine,
  aiRowsLine,
  belowAi,
  checkinBanner,
  checkinsLabels,
  lineupLevel,
  lineupPrefs,
  movesOf,
  pauseLine,
  policyLine,
  ruleLabel,
  tableOf,
  teamLine,
  type TableState,
} from "../ai-autonomy";
import type { AiActingPolicy, AiAutomationName, AiAutopilotTeam, AiConversation, AiLevel } from "@/types/ai";

function state(over: Partial<TableState> = {}): TableState {
  return {
    aiRows: [],
    autopilot: false,
    paused: false,
    pausedBy: null,
    lineupBelowAi: "notify",
    lineupEmail: true,
    actingAvailable: true,
    ...over,
  };
}

function levels(t: TableState): Record<AiAutomationName, AiLevel> {
  return Object.fromEntries(tableOf(t).map((r) => [r.row, r.level])) as Record<AiAutomationName, AiLevel>;
}

function team(t: TableState, over: Partial<AiAutopilotTeam> = {}): AiAutopilotTeam {
  return {
    team_id: 1,
    on: !t.paused,
    autopilot: t.autopilot,
    active_since: null,
    paused_at: t.paused ? "2026-11-07T15:00:00Z" : null,
    paused_by: t.paused ? (t.pausedBy ?? "user") : null,
    paused_reason: null,
    next: null,
    rows: tableOf(t),
    ...over,
  };
}

describe("lineup below AI", () => {
  test("is the tip-off email and auto-lineup", () => {
    expect(lineupLevel({ lineup_alerts_enabled: false, auto_lineup_enabled: true })).toBe("off");
    expect(lineupLevel({ lineup_alerts_enabled: true, auto_lineup_enabled: false })).toBe("notify");
    expect(lineupLevel({ lineup_alerts_enabled: true, auto_lineup_enabled: true })).toBe("act");
    for (const level of ["off", "notify", "act"] as const) expect(lineupLevel(lineupPrefs(level))).toBe(level);
    // AI writes what Act does; Dime is on top of it
    expect(lineupPrefs("ai")).toEqual(lineupPrefs("act"));
  });

  test("the account's table offers what each row can do, and says why not", () => {
    const prefs = { lineup_alerts_enabled: true, auto_lineup_enabled: false };
    expect(belowAi("lineup", prefs)).toBe("notify");
    expect(belowAi("lanes", prefs)).toBe("act");
    expect(belowAi("daily_actions", prefs)).toBe("off");
    expect(accountOptions("lineup").map((o) => o.available)).toEqual([true, true, true]);
    const daily = accountOptions("daily_actions");
    expect(daily.map((o) => o.level)).toEqual(["off", "notify", "act"]);
    expect(daily.map((o) => o.available)).toEqual([true, false, false]);
    expect(daily[1].reason).toMatch(/^Not built yet/);
    // Without the account's email no team's lineup runs, so a team's own can't be Notify or Act
    const noEmail = accountOptions("lineup", false);
    expect(noEmail.map((o) => o.available)).toEqual([true, false, false]);
    expect(noEmail[2].reason).toBe(EMAIL_OFF);
  });
});

describe("a team's table", () => {
  test("rows at AI are the user's; the rest read their own levels", () => {
    expect(levels(state({ aiRows: ["daily_actions"] }))).toEqual({
      lineup: "notify",
      daily_actions: "ai",
      lanes: "act",
      late_scratch: "off",
      checkins: "ai",
    });
    expect(levels(state({ paused: true })).checkins).toBe("off");
  });

  test("the switch puts every row that offers AI at AI, and says so", () => {
    const rows = tableOf(state({ autopilot: true }));
    expect(rows.map((r) => r.level)).toEqual(["ai", "ai", "ai", "off", "ai"]);
    expect(rows[0].note).toBe("Autopilot sets these");
    // Late scratches can't be at AI until event check-ins
    const late = rows.find((r) => r.row === "late_scratch")!;
    expect(late.options.find((o) => o.level === "ai")?.reason).toBe("Comes with event check-ins (step 6)");
  });

  test("notes say why a row at AI does less", () => {
    const paused = tableOf(state({ aiRows: ["lineup"], paused: true, pausedBy: "system", pausedReason: "2 moves were refused today" }));
    expect(paused[0].note).toBe("Paused: Dime does nothing here until you resume check-ins");
    expect(paused[4].note).toBe("Dime paused itself: 2 moves were refused today");
    expect(tableOf(state({ aiRows: ["lineup"], actingAvailable: false }))[0].note).toBe(
      "Reviews only: Dime's acting is switched off on the server"
    );
    const noEmail = tableOf(state({ aiRows: ["lineup"], lineupEmail: false }))[0];
    expect(noEmail.note).toBe("Auto-lineup doesn't run: your account's lineup email is off");
    expect(noEmail.options.map((o) => o.available)).toEqual([true, false, false, false]);
  });

  test("check-ins' Off reads as Pause while a row is at AI, and a pause offers Resume", () => {
    expect(checkinsLabels(team(state()))).toEqual({ off: "Off", ai: "AI" });
    expect(checkinsLabels(team(state({ aiRows: ["lineup"] })))).toEqual({ off: "Pause", ai: "AI" });
    expect(checkinsLabels(team(state({ aiRows: ["lineup"], paused: true })))).toEqual({ off: "Paused", ai: "Resume" });
  });

  test("the AI desk's line names the rows at AI", () => {
    expect(aiRowsLine(team(state()))).toBeNull();
    expect(aiRowsLine(team(state({ aiRows: ["lineup", "lanes"] })))).toBe("lineup and stream lanes");
    const on = { available: true };
    expect(teamLine(team(state()), on)).toBe("Dime reviews and logs; nothing is at AI");
    expect(teamLine(team(state({ autopilot: true })), on)).toBe("Autopilot: lineup, daily actions and stream lanes");
    expect(teamLine(team(state({ aiRows: ["daily_actions"], paused: true })), on)).toBe("At AI: daily actions, paused");
    expect(teamLine(team(state({ aiRows: ["daily_actions"] })), { available: false })).toBe(
      "At AI: daily actions, reviews only (acting is off on the server)"
    );
  });

  test("a pause Dime made itself says why", () => {
    expect(pauseLine({ paused_at: null, paused_by: null, paused_reason: null })).toBeNull();
    expect(pauseLine({ paused_at: "2026-11-10T20:00:00Z", paused_by: "user", paused_reason: null })).toBe("Paused");
    expect(pauseLine({ paused_at: "2026-11-10T20:00:00Z", paused_by: "system", paused_reason: "2 of its moves were refused today" })).toBe(
      "Dime paused itself: 2 of its moves were refused today"
    );
  });
});

describe("the demo's Dime", () => {
  const NOW = Date.parse("2026-11-05T15:00:00Z");
  const override = { lineup_alerts_enabled: null, auto_lineup_enabled: null };
  const read = (d: ReturnType<typeof demoDime>[number]) => demoDimeTeam(d, DEMO_PREFS, DEMO_TEAM_PREFS[0], NOW);

  test("is one team with daily actions at AI, its next check-in tomorrow morning", () => {
    const [d] = demoDime(NOW);
    const t = read(d);
    expect(t.rows.map((r) => r.level)).toEqual(["notify", "ai", "act", "off", "ai"]);
    expect(t.next).toEqual({ kind: "morning", date: "2026-11-06", due_at: "2026-11-06T14:00:00Z" });
  });

  test("the switch puts every row at AI and back; a row changed under it turns it off", () => {
    const [d] = demoDime(NOW);
    const on = demoDimeChange(d, read(d), override, { autopilot: true }, NOW);
    expect(on.lineup).toEqual(lineupPrefs("ai"));
    expect([on.dime.autopilot, on.dime.restore?.lineup]).toEqual([true, override]);
    const off = demoDimeChange(on.dime, read(on.dime), lineupPrefs("ai"), { autopilot: false }, NOW);
    expect([off.dime.autopilot, off.dime.ai_rows, off.lineup]).toEqual([false, ["daily_actions"], override]);

    const changed = demoDimeChange(on.dime, read(on.dime), lineupPrefs("ai"), { levels: { lanes: "act" } }, NOW);
    expect([changed.dime.autopilot, changed.dime.ai_rows]).toEqual([false, ["lineup", "daily_actions"]]);
  });

  test("pausing check-ins leaves the switch on; a level the row can't do is refused", () => {
    const [d] = demoDime(NOW);
    const on = demoDimeChange(d, read(d), override, { autopilot: true }, NOW).dime;
    const paused = demoDimeChange(on, read(on), lineupPrefs("ai"), { checkins: false }, NOW).dime;
    expect([paused.autopilot, paused.paused_by, paused.paused_at]).toEqual([true, "user", "2026-11-05T15:00:00.000Z"]);
    expect(() => demoDimeChange(d, read(d), override, { levels: { daily_actions: "notify" } }, NOW)).toThrow(/^Daily actions can't be Notify/);
  });

  test("a row put at AI turns check-ins back on", () => {
    const [d] = demoDime(NOW);
    const paused = demoDimeChange(d, read(d), override, { checkins: false }, NOW).dime;
    const back = demoDimeChange(paused, read(paused), override, { levels: { lineup: "ai" } }, NOW);
    expect([back.dime.paused_at, back.dime.ai_rows, back.lineup]).toEqual([null, ["lineup", "daily_actions"], lineupPrefs("ai")]);
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
      "On automations at AI Dime makes at most 2 adds a day and 5 a matchup, leaves 1 of the league's adds for you, and never drops one of your top 6 or a player added in the last 48 hours unless he's out. It pauses itself and emails you after 2 refused moves, or the same rule stopping it 2 times, in a day."
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
    expect(checkinBanner(conversation([{ type: "proposal", state: "review" }, { type: "decision", action: null }]))).toMatch(
      /^A review: nothing in this check-in was sent to ESPN/
    );
  });
});

describe("Dime's moves", () => {
  test("a rule reads as its chip; a passed-through code as itself", () => {
    expect(ruleLabel("cap_day")).toBe("Day's adds used");
    expect(ruleLabel("AI_PROPOSAL_STALE")).toBe("Proposal stale");
    expect(ruleLabel(null)).toBeNull();
  });

  test("the filter splits what Dime sent from what it held back", () => {
    const moves = [{ outcome: "sent" }, { outcome: "blocked" }, { outcome: "refused" }, { outcome: "failed" }];
    expect(movesOf(moves, "all")).toHaveLength(4);
    expect(movesOf(moves, "sent").map((m) => m.outcome)).toEqual(["sent"]);
    expect(movesOf(moves, "held").map((m) => m.outcome)).toEqual(["blocked", "refused", "failed"]);
  });
});
