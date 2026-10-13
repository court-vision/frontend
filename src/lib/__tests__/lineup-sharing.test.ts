import { describe, expect, test } from "bun:test";
import { replaceEqualDeep } from "@tanstack/react-query";
import { shareActions, shareLineup } from "../lineup-sharing";
import { DEMO_STREAMERS, demoDailyActions } from "../week-demo";
import type { DailyActionsData } from "../../types/daily-actions";
import type { LineupState } from "../../types/lineup-editor";
import * as F from "./week-api-fixtures";

// The server stamps every read with the moment it was made, as `lineup_read_service` does.
let reads = 0;
const stamp = () => `2026-10-28T19:${String(reads++ % 60).padStart(2, "0")}:00-04:00`;
const board = (over: Partial<LineupState> = {}): LineupState => ({ ...F.espnBoard(), fetched_at: stamp(), ...over });
const moves = (b: LineupState): DailyActionsData => demoDailyActions(b, DEMO_STREAMERS.slice(0, 5));

describe("shareLineup", () => {
  test("a read that differs only in its read stamp keeps the cached board", () => {
    const prev = board();
    const next = board();
    expect(next.fetched_at).not.toBe(prev.fetched_at);
    // TanStack's own sharing alone hands back a new board for it.
    expect(replaceEqualDeep(prev, next)).not.toBe(prev);
    expect(shareLineup(prev, next)).toBe(prev);
  });

  test("any other change is a new board with the new stamp; unchanged players keep their objects", () => {
    const prev = board();
    const players = prev.players.map((p, i) => (i === 1 ? { ...p, lineup_slot_id: 12, lineup_slot: "BE" } : { ...p }));
    const next = board({ roster_version: "v-2", players });
    const shared = shareLineup(prev, next) as LineupState;
    expect(shared).not.toBe(prev);
    expect(shared.fetched_at).toBe(next.fetched_at);
    expect(shared.roster_version).toBe("v-2");
    expect(shared.players[0]).toBe(prev.players[0]);
    expect(shared.players[1]).not.toBe(prev.players[1]);
    expect(shared.players[1].lineup_slot).toBe("BE");
  });

  test("a lock as a game tips is a change", () => {
    const prev = board();
    const next = board({ players: prev.players.map((p, i) => (i === 0 ? { ...p, locked: true, game_started: true } : p)) });
    expect(shareLineup(prev, next)).not.toBe(prev);
  });

  test("a first read, or a team with no board, is the read itself", () => {
    const next = board();
    expect(shareLineup(undefined, next)).toBe(next);
    expect(shareLineup(null, next)).toBe(next);
    expect(shareLineup(board(), null)).toBeNull();
    expect(shareLineup(null, null)).toBeNull();
  });
});

describe("shareActions", () => {
  test("the same moves worked out against a re-stamped board keep the cached answer", () => {
    const prev = moves(board());
    const next = moves(board());
    expect(next.lineup?.fetched_at).not.toBe(prev.lineup?.fetched_at);
    expect(replaceEqualDeep(prev, next)).not.toBe(prev);
    expect(shareActions(prev, next)).toBe(prev);
  });

  test("moves that changed are a new answer; what didn't change keeps its objects", () => {
    const prev = moves(board());
    const next = { ...moves(board()), streamers_error: "ESPN's free agents didn't load" };
    const shared = shareActions(prev, next) as DailyActionsData;
    expect(shared).not.toBe(prev);
    expect(shared.streamers_error).toBe("ESPN's free agents didn't load");
    expect(shared.actions).toBe(prev.actions);
    expect(shared.lineup?.players).toBe(prev.lineup?.players);
  });

  test("an answer without a board is shared as usual", () => {
    const prev = { ...moves(board()), lineup: null };
    expect(shareActions(prev, { ...prev })).toBe(prev);
    expect(shareActions(prev, { ...prev, can_write: !prev.can_write })).not.toBe(prev);
  });
});
