import { describe, expect, test } from "bun:test";
import {
  boardMismatch,
  isLineupAction,
  isRowStaged,
  isTransactionAction,
  rowButton,
  rowBlockedCopy,
  sortActions,
  streamersHint,
  suggestedDropId,
  unstagedLineupActions,
} from "../daily-actions";
import type { Staged } from "../lineup-editor";
import type { DailyAction, DailyActionKind } from "../../types/daily-actions";

const UT = 11, BE = 12, IR = 13, C = 4;

function move(pid: number, from: number, to: number) {
  const role = from === BE && to < BE ? "start" : to === BE ? "bench" : "shift";
  return { player_id: pid, name: `P${pid}`, from_slot_id: from, from_slot: String(from), to_slot_id: to, to_slot: String(to), role } as const;
}

const who = (pid: number) => ({
  player_id: pid,
  nba_player_id: null,
  name: `P${pid}`,
  team: "DEN",
  injury_status: null,
  lineup_slot_id: null,
  lineup_slot: null,
  avg_points: null,
});

function action(
  kind: DailyActionKind,
  pid: number,
  moves: Array<[number, number, number]> = [],
  extra: Partial<DailyAction> = {}
): DailyAction {
  return {
    id: `${kind}:${pid}`,
    kind,
    title: `${kind} ${pid}`,
    player: who(pid),
    moves: moves.map(([p, f, t]) => move(p, f, t)),
    ...extra,
  } as DailyAction;
}

const pickup = { player_id: 99, name: "Kawhi", team: "LAC", valid_positions: ["SF"], avg_points_season: 30, games_remaining: 2, has_b2b: false, b2b_game_count: 0, game_days: [0], streamer_score: 40, injured: false } as DailyAction["transaction"] extends infer T ? (T extends { pickup: infer P } ? P : never) : never;

const START = action("start", 11, [[11, BE, UT], [8, UT, BE]], { game_time_et: "22:00", counterpart: who(8) });
const START_EARLY = action("start", 12, [[12, BE, C]], { game_time_et: "19:30" });
const IR_IN = action("ir_in", 8, [[8, UT, IR]]);
const IR_OUT = action("ir_out", 14, [[14, IR, BE]]);
const IR_BLOCKED = action("ir_out", 15, [], { blocked_reason: "roster_full", detail: "Roster full — drop a player first" });
const ADD_DROP = action("add_drop", 99, [], { transaction: { pickup, drop_player_id: 12 } });
const ADD = action("add", 98, [], { transaction: { pickup: { ...pickup, player_id: 98 }, drop_player_id: null } });

describe("sortActions", () => {
  test("kind order, then tip-off, then name; idempotent", () => {
    const sorted = sortActions([ADD, START, IR_IN, START_EARLY, IR_OUT, ADD_DROP]);
    expect(sorted.map((a) => a.id)).toEqual(["ir_out:14", "ir_in:8", "start:12", "start:11", "add:98", "add_drop:99"]);
    expect(sortActions(sorted)).toEqual(sorted);
  });
});

describe("row classification", () => {
  test("lineup rows have moves and no block; transaction rows carry a pickup", () => {
    expect([START, IR_IN, IR_OUT].every(isLineupAction)).toBe(true);
    expect(isLineupAction(IR_BLOCKED)).toBe(false);
    expect(isLineupAction(ADD_DROP)).toBe(false);
    expect(isTransactionAction(ADD_DROP) && isTransactionAction(ADD)).toBe(true);
    expect(isTransactionAction(START)).toBe(false);
  });

  test("staged is subject-only, so overlapping rows both count", () => {
    const staged: Staged = { 11: UT, 8: IR }; // fill row benches 8, IR row then sends 8 to IR
    expect(isRowStaged(staged, START)).toBe(true);
    expect(isRowStaged(staged, IR_IN)).toBe(true);
    expect(isRowStaged({ 11: BE }, START)).toBe(false);
    expect(isRowStaged({}, IR_BLOCKED)).toBe(false);
  });

  test("unstagedLineupActions skips staged, blocked and transaction rows", () => {
    const rows = [START, IR_IN, IR_BLOCKED, ADD_DROP, START_EARLY];
    expect(unstagedLineupActions(rows, { 11: UT }).map((a) => a.id)).toEqual(["ir_in:8", "start:12"]);
  });
});

describe("rowButton", () => {
  test("lineup rows toggle Stage / Undo", () => {
    expect(rowButton(START, { staged: false, canWrite: true })).toEqual({ label: "Stage", intent: "stage", disabled: false, reason: null });
    expect(rowButton(START, { staged: true, canWrite: true })).toEqual({ label: "Undo", intent: "unstage", disabled: false, reason: null });
  });

  test("a read-only board disables with the board's own reason, except Undo", () => {
    const b = rowButton(START, { staged: false, canWrite: false, blockedReason: "writes_disabled" });
    expect(b.disabled).toBe(true);
    expect(b.reason).toContain("switched off");
    expect(rowButton(START, { staged: true, canWrite: false, blockedReason: "writes_disabled" }).disabled).toBe(false);
    expect(rowButton(ADD_DROP, { staged: false, canWrite: false, blockedReason: "no_credentials" }).reason).toContain("Manage Teams");
  });

  test("transaction rows open the dialog; a blocked IR-out offers the drop-only dialog", () => {
    expect(rowButton(ADD, { staged: false, canWrite: true })).toMatchObject({ label: "Pick up", intent: "transaction", disabled: false });
    expect(rowButton(ADD_DROP, { staged: false, canWrite: true })).toMatchObject({ label: "Add / drop", intent: "transaction" });
    const blocked = rowButton(IR_BLOCKED, { staged: false, canWrite: true });
    expect(blocked).toEqual({ label: "Drop a player…", intent: "drop", disabled: false, reason: "Roster full — drop a player first" });
    expect(rowButton(IR_BLOCKED, { staged: false, canWrite: false, blockedReason: "writes_disabled" }).disabled).toBe(true);
    expect(rowBlockedCopy(START)).toBeNull();
  });
});

describe("board-level checks", () => {
  test("boardMismatch only when both versions are known and differ", () => {
    expect(boardMismatch({ roster_version: "a" }, { roster_version: "b" })).toBe(true);
    expect(boardMismatch({ roster_version: "a" }, { roster_version: "a" })).toBe(false);
    expect(boardMismatch({ roster_version: "a" }, null)).toBe(false);
    expect(boardMismatch({ roster_version: null }, { roster_version: "b" })).toBe(false);
  });

  test("streamersHint is silent for the day and scale guards", () => {
    expect(streamersHint({ streamers_error: null })).toBeNull();
    expect(streamersHint({ streamers_error: "day_mismatch" })).toBeNull();
    expect(streamersHint({ streamers_error: "value_kind_mismatch" })).toBeNull();
    expect(streamersHint({ streamers_error: "ESPN timed out" })).toBe("Free agents unavailable");
  });

  test("suggestedDropId comes from the add_drop row", () => {
    expect(suggestedDropId([START, ADD_DROP])).toBe(12);
    expect(suggestedDropId([START, ADD])).toBeUndefined();
  });
});
