import { describe, expect, test } from "bun:test";
import {
  chipStatus,
  frontFromSession,
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
