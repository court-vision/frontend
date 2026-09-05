import { describe, expect, test } from "bun:test";
import {
  canDraft,
  canDraftLabel,
  chipStatus,
  frontFromSession,
  sendFailureMessage,
  initialState,
  reduce,
  type SyncContext,
  type SyncEffect,
  type SyncEvent,
  type SyncState,
} from "../espn-draft/sync-state";
import type { TapRecord } from "../espn-draft/protocol";
import type { DraftPick, DraftSession } from "../../types/draft";

const CTX = (over: Partial<SyncContext> = {}): SyncContext => ({
  expectedLeagueId: null,
  bindable: false,
  paused: false,
  now: 1000,
  ...over,
});

let ts = 0;
const openRec = (over: Partial<TapRecord> = {}): TapRecord => ({ ts: ts++, kind: "open", url: "wss://fantasydraft.espn.com/game-3/league-9/JOIN", tab: 1, transport: "ws", ...over });
const frameRec = (frame: string, over: Partial<TapRecord> = {}): TapRecord => ({ ts: ts++, kind: "frame", dir: "in", transport: "ws", tab: 1, frame, ...over });

/** Fold a sequence of records through the reducer, collecting all effects. */
function run(records: TapRecord[], ctx = CTX(), start: SyncState = initialState()): { state: SyncState; effects: SyncEffect[] } {
  let state = start;
  const effects: SyncEffect[] = [];
  for (const record of records) {
    const r = reduce(state, { type: "record", record }, ctx);
    state = r.state;
    effects.push(...r.effects);
  }
  return { state, effects };
}

const INIT = (payload = "AAAAAQAAAAECHAyUAAAABQ") => frameRec(`INIT ${payload}`);

describe("record folding", () => {
  test("an open establishes the room and clears prior state", () => {
    const { state } = run([openRec()]);
    expect(state.room?.leagueId).toBe(9);
    expect(state.reconciled).toBe("none");
    expect(state.front).toBeNull();
  });

  test("INIT asks for a sync and goes pending; AUTODRAFT before it is tolerated", () => {
    const { state, effects } = run([openRec(), frameRec("AUTODRAFT 3 false"), INIT()]);
    expect(state.initSeen).toBe(true);
    expect(state.reconciled).toBe("pending");
    expect(state.stats.ignored).toBe(1); // the AUTODRAFT
    expect(effects.filter((e) => e.kind === "sync-init")).toHaveLength(1);
  });

  test("SELECTED/SOLD emit pick effects; numbering is not baked in", () => {
    const { effects } = run([openRec(), INIT(), frameRec("SELECTED 8 100 2"), frameRec("SOLD 8 200 1 40 0")]);
    const picks = effects.filter((e) => e.kind === "pick");
    expect(picks).toEqual([
      { kind: "pick", espnPlayerId: 100, teamId: 8, bid: null, live: true },
      { kind: "pick", espnPlayerId: 200, teamId: 8, bid: 40, live: true },
    ]);
  });

  test("a replay burst marks its picks as not live (no toast storm on a late join)", () => {
    const r = reduce(
      initialState(),
      { type: "replay", records: [openRec(), INIT(), frameRec("SELECTED 8 100 2"), frameRec("SELECTED 8 200 2")] },
      CTX()
    );
    const picks = r.effects.filter((e) => e.kind === "pick");
    expect(picks).toHaveLength(2);
    expect(picks.every((e) => e.kind === "pick" && e.live === false)).toBe(true);
  });

  test("out-bound frames (our PING) are ignored", () => {
    const { effects, state } = run([openRec(), frameRec("PING 1", { dir: "out" })]);
    expect(effects).toHaveLength(0);
    expect(state.stats.ignored).toBe(0);
  });

  test("records from another tab are dropped once a room exists", () => {
    const { effects } = run([openRec({ tab: 1 }), INIT(), frameRec("SELECTED 8 100 2", { tab: 2 })]);
    expect(effects.filter((e) => e.kind === "pick")).toHaveLength(0);
  });

  test("UNDONE emits an undo and pulls the front back", () => {
    let state = run([openRec(), INIT()]).state;
    state = reduce(state, { type: "init-result", ok: true, front: 20, myTeamId: 5 }, CTX()).state;
    const r = reduce(state, { type: "record", record: frameRec("UNDONE 12") }, CTX());
    expect(r.effects).toContainEqual({ kind: "undo", pickNumber: 12 });
    expect(r.state.front).toBe(12);
  });

  test("RESET latches and shelves everything after it", () => {
    const { state, effects } = run([openRec(), INIT(), frameRec("RESET"), frameRec("SELECTED 8 100 2")]);
    expect(state.reset).toBe(true);
    expect(effects.filter((e) => e.kind === "pick")).toHaveLength(0);
    expect(state.stats.pausedFrames).toBe(1);
  });

  test("SELECTING sets the clock", () => {
    const { state } = run([openRec(), frameRec("SELECTING 8 30000")]);
    expect(state.onClock).toEqual({ teamId: 8, msRemaining: 30000, at: expect.any(Number) });
  });
});

describe("mismatch and pause gates", () => {
  test("a wrong-league open latches a mismatch and blocks effects", () => {
    const ctx = CTX({ expectedLeagueId: 111 });
    const { state, effects } = run([openRec({ url: "wss://.../league-222/JOIN" }), INIT()], ctx);
    expect(state.mismatch).toEqual({ espnLeagueId: 222, expected: 111 });
    expect(effects).toHaveLength(0);
  });

  test("paused shelves frames without effects", () => {
    const { state, effects } = run([openRec(), INIT(), frameRec("SELECTED 8 100 2")], CTX({ paused: true }));
    expect(effects).toHaveLength(0);
    expect(state.stats.pausedFrames).toBeGreaterThan(0);
  });
});

describe("numbering across a reconnect (second open)", () => {
  test("a second open re-emits sync-init on its INIT", () => {
    const first = run([openRec(), INIT()]);
    const second = reduce(first.state, { type: "record", record: openRec() }, CTX());
    expect(second.state.reconciled).toBe("none");
    const third = reduce(second.state, { type: "record", record: INIT() }, CTX());
    expect(third.effects.filter((e) => e.kind === "sync-init")).toHaveLength(1);
  });
});

describe("init-result and pick-reserve", () => {
  test("ok sets the authoritative front and team", () => {
    const s = reduce(initialState(), { type: "init-result", ok: true, front: 46, myTeamId: 4 }, CTX()).state;
    expect(s.front).toBe(46);
    expect(s.myTeamId).toBe(4);
    expect(s.reconciled).toBe("ok");
  });

  test("fail falls back and marks unreconciled", () => {
    const s = reduce(initialState(), { type: "init-result", ok: false, error: "x", fallbackFront: 1 }, CTX()).state;
    expect(s.front).toBe(1);
    expect(s.reconciled).toBe("failed");
    expect(s.mismatch).toBeNull();
  });

  test("a server-side league refusal latches a mismatch and gates later picks", () => {
    const opened = run([openRec()]).state; // room league 9
    const ctx = CTX({ expectedLeagueId: 111 });
    const s = reduce(
      opened,
      { type: "init-result", ok: false, error: "wrong league", code: "DRAFT_INIT_LEAGUE_MISMATCH", fallbackFront: 1 },
      ctx
    ).state;
    expect(s.mismatch).toEqual({ espnLeagueId: 9, expected: 111 });
    // A frame after the latch is shelved, not posted.
    const after = reduce(s, { type: "record", record: frameRec("SELECTED 8 100 2") }, ctx);
    expect(after.effects).toHaveLength(0);
    expect(after.state.stats.pausedFrames).toBe(1);
  });

  test("pick-skipped counts a shelved queued pick", () => {
    const s = reduce(initialState(), { type: "pick-skipped" }, CTX()).state;
    expect(s.stats.pausedFrames).toBe(1);
  });

  test("pick-reserve advances the front", () => {
    let s: SyncState = { ...initialState(), front: 5 };
    s = reduce(s, { type: "pick-reserve", overall: 5 }, CTX()).state;
    expect(s.front).toBe(6);
  });

  test("pick-result counts inserted, duplicate, conflict, failed", () => {
    let s = initialState();
    for (const ev of [
      { type: "pick-result", outcome: "inserted" },
      { type: "pick-result", outcome: "duplicate" },
      { type: "pick-result", outcome: "conflict" },
      { type: "pick-result", outcome: "failed", error: "boom" },
    ] as SyncEvent[]) {
      s = reduce(s, ev, CTX()).state;
    }
    expect(s.stats).toMatchObject({ picks: 2, duplicates: 1, conflicts: 1, failed: 1 });
    expect(s.lastError).toBe("boom");
  });
});

describe("frontFromSession", () => {
  const pick = (overall: number, source: DraftPick["source"] = "manual"): DraftPick => ({
    overall_pick: overall,
    round: null,
    slot: null,
    player_id: overall,
    espn_player_id: null,
    espn_team_id: null,
    player_name: null,
    by_me: false,
    source,
    bid: null,
    created_at: null,
  });
  const session = (picks: DraftPick[], next: number): Pick<DraftSession, "picks" | "next_overall_pick"> => ({
    picks,
    next_overall_pick: next,
  });

  test("one past the last non-keeper pick", () => {
    expect(frontFromSession(session([pick(1), pick(2), pick(3)], 4))).toBe(4);
  });

  test("keeper picks do not move the front", () => {
    expect(frontFromSession(session([pick(5, "keeper"), pick(1)], 2))).toBe(2);
  });

  test("an empty session uses next_overall_pick", () => {
    expect(frontFromSession(session([], 1))).toBe(1);
  });
});

describe("chipStatus", () => {
  const base = { ...initialState(), connection: "connected" as const, room: { tab: 1, leagueId: 9, transport: "ws" as const, openedAt: 0, closed: false } };
  test("live vs unreconciled vs reset labels", () => {
    expect(chipStatus({ ...base, reconciled: "ok", initSeen: true, front: 7 }, false).label).toContain("Live · next pick 7");
    expect(chipStatus({ ...base, reconciled: "failed", initSeen: true, front: 7 }, false).label).toContain("unreconciled");
    expect(chipStatus({ ...base, reset: true }, false).tone).toBe("error");
    expect(chipStatus({ ...initialState(), connection: "not-installed" }, false).label).toContain("tap not found");
    expect(chipStatus(base, true).label).toBe("Sync paused");
  });
});

// ------------------------------- write path ------------------------------ //

/** A connected, reconciled room: team 3 is us, and the extension allows writes. */
function liveState(): SyncState {
  let s = reduce(initialState(), { type: "port", status: "connected" }, CTX()).state;
  s = reduce(s, { type: "capabilities", capabilities: ["read", "write"] }, CTX()).state;
  s = run([openRec(), INIT()], CTX(), s).state;
  s = reduce(s, { type: "init-result", ok: true, front: 5, myTeamId: 3 }, CTX()).state;
  return s;
}
const onClock = (s: SyncState, teamId = 3, ms = 30_000) => run([frameRec(`SELECTING ${teamId} ${ms}`)], CTX(), s).state;
const at = (s: SyncState) => s.lastFrameAt ?? 0;
const sent = (s: SyncState, playerId = 4431671, requestId = "req-1") =>
  reduce(s, { type: "draft-sent", playerId, requestId }, CTX({ now: 500 })).state;
const cmdResult = (over: Partial<TapRecord>): TapRecord => ({
  ts: ts++,
  kind: "command-result",
  tab: 1,
  cmd: "select",
  requestId: "req-1",
  playerId: 4431671,
  ...over,
});
const reasonOf = (s: SyncState, paused = false, now = at(s)) => {
  const gate = canDraft(s, paused, now);
  return gate.ok ? undefined : gate.reason;
};

describe("canDraft", () => {
  test("ok only when write is advertised, the room is live on ws, and ESPN put us on the clock", () => {
    const s = onClock(liveState());
    expect(canDraft(s, false, at(s))).toEqual({ ok: true });
  });

  test("every gate, in order", () => {
    const s = onClock(liveState());
    expect(reasonOf({ ...s, connection: "disconnected" })).toBe("not-connected");
    expect(reasonOf({ ...s, capabilities: ["read"] })).toBe("no-write");
    // A dropped port clears capabilities as well; connection still wins.
    expect(reasonOf({ ...s, connection: "disconnected", capabilities: [] })).toBe("not-connected");
    expect(reasonOf({ ...s, room: null })).toBe("no-room");
    expect(reasonOf({ ...s, room: { ...s.room!, closed: true } })).toBe("room-closed");
    expect(reasonOf({ ...s, room: { ...s.room!, transport: "sse" } })).toBe("sse");
    expect(reasonOf(s, true)).toBe("paused");
    expect(reasonOf({ ...s, mismatch: { espnLeagueId: 1, expected: 9 } })).toBe("mismatch");
    expect(reasonOf({ ...s, reset: true })).toBe("reset");
    expect(reasonOf(sent(s))).toBe("pending");
    expect(reasonOf({ ...s, myTeamId: null })).toBe("no-team");
    expect(reasonOf({ ...s, onClock: null })).toBe("not-on-clock");
    expect(reasonOf(onClock(s, 8))).toBe("not-on-clock");
  });

  test("a SELECTING older than its own clock (plus grace) is stale — a replay must not enable the button", () => {
    const s = onClock(liveState());
    const clockAt = s.onClock!.at;
    expect(reasonOf(s, false, clockAt + 30_000 + 5_001)).toBe("clock-stale");
    expect(reasonOf(s, false, clockAt + 30_000 + 4_999)).toBeUndefined();
  });

  test("every reason has a label", () => {
    const reasons = [
      "no-write", "not-connected", "no-room", "unlinked", "room-closed", "sse", "paused",
      "mismatch", "reset", "pending", "no-team", "not-on-clock", "clock-stale",
    ] as const;
    for (const r of reasons) expect(canDraftLabel(r).length).toBeGreaterThan(0);
  });
});

describe("capabilities", () => {
  test("set by the extension, cleared when the port drops", () => {
    let s = reduce(initialState(), { type: "capabilities", capabilities: ["read", "write"] }, CTX()).state;
    expect(s.capabilities).toEqual(["read", "write"]);
    s = reduce(s, { type: "port", status: "disconnected" }, CTX()).state;
    expect(s.capabilities).toEqual([]);
  });
});

describe("a sent pick", () => {
  test("goes pending; the tap's ok keeps it pending; a failure settles it", () => {
    let s = sent(onClock(liveState()));
    expect(s.pending).toEqual({ playerId: 4431671, requestId: "req-1", since: 500 });
    expect(s.stats.sent).toBe(1);
    s = run([cmdResult({ ok: true })], CTX(), s).state;
    expect(s.pending).not.toBeNull();
    s = run([cmdResult({ ok: false, reason: "write-disabled" })], CTX(), s).state;
    expect(s.pending).toBeNull();
    expect(s.lastSend).toMatchObject({ requestId: "req-1", playerId: 4431671, outcome: "failed", reason: "write-disabled" });
    expect(s.stats.sendFailed).toBe(1);
  });

  test("a result for some other request is ignored", () => {
    const s = run([cmdResult({ ok: false, reason: "no-tab", requestId: "other" })], CTX(), sent(onClock(liveState()))).state;
    expect(s.pending).not.toBeNull();
  });

  test("ESPN's SELECTED echo settles it and tags the pick effect", () => {
    const { state, effects } = run([frameRec("SELECTED 3 4431671 12 {SWID}")], CTX(), sent(onClock(liveState())));
    expect(state.pending).toBeNull();
    expect(state.lastSend?.outcome).toBe("echoed");
    expect(state.stats.sendFailed).toBe(0);
    expect(effects).toEqual([
      { kind: "pick", espnPlayerId: 4431671, teamId: 3, bid: null, live: true, sentRequestId: "req-1" },
    ]);
  });

  test("the echo still clears the send while paused, though the pick itself is shelved", () => {
    const { state, effects } = run([frameRec("SELECTED 3 4431671 12 {SWID}")], CTX({ paused: true }), sent(onClock(liveState())));
    expect(state.pending).toBeNull();
    expect(state.lastSend?.outcome).toBe("echoed");
    expect(effects).toHaveLength(0);
    expect(state.stats.pausedFrames).toBe(1);
  });

  test("another team taking that player settles it as taken; the pick is theirs, untagged", () => {
    const { state, effects } = run([frameRec("SELECTED 8 4431671 2")], CTX(), sent(onClock(liveState())));
    expect(state.lastSend).toMatchObject({ outcome: "failed", reason: "taken" });
    expect(effects).toEqual([{ kind: "pick", espnPlayerId: 4431671, teamId: 8, bid: null, live: true }]);
  });

  test("our team getting a different player settles it as superseded", () => {
    const { state } = run([frameRec("SELECTED 3 999 2")], CTX(), sent(onClock(liveState())));
    expect(state.lastSend).toMatchObject({ outcome: "failed", reason: "superseded" });
  });

  test("an ERROR while pending carries ESPN's text; an idle ERROR is merely ignored", () => {
    const { state } = run([frameRec("ERROR 1 Not+your+turn")], CTX(), sent(onClock(liveState())));
    expect(state.lastSend).toMatchObject({ outcome: "failed", reason: "espn-error", detail: "Not your turn" });
    const idle = run([frameRec("ERROR 1 Not+your+turn")], CTX(), liveState()).state;
    expect(idle.lastSend).toBeNull();
    expect(idle.pending).toBeNull();
    expect(idle.stats.ignored).toBe(1);
  });

  test("a timeout settles the matching request only", () => {
    let s = sent(onClock(liveState()));
    s = reduce(s, { type: "draft-timeout", requestId: "stale" }, CTX()).state;
    expect(s.pending).not.toBeNull();
    s = reduce(s, { type: "draft-timeout", requestId: "req-1" }, CTX({ now: 11_000 })).state;
    expect(s.pending).toBeNull();
    expect(s.lastSend).toMatchObject({ outcome: "timeout", reason: "timeout", at: 11_000 });
    expect(s.stats.sendFailed).toBe(1);
  });

  test("a hook-side failure settles it with the given reason", () => {
    const s = reduce(sent(onClock(liveState())), { type: "draft-result", requestId: "req-1", reason: "disconnected" }, CTX()).state;
    expect(s.lastSend).toMatchObject({ outcome: "failed", reason: "disconnected" });
  });

  test("a fresh socket open, a close, or a dropped port abandons it", () => {
    expect(run([openRec()], CTX(), sent(onClock(liveState()))).state.lastSend).toMatchObject({ reason: "socket-reopened" });
    expect(run([{ ts: ts++, kind: "close", tab: 1, code: 1006 }], CTX(), sent(onClock(liveState()))).state.lastSend).toMatchObject({ reason: "socket-closed" });
    expect(reduce(sent(onClock(liveState())), { type: "port", status: "disconnected" }, CTX()).state.lastSend).toMatchObject({ reason: "disconnected" });
  });
});

describe("the clock", () => {
  test("a SELECTED for the team on the clock clears it; another team's does not", () => {
    let s = onClock(liveState());
    s = run([frameRec("SELECTED 8 100 2")], CTX(), s).state;
    expect(s.onClock?.teamId).toBe(3);
    s = run([frameRec("SELECTED 3 4431671 12 {SWID}")], CTX(), s).state;
    expect(s.onClock).toBeNull();
  });
});

describe("chip + messages for the write path", () => {
  test("a pending send shows as sending; the write capability shows in the detail", () => {
    const s = onClock(liveState());
    expect(chipStatus(s, false).detail).toContain("drafting on");
    expect(chipStatus(sent(s), false).label).toBe("Sending pick to ESPN…");
  });

  test("failure messages", () => {
    expect(sendFailureMessage("espn-error", "Not your turn")).toBe("ESPN refused the pick: Not your turn");
    expect(sendFailureMessage("espn-error")).toBe("ESPN refused the pick");
    expect(sendFailureMessage("write-disabled")).toContain("popup");
    expect(sendFailureMessage("taken")).toContain("first");
    expect(sendFailureMessage("what-is-this")).toContain("what-is-this");
  });
});

// -------------------------------- linking -------------------------------- //

describe("an unlinked mock room", () => {
  const BIND = CTX({ bindable: true });

  test("holds the first ESPN room it sees: INIT is shelved, nothing is applied", () => {
    const { state, effects } = run([openRec(), INIT(), frameRec("SELECTED 8 100 2")], BIND);
    expect(state.unbound).toEqual({ espnLeagueId: 9, dismissed: false });
    expect(state.room?.leagueId).toBe(9);
    expect(effects).toHaveLength(0);
    expect(state.stats.pausedFrames).toBe(2);
    expect(chipStatus(state, false).label).toBe("ESPN room 9 is open — link it?");
  });

  test("cannot draft until linked", () => {
    let s = reduce(initialState(), { type: "port", status: "connected" }, BIND).state;
    s = reduce(s, { type: "capabilities", capabilities: ["read", "write"] }, BIND).state;
    s = run([openRec(), frameRec("SELECTING 3 30000")], BIND, s).state;
    const gate = canDraft(s, false, s.lastFrameAt ?? 0);
    expect(gate).toEqual({ ok: false, reason: "unlinked" });
  });

  test("ignoring keeps the frames shelved and says so", () => {
    let s = run([openRec()], BIND).state;
    s = reduce(s, { type: "dismiss-room" }, BIND).state;
    expect(s.unbound?.dismissed).toBe(true);
    expect(chipStatus(s, false).label).toBe("Ignoring ESPN room 9");
    const { effects } = run([INIT()], BIND, s);
    expect(effects).toHaveLength(0);
  });

  test("once linked, the same room applies normally and any other is a mismatch", () => {
    const linked = CTX({ expectedLeagueId: 9, bindable: false });
    const ok = run([openRec(), INIT()], linked);
    expect(ok.state.unbound).toBeNull();
    expect(ok.effects.map((e) => e.kind)).toEqual(["sync-init"]);

    const other = run([openRec({ url: "wss://fantasydraft.espn.com/game-3/league-77/JOIN" }), INIT()], linked);
    expect(other.state.mismatch).toEqual({ espnLeagueId: 77, expected: 9 });
    expect(other.effects).toHaveLength(0);
    expect(chipStatus(other.state, false)).toMatchObject({ tone: "warn", label: "Wrong ESPN room" });
  });

  test("a room that is not bindable and has no expectation accepts any room (manual/legacy)", () => {
    const { state, effects } = run([openRec(), INIT()], CTX({ bindable: false }));
    expect(state.unbound).toBeNull();
    expect(effects.map((e) => e.kind)).toEqual(["sync-init"]);
  });
});

describe("ESPN's draft state", () => {
  test("STATE 2 asks to close the session, once; other states are only remembered", () => {
    let s = run([openRec(), INIT()], CTX()).state;
    const during = run([frameRec("STATE 1 30000")], CTX(), s);
    expect(during.effects).toHaveLength(0);
    expect(during.state.draftState).toBe(1);
    const after = run([frameRec("STATE 2")], CTX(), during.state);
    expect(after.effects).toEqual([{ kind: "complete" }]);
    expect(after.state.draftState).toBe(2);
    expect(run([frameRec("STATE 2")], CTX(), after.state).effects).toHaveLength(0);
    expect(chipStatus({ ...after.state, reconciled: "ok", initSeen: true }, false).label).toBe("ESPN draft complete");
  });

  test("STATE 2 while paused or unlinked is remembered but not acted on", () => {
    const paused = run([openRec(), INIT(), frameRec("STATE 2")], CTX({ paused: true }));
    expect(paused.effects).toHaveLength(0);
    expect(paused.state.draftState).toBe(2);
    const unlinked = run([openRec(), frameRec("STATE 2")], CTX({ bindable: true }));
    expect(unlinked.effects).toHaveLength(0);
  });

  test("the INIT result carries ESPN's state too", () => {
    const s = reduce(initialState(), { type: "init-result", ok: true, front: 5, myTeamId: 3, draftState: 1 }, CTX()).state;
    expect(s.draftState).toBe(1);
  });
});
