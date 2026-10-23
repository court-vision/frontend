import { describe, expect, test } from "bun:test";
import {
  boardMismatch,
  isAddStaged,
  isLineupAction,
  isRowStaged,
  isTransactionAction,
  moveLine,
  rowButton,
  sortActions,
  stageAllFold,
  stageAllOrder,
  stageRow,
  streamersHint,
  surname,
  unstageRow,
  unstagedLineupActions,
} from "../daily-actions";
import { slotName, validateStaged, type Staged } from "../lineup-editor";
import type { DailyAction, DailyActionKind } from "../../types/daily-actions";
import type { LineupPlayer, LineupState } from "../../types/lineup-editor";

const UT = 11, BE = 12, IR = 13, C = 4;
const NO_DROP = -1;

function move(pid: number, from: number, to: number) {
  const role = from === BE && to < BE ? "start" : to === BE ? "bench" : "shift";
  return { player_id: pid, name: `P${pid}`, from_slot_id: from, from_slot: String(from), to_slot_id: to, to_slot: String(to), role } as const;
}

const who = (pid: number, name: string = `P${pid}`) => ({
  player_id: pid,
  nba_player_id: null,
  name,
  team: "DEN",
  injury_status: null,
  lineup_slot_id: null,
  lineup_slot: null,
  avg_points: null,
});

function action(kind: DailyActionKind, pid: number, moves: Array<[number, number, number]> = [], extra: Partial<DailyAction> = {}): DailyAction {
  return {
    id: `${kind}:${pid}`,
    kind,
    title: `${kind} ${pid}`,
    player: who(pid),
    moves: moves.map(([p, f, t]) => move(p, f, t)),
    ...extra,
  } as DailyAction;
}

type Pickup = NonNullable<DailyAction["transaction"]>["pickup"];
const pickup = { player_id: 99, name: "Kawhi Leonard", team: "LAC", valid_positions: ["SF"], avg_points_season: 30, games_remaining: 2, has_b2b: false, b2b_game_count: 0, game_days: [0], streamer_score: 40, injured: false } as unknown as Pickup;

const START = action("start", 11, [[11, BE, UT], [8, UT, BE]], { game_time_et: "22:00", counterpart: who(8) });
const START_EARLY = action("start", 12, [[12, BE, C]], { game_time_et: "19:30" });
const IR_IN = action("ir_in", 8, [[8, UT, IR]]);
const IR_OUT = action("ir_out", 14, [[14, IR, BE]]);
const IR_BLOCKED = action("ir_out", 15, [], { blocked_reason: "roster_full" });
const ADD_DROP = action("add_drop", 99, [], { transaction: { pickup, drop_player_id: 12 }, counterpart: who(12, "Keegan Murray") });
const ADD = action("add", 98, [], { transaction: { pickup: { ...pickup, player_id: 98 }, drop_player_id: null } });

function player(pid: number, slot: number, eligible: number[], extra: Partial<LineupPlayer> = {}): LineupPlayer {
  return {
    player_id: pid, nba_player_id: null, name: `P${pid}`, team: "DEN",
    lineup_slot_id: slot, lineup_slot: slotName(slot),
    eligible_slot_ids: eligible, eligible_slots: eligible.map(slotName),
    injured: false, injury_status: null, default_position_id: null, lineup_locked: false,
    has_game_today: true, opponent: "vs LAL", game_time_et: "19:30", game_started: false,
    locked: false, playable: true, avg_points: 30, value_kind: "fpts", value_source: null,
    ...extra,
  };
}

function board(players: LineupPlayer[]): LineupState {
  return {
    provider: "espn", team_name: "Test", espn_team_id: 1, nba_date: "2026-10-20",
    scoring_period_id: 1, scoring_period_source: "provider", current_scoring_period_id: 1,
    final_scoring_period_id: 167, first_game_time_et: "19:00", position_limits: {},
    slot_counts: { "4": 1, "11": 2, "12": 2, "13": 1 },
    slots: [
      { slot_id: C, slot: "C", count: 1 },
      { slot_id: UT, slot: "UT", count: 2 },
      { slot_id: BE, slot: "BE", count: 2 },
      { slot_id: IR, slot: "IR", count: 1 },
    ],
    lock_type: "INDIVIDUAL_GAME", players, can_write: true, write_blocked_reason: null,
    roster_version: "v1", fetched_at: "2026-10-20T20:00:00Z", acquisitions: null,
  };
}

// The board START and IR_IN were worked out against: 8 is OUT in UT, 11 waits on the bench, the IR seat is open.
const BOARD = board([
  player(10, C, [C, UT, BE]),
  player(8, UT, [UT, BE, IR], { injured: true, injury_status: "OUT" }),
  player(9, UT, [UT, BE]),
  player(11, BE, [UT, BE]),
]);

describe("sortActions", () => {
  test("kind order, then tip-off, then name; idempotent", () => {
    const sorted = sortActions([ADD, START, IR_IN, START_EARLY, IR_OUT, ADD_DROP]);
    expect(sorted.map((a) => a.id)).toEqual(["ir_out:14", "ir_in:8", "start:12", "start:11", "add:98", "add_drop:99"]);
    expect(sortActions(sorted)).toEqual(sorted);
  });
});

describe("rows and staging", () => {
  test("lineup rows have moves and no block; add rows carry a pickup", () => {
    expect([START, IR_IN, IR_OUT].every(isLineupAction)).toBe(true);
    expect(isLineupAction(IR_BLOCKED)).toBe(false);
    expect(isLineupAction(ADD_DROP)).toBe(false);
    expect(isTransactionAction(ADD_DROP) && isTransactionAction(ADD)).toBe(true);
    expect(isTransactionAction(START)).toBe(false);
  });

  test("a lineup row is staged by its subject only, so overlapping rows both count", () => {
    const staged: Staged = { 11: UT, 8: IR };
    expect(isRowStaged(staged, START)).toBe(true);
    expect(isRowStaged(staged, IR_IN)).toBe(true);
    expect(isRowStaged({}, START)).toBe(false);
    expect(unstagedLineupActions([START, IR_IN, IR_OUT, ADD], staged).map((a) => a.id)).toEqual(["ir_out:14"]);
  });

  test("stage all lands starts before IR, so a benched OUT starter still goes to IR", () => {
    expect(stageAllOrder([IR_IN, IR_OUT, START, START_EARLY]).map((a) => a.id)).toEqual(["start:11", "start:12", "ir_in:8", "ir_out:14"]);
  });

  test("a start pressed after the IR row leaves its OUT starter on IR", () => {
    const irFirst = stageRow(BOARD, stageRow(BOARD, {}, IR_IN), START);
    expect(irFirst).toEqual({ 11: UT, 8: IR });
    const startFirst = stageRow(BOARD, stageRow(BOARD, {}, START), IR_IN);
    expect(startFirst).toEqual({ 11: UT, 8: IR });
    for (const staged of [irFirst, startFirst]) {
      expect(isRowStaged(staged, START) && isRowStaged(staged, IR_IN)).toBe(true);
      expect(validateStaged(BOARD, staged)).toEqual([]);
    }
    // On its own, the start row still benches him.
    expect(stageRow(BOARD, {}, START)).toEqual({ 11: UT, 8: BE });
  });

  test("taking back one of two overlapping rows keeps the other", () => {
    const rows = [IR_IN, START];
    const both: Staged = { 11: UT, 8: IR };
    // The start row goes; he stays on IR.
    const noStart = unstageRow(BOARD, both, START, rows);
    expect(noStart).toEqual({ 8: IR });
    expect(isRowStaged(noStart, IR_IN)).toBe(true);
    expect(validateStaged(BOARD, noStart)).toEqual([]);
    // The IR row goes; the start row still staged benches him, so UT isn't over capacity.
    const noIr = unstageRow(BOARD, both, IR_IN, rows);
    expect(noIr).toEqual({ 11: UT, 8: BE });
    expect(isRowStaged(noIr, START)).toBe(true);
    expect(validateStaged(BOARD, noIr)).toEqual([]);
    // Alone, a row comes back whole.
    expect(unstageRow(BOARD, { 11: UT, 8: BE }, START, rows)).toEqual({});
  });

  test("stage all leaves out a row that would overfill the slot an earlier row filled", () => {
    // C is open: 14 is healthy on IR and 12 waits on the bench, and each row was worked out to take C.
    const open = board([player(12, BE, [C, UT, BE]), player(14, IR, [C, UT, BE, IR]), player(9, UT, [UT, BE]), player(11, UT, [UT, BE])]);
    const IR_OUT_C = action("ir_out", 14, [[14, IR, C]]);
    const all = stageAllFold(open, {}, [IR_OUT_C, START_EARLY]);
    expect(all.staged).toEqual({ 12: C });
    expect(all.rows.map((a) => a.id)).toEqual(["start:12"]);
    expect(validateStaged(open, all.staged)).toEqual([]);
    // A problem the staging already had doesn't hold a row back.
    const overfull = stageAllFold(open, { 14: UT }, [START_EARLY]);
    expect(overfull.staged).toEqual({ 14: UT, 12: C });
    expect(overfull.rows).toHaveLength(1);
    // Rows that fit together all land.
    const overlap = stageAllFold(BOARD, {}, [IR_IN, START]);
    expect(overlap.staged).toEqual({ 11: UT, 8: IR });
    expect(overlap.rows.map((a) => a.id)).toEqual(["start:11", "ir_in:8"]);
  });

  test("an add row is staged while its free agent waits in the dock with its drop, made now", () => {
    expect(isAddStaged(ADD_DROP, { faId: 99, replaces: 12, from: null }, NO_DROP)).toBe(true);
    expect(isAddStaged(ADD_DROP, { faId: 99, replaces: 7, from: null }, NO_DROP)).toBe(false);
    expect(isAddStaged(ADD_DROP, { faId: 99, replaces: 12, from: 3 }, NO_DROP)).toBe(false);
    expect(isAddStaged(ADD, { faId: 98, replaces: NO_DROP, from: null }, NO_DROP)).toBe(true);
    expect(isAddStaged(ADD, null, NO_DROP)).toBe(false);
    expect(isAddStaged(START, { faId: 11, replaces: NO_DROP, from: null }, NO_DROP)).toBe(false);
  });

  test("the button: Stage, Staged (unstages), or Blocked with the reason", () => {
    expect(rowButton(START, { staged: false, cannot: null })).toEqual({ label: "Stage", intent: "stage", disabled: false, reason: null });
    expect(rowButton(START, { staged: true, cannot: null })).toEqual({ label: "Staged", intent: "unstage", disabled: false, reason: null });
    expect(rowButton(ADD, { staged: false, cannot: "Refreshing" })).toEqual({ label: "Stage", intent: "stage", disabled: true, reason: "Refreshing" });
    // Staged rows can always be unstaged, whatever else is going on.
    expect(rowButton(ADD, { staged: true, cannot: "Refreshing" }).disabled).toBe(false);
    expect(rowButton(IR_BLOCKED, { staged: false, cannot: null })).toEqual({ label: "Blocked", intent: "none", disabled: true, reason: "Roster full: drop a player first" });
  });

  test("the board moved on: another roster, or another day", () => {
    const data = { roster_version: "v1", scoring_period_id: 5 };
    expect(boardMismatch(data, { roster_version: "v1", scoring_period_id: 5 })).toBe(false);
    expect(boardMismatch(data, { roster_version: "v2", scoring_period_id: 5 })).toBe(true);
    expect(boardMismatch(data, { roster_version: "v1", scoring_period_id: 6 })).toBe(true);
    expect(boardMismatch(data, null)).toBe(false);
    expect(boardMismatch({ roster_version: null, scoring_period_id: null }, { roster_version: "v2", scoring_period_id: 6 })).toBe(false);
  });

  test("only a real free-agent failure is worth a hint", () => {
    expect(streamersHint({ streamers_error: null })).toBeNull();
    expect(streamersHint({ streamers_error: "day_mismatch" })).toBeNull();
    expect(streamersHint({ streamers_error: "provider_error" })).toContain("Free agents unavailable");
  });
});

describe("the strip's line", () => {
  test("surnames, suffixes dropped", () => {
    expect(surname("Jaren Jackson Jr.")).toBe("Jackson");
    expect(surname("Alperen Şengün")).toBe("Şengün");
    expect(surname("Nenê")).toBe("Nenê");
    expect(surname("Karl-Anthony Towns")).toBe("Towns");
  });

  test("each kind reads as a verb and names", () => {
    expect(moveLine({ ...START, player: who(11, "Derrick White") })).toBe("Start White");
    expect(moveLine({ ...IR_IN, player: who(8, "Tyrese Maxey") })).toBe("Maxey to IR");
    expect(moveLine({ ...IR_OUT, player: who(14, "Joel Embiid") })).toBe("Embiid off IR");
    expect(moveLine({ ...ADD, player: who(98, "Day'Ron Sharpe") })).toBe("Add Sharpe");
    expect(moveLine({ ...ADD_DROP, player: who(99, "Kawhi Leonard") })).toBe("Leonard for Murray");
    // Too long for the strip: the pickup alone.
    expect(moveLine({ ...ADD_DROP, player: who(99, "Nickeil Alexander-Walker"), counterpart: who(12, "Kentavious Caldwell-Pope") })).toBe("Add Alexander-Walker");
  });
});
