import { describe, expect, test } from "bun:test";
import {
  askClosedLine,
  askSoon,
  askTone,
  callResult,
  checkinTitle,
  dayLabel,
  didChip,
  pausedLine,
  planNote,
  shiftDay,
  showsTimeline,
  stateLine,
  timelineRows,
  timelineVerdictOf,
  timelineWithVerdict,
  unsentLine,
} from "../ai-timeline";
import type { AiAsk, AiAutopilotTeam, AiNote, AiTimeline, AiTimelineCall, AiTimelineCheckin } from "@/types/ai";

function checkin(over: Partial<AiTimelineCheckin> = {}): AiTimelineCheckin {
  return {
    checkin_id: 1,
    team_id: 21,
    kind: "morning",
    date: "2026-11-20",
    manual: false,
    state: "done",
    reason: null,
    due_at: "2026-11-20T14:00:00Z",
    started_at: "2026-11-20T14:00:00Z",
    finished_at: "2026-11-20T14:03:00Z",
    conversation_id: 31,
    title: "Morning check-in",
    cost_usd: 0.3,
    decisions: 0,
    changes: 0,
    agree: 0,
    disagree: 0,
    sent: 0,
    events: [],
    calls: [],
    notes: [],
    ask: null,
    ...over,
  };
}

function ask(over: Partial<AiAsk> = {}): AiAsk {
  return {
    ask_id: 5,
    team_id: 21,
    what: "Check whether he plays and swap him out if he doesn't",
    due_at: "2026-11-20T23:30:00Z",
    state: "pending",
    reason: null,
    created_at: "2026-11-20T15:00:00Z",
    asked_in: 40,
    checkin_id: null,
    conversation_id: null,
    ...over,
  };
}

function call(over: Partial<AiTimelineCall> = {}): AiTimelineCall {
  return {
    decision_id: 1,
    area: "adds_drops",
    automation: "none",
    call: "hold",
    summary: "Hold",
    reason: "Fine",
    proposal_id: null,
    verdict: null,
    action: null,
    result: null,
    ...over,
  } as AiTimelineCall;
}

const DAY: Pick<AiTimeline, "starts_at" | "ends_at"> = { starts_at: "2026-11-20T08:00:00Z", ends_at: "2026-11-21T08:00:00Z" };

describe("the timeline's rows", () => {
  test("check-ins, the Now line, what's to come and the first tip, in the order they happen", () => {
    const night = checkin({ checkin_id: 1, kind: "night", started_at: "2026-11-20T11:00:00Z" });
    const event = checkin({ checkin_id: 2, kind: "event", started_at: "2026-11-20T17:10:00Z" });
    const rows = timelineRows(
      {
        ...DAY,
        checkins: [event, night],
        upcoming: [{ kind: "pre_lock", date: "2026-11-20", due_at: "2026-11-20T23:45:00Z" }],
        first_tip: "2026-11-21T00:30:00Z",
      },
      Date.parse("2026-11-20T18:00:00Z")
    );
    expect(rows.map((r) => r.kind)).toEqual(["checkin", "checkin", "now", "upcoming", "tip"]);
    expect(rows[0].kind === "checkin" && rows[0].checkin.checkin_id).toBe(1);
  });

  test("the Now line only on the day it is now, and a tie puts what ran before it", () => {
    const at = "2026-11-20T14:00:00Z";
    const today = timelineRows({ ...DAY, checkins: [checkin({ started_at: at })], upcoming: [], first_tip: null }, Date.parse(at));
    expect(today.map((r) => r.kind)).toEqual(["checkin", "now"]);
    const past = timelineRows({ ...DAY, checkins: [], upcoming: [], first_tip: null }, Date.parse("2026-11-21T09:00:00Z"));
    expect(past).toEqual([]);
  });
});

describe("the user's asks", () => {
  test("sit at their time, after a check-in that ran then and before a slot due then", () => {
    const at = "2026-11-20T23:45:00Z";
    const rows = timelineRows(
      {
        ...DAY,
        checkins: [checkin({ started_at: at })],
        asks: [ask({ due_at: at }), ask({ ask_id: 6, due_at: "2026-11-20T16:00:00Z", state: "cancelled", reason: "user" })],
        upcoming: [{ kind: "pre_lock", date: "2026-11-20", due_at: at }],
        first_tip: null,
      },
      Date.parse("2026-11-21T09:00:00Z")
    );
    expect(rows.map((r) => r.kind)).toEqual(["ask", "checkin", "ask", "upcoming"]);
    expect(rows[0].kind === "ask" && rows[0].ask.ask_id).toBe(6);
  });

  test("a day read without asks still has its rows", () => {
    const rows = timelineRows({ ...DAY, checkins: [checkin()], upcoming: [], first_tip: null }, Date.parse("2026-11-21T09:00:00Z"));
    expect(rows.map((r) => r.kind)).toEqual(["checkin"]);
  });

  test("say why one closed without running", () => {
    expect(askClosedLine(ask())).toBeNull();
    expect(askClosedLine(ask({ state: "done" }))).toBeNull();
    expect(askClosedLine(ask({ state: "cancelled", reason: "user" }))).toBe("Cancelled");
    expect(askClosedLine(ask({ state: "missed", reason: "late" }))).toBe("Missed: it was still waiting an hour after its time");
    expect(askClosedLine(ask({ state: "skipped", reason: "not_allowed" }))).toBe("Skipped: Dime no longer runs on this team");
    expect(askClosedLine(ask({ state: "failed", reason: null }))).toBe("Failed");
  });

  test("are purple while they wait or run, quiet after", () => {
    expect(askTone("pending")).toBe("pv");
    expect(askTone("running")).toBe("pv");
    expect(askTone("done")).toBe("flat");
    expect(askTone("cancelled")).toBe("flat");
    expect(askTone("missed")).toBe("warn");
    expect(askTone("failed")).toBe("down");
  });

  test("are read again soon while one is about due, just due or running", () => {
    const due = Date.parse("2026-11-20T23:30:00Z");
    expect(askSoon([ask()], due - 10 * 60_000)).toBe(false);
    expect(askSoon([ask()], due - 4 * 60_000)).toBe(true);
    expect(askSoon([ask()], due + 30 * 60_000)).toBe(true);
    expect(askSoon([ask()], due + 61 * 60_000)).toBe(false);
    expect(askSoon([ask({ state: "running" })], due - 10 * 60_000)).toBe(true);
    expect(askSoon([ask({ state: "cancelled" })], due)).toBe(false);
    expect(askSoon(undefined, due)).toBe(false);
  });

  test("an ask's change below AI is left as a chip, not a review", () => {
    const asked = checkin({ kind: "ask", manual: true, calls: [call({ call: "change" }), call({ call: "change" })] });
    expect(didChip(asked)).toEqual({ text: "Left 2 for you", tone: "pv" });
    expect(unsentLine("ask")).toContain("chip in the conversation");
    expect(unsentLine("morning")).toContain("A review");
  });
});

describe("days", () => {
  test("shift across months and name the near ones", () => {
    expect(shiftDay("2026-11-30", 1)).toBe("2026-12-01");
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
    expect(dayLabel("2026-11-20", "2026-11-20")).toBe("Today · Fri 11/20");
    expect(dayLabel("2026-11-19", "2026-11-20")).toBe("Yesterday · Thu 11/19");
    expect(dayLabel("2026-11-21", "2026-11-20")).toBe("Tomorrow · Sat 11/21");
    expect(dayLabel("2026-11-17", "2026-11-20")).toBe("Tue 11/17");
  });

  test("a night follow-up says which day it was about", () => {
    expect(checkinTitle(checkin({ kind: "night", date: "2026-11-19" }), "2026-11-20")).toEqual({ title: "Night follow-up", about: "about Thu" });
    expect(checkinTitle(checkin({ kind: "pre_lock" }), "2026-11-20")).toEqual({ title: "Pre-lock", about: null });
  });
});

describe("what a check-in did", () => {
  const sent = { outcome: "sent" as const, message: "Sent by Dime: Added Herb Jones", rule: null, at: "2026-11-20T14:02:00Z" };
  const held = { outcome: "blocked" as const, rule: "cap_day", message: "Over today's cap", at: null };

  test("sent, held back, a review or no changes", () => {
    expect(didChip(checkin({ calls: [call({ call: "change", action: sent }), call({ call: "change", action: held })] }))).toEqual({ text: "Sent 1 move, held 1", tone: "up" });
    expect(didChip(checkin({ calls: [call({ call: "change", action: held })] }))).toEqual({ text: "Held back 1", tone: "warn" });
    expect(didChip(checkin({ calls: [call({ call: "change" }), call()] }))).toEqual({ text: "A review", tone: "flat" });
    expect(didChip(checkin({ calls: [call(), call()] }))).toEqual({ text: "No changes", tone: "flat" });
  });

  test("or that it is still thinking, or why it didn't run", () => {
    expect(didChip(checkin({ state: "running" })).text).toBe("Thinking…");
    expect(didChip(checkin({ state: "missed", reason: "window_closed" })).tone).toBe("warn");
    expect(stateLine(checkin({ state: "missed", reason: "window_closed" }))).toBe("Missed: its window closed before it could run");
    expect(stateLine(checkin({ state: "failed", reason: null }))).toBe("Failed");
    expect(stateLine(checkin())).toBeNull();
  });

  test("a sent move's result: the matchup once there is one, else the day", () => {
    const move = (windows: Record<string, unknown>) => call({ result: { windows } as AiTimelineCall["result"] });
    const day = { start: "2026-11-20", end: "2026-11-20", complete: true, add: null, drop: null, net: 12.5 };
    const matchup = { start: "2026-11-20", end: "2026-11-23", complete: false, add: null, drop: null, net: -3 };
    expect(callResult(move({ day }))).toEqual({ text: "+12.5", tone: "up", window: "day", open: false });
    expect(callResult(move({ day, matchup }))).toEqual({ text: "−3.0", tone: "down", window: "matchup", open: true });
    expect(callResult(call())).toBeNull();
  });
});

describe("the plan strip", () => {
  const note = (over: Partial<AiNote>): AiNote =>
    ({ note_id: 1, kind: "plan", team_id: 21, text: "Lane on Huerter's spot", recheck_on: null, author: "dime", written_on: "2026-11-19", retired_on: null, ...over }) as AiNote;

  test("is the team's newest live plan", () => {
    const notes = [
      note({ note_id: 1, written_on: "2026-11-18" }),
      note({ note_id: 2, written_on: "2026-11-19" }),
      note({ note_id: 3, written_on: "2026-11-20", retired_on: "2026-11-20" }),
      note({ note_id: 4, written_on: "2026-11-20", team_id: 22 }),
      note({ note_id: 5, written_on: "2026-11-20", kind: "player" }),
    ];
    expect(planNote(notes, 21)?.note_id).toBe(2);
    expect(planNote(notes, 23)).toBeNull();
    expect(planNote(undefined, 21)).toBeNull();
  });
});

describe("whether the desk has a timeline", () => {
  const team = (over: Partial<AiAutopilotTeam>): AiAutopilotTeam =>
    ({ team_id: 21, on: false, autopilot: false, paused_at: null, paused_by: null, paused_reason: null, rows: [], next: null, ...over }) as AiAutopilotTeam;
  const atAi = [{ row: "daily_actions", level: "ai", label: "Daily actions" }] as unknown as AiAutopilotTeam["rows"];

  test("with check-ins on, or paused over something at AI; never for a team Dime doesn't run on", () => {
    expect(showsTimeline(team({ on: true }))).toBe(true);
    expect(showsTimeline(team({ rows: atAi }))).toBe(true);
    expect(showsTimeline(team({ paused_at: "2026-11-20T14:00:00Z", paused_by: "user" }))).toBe(true);
    expect(showsTimeline(team({}))).toBe(false);
    expect(showsTimeline(undefined)).toBe(false);
  });

  test("a paused team says why nothing is scheduled", () => {
    expect(pausedLine(team({ on: true }))).toBeNull();
    expect(pausedLine(team({ rows: atAi }))).toBe("Check-ins are paused");
    expect(pausedLine(team({ paused_at: "2026-11-20T14:00:00Z", paused_by: "system", paused_reason: "3 refused moves" }))).toBe("Dime paused itself: 3 refused moves");
  });
});

describe("a verdict on the timeline", () => {
  const day = {
    checkins: [
      checkin({ checkin_id: 1, calls: [call({ decision_id: 7, verdict: "agree" }), call({ decision_id: 8 })] }),
      checkin({ checkin_id: 2, calls: [call({ decision_id: 9 })] }),
    ],
  };

  test("reads one call's verdict, undefined when it isn't on the day", () => {
    expect(timelineVerdictOf(day, 7)).toBe("agree");
    expect(timelineVerdictOf(day, 8)).toBeNull();
    expect(timelineVerdictOf(day, 99)).toBeUndefined();
  });

  test("sets only that call, and keeps the day as it was when the call isn't there", () => {
    const next = timelineWithVerdict(day, 8, "disagree");
    expect(timelineVerdictOf(next, 8)).toBe("disagree");
    expect(timelineVerdictOf(next, 7)).toBe("agree");
    expect(next.checkins[1]).toBe(day.checkins[1]);
    expect(timelineVerdictOf(day, 8)).toBeNull();
    expect(timelineWithVerdict(day, 99, "agree")).toBe(day);
    expect(timelineVerdictOf(timelineWithVerdict(next, 8, null), 8)).toBeNull();
  });
});
