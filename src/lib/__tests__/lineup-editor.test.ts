import { describe, expect, test } from "bun:test";
import {
  BENCH_SLOT_ID,
  EDITABLE_SLOT_IDS,
  IR_SLOT_ID,
  assignment,
  diff,
  eligibleTargets,
  formatNbaDate,
  formatTipTime,
  gameLabel,
  isActiveSlot,
  isStale,
  lockLabel,
  moveLabel,
  moveRole,
  planToStaged,
  slotName,
  slotRows,
  stage,
  staleLineup,
  unstage,
  validateStaged,
  type Staged,
} from "../lineup-editor";
import { ApiError } from "../api-error";
import { MOCK_LINEUP_PLAN, MOCK_LINEUP_STATE } from "../../__fixtures__/lineupState";
import type { LineupPlayer, LineupState } from "../../types/lineup-editor";

const PG = 0, SG = 1, SF = 2, G = 5, UT = 11, BE = 12, IR = 13;

function player(
  overrides: Partial<LineupPlayer> & {
    player_id: number;
    lineup_slot_id: number;
    eligible_slot_ids: number[];
  }
): LineupPlayer {
  return {
    nba_player_id: null,
    name: `P${overrides.player_id}`,
    team: "DEN",
    lineup_slot: slotName(overrides.lineup_slot_id),
    eligible_slots: overrides.eligible_slot_ids.map(slotName),
    injured: false,
    injury_status: null,
    lineup_locked: false,
    has_game_today: true,
    opponent: "vs LAL",
    game_time_et: "19:30",
    game_started: false,
    locked: false,
    playable: true,
    avg_points: 30,
    value_kind: "fpts",
    value_source: null,
    ...overrides,
  };
}

/** A small league: PG, SG, G, 2 UT, 2 BE, 1 IR. */
function board(players: LineupPlayer[], overrides: Partial<LineupState> = {}): LineupState {
  return {
    provider: "espn",
    team_name: "Test",
    espn_team_id: 1,
    nba_date: "2026-10-20",
    scoring_period_id: 1,
    scoring_period_source: "provider",
    first_game_time_et: "19:00",
    slot_counts: { "0": 1, "1": 1, "5": 1, "11": 2, "12": 2, "13": 1 },
    slots: [
      { slot_id: PG, slot: "PG", count: 1 },
      { slot_id: SG, slot: "SG", count: 1 },
      { slot_id: G, slot: "G", count: 1 },
      { slot_id: UT, slot: "UT", count: 2 },
      { slot_id: BE, slot: "BE", count: 2 },
      { slot_id: IR, slot: "IR", count: 1 },
    ],
    lock_type: "INDIVIDUAL_GAME",
    players,
    can_write: true,
    write_blocked_reason: null,
    roster_version: "v1",
    fetched_at: "2026-10-20T20:00:00Z",
    ...overrides,
  };
}

// PG 1, SG 2 (locked), G 3, UT 4 + 5, BE 6 (game) + empty, IR 7.
const pg = player({ player_id: 1, lineup_slot_id: PG, eligible_slot_ids: [PG, G, UT, BE] });
const sgLocked = player({
  player_id: 2, lineup_slot_id: SG, eligible_slot_ids: [SG, G, UT, BE],
  game_started: true, locked: true,
});
const g = player({ player_id: 3, lineup_slot_id: G, eligible_slot_ids: [PG, SG, G, UT, BE] });
const ut1 = player({
  player_id: 4, lineup_slot_id: UT, eligible_slot_ids: [SG, UT, BE],
  has_game_today: false, opponent: null, game_time_et: null, playable: false,
});
const ut2 = player({ player_id: 5, lineup_slot_id: UT, eligible_slot_ids: [PG, G, UT, BE] });
const bench = player({ player_id: 6, lineup_slot_id: BE, eligible_slot_ids: [SG, G, UT, BE, IR] });
const ir = player({
  player_id: 7, lineup_slot_id: IR, eligible_slot_ids: [PG, G, UT, BE, IR],
  injured: true, injury_status: "OUT", playable: false,
});
const STATE = board([pg, sgLocked, g, ut1, ut2, bench, ir]);

const rowsBySlot = (rows: ReturnType<typeof slotRows>, slot: number) =>
  rows.filter((r) => r.slot_id === slot).map((r) => r.player?.player_id ?? null);

describe("slots", () => {
  test("editable slots are 0..13, never ESPN's 14/15", () => {
    expect(EDITABLE_SLOT_IDS).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(isActiveSlot(11)).toBe(true);
    expect(isActiveSlot(BENCH_SLOT_ID)).toBe(false);
    expect(slotName(9)).toBe("PF/C");
    expect(slotName(15)).toBe("Slot 15");
  });
});

describe("slotRows", () => {
  test("one row per slot instance, empties last in their group", () => {
    const rows = slotRows(STATE, {});
    expect(rows).toHaveLength(8);
    expect(rowsBySlot(rows, UT)).toEqual([4, 5]);
    expect(rowsBySlot(rows, BE)).toEqual([6, null]);
    expect(rows.filter((r) => r.slot_id === BE).map((r) => r.ordinal)).toEqual([0, 1]);
  });

  test("a swapped-in player takes the vacated ordinal", () => {
    const staged = stage(STATE, {}, bench.player_id, UT); // swaps with ut1 (no game)
    const rows = slotRows(STATE, staged);
    expect(rowsBySlot(rows, UT)).toEqual([6, 5]);
    expect(rowsBySlot(rows, BE)).toEqual([4, null]);
  });
});

describe("eligibleTargets", () => {
  test("a bench player may take an empty-capacity slot or swap with an unlocked eligible holder", () => {
    // UT: ut1 can go to BE (anyone can) → swap; G: g can go to BE → swap; SG: locked → no.
    // IR: he is IR-eligible and IR is full of ir, who is eligible for BE → swap.
    expect(eligibleTargets(STATE, {}, bench.player_id)).toEqual([G, UT, IR]);
  });

  test("a locked player has no targets", () => {
    expect(eligibleTargets(STATE, {}, sgLocked.player_id)).toEqual([]);
  });

  test("UT → UT is not a target; the bench always is", () => {
    const targets = eligibleTargets(STATE, {}, ut2.player_id);
    expect(targets).not.toContain(UT);
    expect(targets).toContain(BE);
    // PG holder is eligible for UT → swap allowed; G holder likewise.
    expect(targets).toEqual([PG, G, BE]);
  });

  test("IR only when the player is IR-eligible and the IR holder can leave", () => {
    expect(eligibleTargets(STATE, {}, pg.player_id)).not.toContain(IR); // not IR-eligible
    const irLockedBoard = board([pg, sgLocked, g, ut1, ut2, bench, { ...ir, locked: true }]);
    expect(eligibleTargets(irLockedBoard, {}, bench.player_id)).not.toContain(IR);
    const openIr = board([pg, sgLocked, g, ut1, ut2, bench]);
    expect(eligibleTargets(openIr, {}, bench.player_id)).toContain(IR);
  });

  test("a full slot whose holders are all locked is never a target", () => {
    const lockedUt = board([
      pg, sgLocked, g,
      { ...ut1, locked: true, game_started: true },
      { ...ut2, locked: true, game_started: true },
      bench, ir,
    ]);
    expect(eligibleTargets(lockedUt, {}, bench.player_id)).not.toContain(UT);
  });

  test("the bench is not a target when it is full of locked players", () => {
    const fullBench = board([
      pg, sgLocked, g, ut1, ut2,
      { ...bench, locked: true },
      player({ player_id: 8, lineup_slot_id: BE, eligible_slot_ids: [UT, BE], locked: true }),
      ir,
    ]);
    expect(eligibleTargets(fullBench, {}, ut2.player_id)).not.toContain(BE);
  });
});

describe("stage / unstage", () => {
  test("into spare capacity stages one move", () => {
    const staged = stage(STATE, {}, ut1.player_id, BE);
    expect(staged).toEqual({ 4: BE });
    expect(diff(STATE, staged)).toEqual([{ player_id: 4, from_slot_id: UT, to_slot_id: BE }]);
  });

  test("into a full slot swaps with the first unlocked holder eligible for the mover's slot", () => {
    const staged = stage(STATE, {}, bench.player_id, G);
    expect(staged).toEqual({ 6: G, 3: BE });
  });

  test("a two-step chain via successive stages", () => {
    // bench → UT (ut1 sits), then the benched ut1 → SG? locked. ut1 → G instead (g sits).
    let staged: Staged = stage(STATE, {}, bench.player_id, UT);
    expect(staged).toEqual({ 6: UT, 4: BE });
    staged = stage(STATE, staged, ut2.player_id, G); // ut2 UT → G, g G → UT
    expect(assignment(STATE, staged).get(5)).toBe(G);
    expect(assignment(STATE, staged).get(3)).toBe(UT);
    expect(diff(STATE, staged)).toHaveLength(4);
    expect(validateStaged(STATE, staged)).toEqual([]);
  });

  test("staging back onto the server slot clears the entry", () => {
    const staged = stage(STATE, { 4: BE }, ut1.player_id, UT);
    expect(staged).toEqual({});
  });

  test("a no-op or impossible target returns the same staging", () => {
    const start: Staged = {};
    expect(stage(STATE, start, ut2.player_id, UT)).toBe(start);
    expect(stage(STATE, start, sgLocked.player_id, BE)).not.toBe(start); // locked movers are the UI's job…
    expect(stage(STATE, start, bench.player_id, SG)).toBe(start); // …but a locked holder blocks the swap
  });

  test("unstage undoes both halves of a swap", () => {
    const staged = stage(STATE, {}, bench.player_id, UT);
    expect(unstage(STATE, staged, bench.player_id)).toEqual({});
    expect(unstage(STATE, staged, ut1.player_id)).toEqual({});
  });

  test("unstage leaves an unrelated move alone", () => {
    const staged: Staged = { 4: BE, 6: G, 3: BE };
    expect(unstage(STATE, staged, ut1.player_id)).toEqual({ 6: G, 3: BE });
  });
});

describe("diff ordering", () => {
  test("starts before benchings, with a swap's two moves adjacent", () => {
    const staged: Staged = { 4: BE, 6: UT, 5: BE };
    const moves = diff(STATE, staged);
    expect(moves.map((m) => m.player_id)).toEqual([6, 4, 5]);
    expect(moveRole(moves[0])).toBe("start");
    expect(moveRole(moves[1])).toBe("bench");
  });

  test("moveRole classifies IR moves as shifts", () => {
    expect(moveRole({ from_slot_id: IR, to_slot_id: BE })).toBe("bench");
    expect(moveRole({ from_slot_id: BE, to_slot_id: IR })).toBe("shift");
    expect(moveRole({ from_slot_id: PG, to_slot_id: G })).toBe("shift");
  });
});

describe("validateStaged", () => {
  test("clean staging has no errors", () => {
    expect(validateStaged(STATE, stage(STATE, {}, bench.player_id, UT))).toEqual([]);
  });

  test("over capacity is a slot-level CAPACITY error", () => {
    const errors = validateStaged(STATE, { 6: UT });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ player_id: null, code: "CAPACITY" });
    expect(errors[0].message).toContain("UT");
  });

  test("locked and ineligible movers are reported per player, before capacity", () => {
    const errors = validateStaged(STATE, { 2: BE, 1: SG });
    expect(errors.map((e) => e.code).sort()).toEqual(["INELIGIBLE", "LOCKED"]);
    expect(errors.find((e) => e.code === "LOCKED")?.player_id).toBe(2);
    expect(errors.find((e) => e.code === "INELIGIBLE")?.player_id).toBe(1);
  });

  test("ESPN's 14/15 are untouchable", () => {
    const odd = board([...STATE.players, player({ player_id: 9, lineup_slot_id: 14, eligible_slot_ids: [UT, BE] })]);
    expect(validateStaged(odd, { 9: BE })).toEqual([
      { player_id: 9, code: "UNTOUCHABLE_SLOT", message: "That slot cannot be edited" },
    ]);
    expect(eligibleTargets(odd, {}, 9)).toEqual([]);
  });
});

describe("planToStaged", () => {
  test("round-trips through diff for the fixture plan", () => {
    const staged = planToStaged(MOCK_LINEUP_STATE, MOCK_LINEUP_PLAN);
    const moves = diff(MOCK_LINEUP_STATE, staged);
    const key = (m: { player_id: number; from_slot_id: number; to_slot_id: number }) =>
      `${m.player_id}:${m.from_slot_id}>${m.to_slot_id}`;
    expect(moves.map(key).sort()).toEqual(MOCK_LINEUP_PLAN.moves.map(key).sort());
    expect(validateStaged(MOCK_LINEUP_STATE, staged)).toEqual([]);
    // Swap pairs stay adjacent: Green in for Williams, Monk in for Leonard.
    expect(moves.map((m) => m.player_id)).toEqual([4432639, 4395628, 4066261, 6450]);
  });

  test("ignores moves for players not on the board", () => {
    const staged = planToStaged(STATE, {
      ...MOCK_LINEUP_PLAN,
      moves: [{ ...MOCK_LINEUP_PLAN.moves[0], player_id: 999 }],
    });
    expect(staged).toEqual({});
  });
});

describe("stale boards", () => {
  const fresh = { ...STATE, roster_version: "v2" };
  const stale = new ApiError({
    message: "Roster changed",
    status: 409,
    code: "ROSTER_STALE",
    apiStatus: "conflict",
    data: { lineup: fresh },
  });

  test("isStale recognises ROSTER_STALE and a differing roster_version", () => {
    expect(isStale(STATE, stale)).toBe(true);
    expect(staleLineup(stale)?.roster_version).toBe("v2");
    expect(isStale(STATE, new Error("boom"))).toBe(false);
    expect(staleLineup({ data: {} })).toBeNull();
  });
});

describe("labels", () => {
  test("tip times and dates", () => {
    expect(formatTipTime("19:30")).toBe("7:30 PM");
    expect(formatTipTime("00:05")).toBe("12:05 AM");
    expect(formatTipTime("12:00")).toBe("12:00 PM");
    expect(formatTipTime(null)).toBe("");
    expect(formatNbaDate("2026-10-20")).toBe("Tue, Oct 20");
    expect(formatNbaDate(null)).toBe("");
  });

  test("game, lock and move labels", () => {
    expect(gameLabel(pg)).toBe("vs LAL · 7:30 PM");
    expect(gameLabel(ut1)).toBe("No game");
    expect(lockLabel(pg)).toBeNull();
    expect(lockLabel(sgLocked)).toBe("Locked — game started 7:30 PM");
    expect(lockLabel({ ...pg, locked: true, lineup_locked: true })).toBe("Locked by ESPN");
    expect(moveLabel(STATE, { player_id: 6, from_slot_id: BE, to_slot_id: UT })).toBe("P6: BE → UT");
  });
});

describe("gameLabel compact", () => {
  test("phone form drops the separator and shortens the meridiem", () => {
    expect(gameLabel(pg, { compact: true })).toBe("vs LAL 7:30P");
    expect(gameLabel({ has_game_today: true, opponent: "@ BOS", game_time_et: "00:30" }, { compact: true })).toBe("@ BOS 12:30A");
  });
});
