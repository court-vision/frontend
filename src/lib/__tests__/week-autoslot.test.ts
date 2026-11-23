import { describe, expect, test } from "bun:test";
import { sendLineupDays } from "@/components/week/lineup-send";
import { diff, normalize, type Staged } from "../lineup-editor";
import { heldMoves, lineupsBeforeSend, planDays, unstageHeld, wholeLineup, type CarryInput } from "../week-autoslot";
import type { LineupPlayer, LineupState } from "@/types/lineup-editor";
import { MOCK_LINEUP_STATE } from "../../__fixtures__/lineupState";

// A small roster: one G and one UT spot, three bench spots, one IR spot.
const G = 5, UT = 11, BE = 12, IR = 13;
const X = 1, Y = 2, Z = 3, W = 4, HURT = 5;
const NAMES: Record<number, string> = { [X]: "X", [Y]: "Y", [Z]: "Z", [W]: "W", [HURT]: "Hurt" };

/** ESPN's lineup for a day: everyone where `slots` puts them. */
function boardOf(day: number, slots: Record<number, number>, version = `v${day}`): LineupState {
  const template = MOCK_LINEUP_STATE.players[0];
  const players: LineupPlayer[] = Object.entries(slots).map(([id, slot]) => ({
    ...template,
    player_id: Number(id),
    name: NAMES[Number(id)] ?? `#${id}`,
    lineup_slot_id: slot,
    eligible_slot_ids: Number(id) === HURT ? [G, UT, BE, IR] : [G, UT, BE],
    locked: false,
    game_started: false,
    injury_status: Number(id) === HURT ? "OUT" : null,
  }));
  return {
    ...MOCK_LINEUP_STATE,
    scoring_period_id: 20 + day,
    current_scoring_period_id: 20,
    nba_date: `2026-11-${23 + day}`,
    roster_version: version,
    slot_counts: { [G]: 1, [UT]: 1, [BE]: 3, [IR]: 1 },
    slots: [
      { slot_id: G, slot: "G", count: 1 },
      { slot_id: UT, slot: "UT", count: 1 },
      { slot_id: BE, slot: "BE", count: 3 },
      { slot_id: IR, slot: "IR", count: 1 },
    ],
    players,
  } as LineupState;
}

// Every day as ESPN holds it now: Y starts at G, Z at UT; X and W sit; Hurt is on IR.
const LINEUP0 = { [X]: BE, [Y]: G, [Z]: UT, [W]: BE, [HURT]: IR };
const DAYS = 4;
const flat = () => Array.from({ length: DAYS }, (_, d) => boardOf(d, LINEUP0));
const slotsOf = (b: LineupState) => Object.fromEntries(b.players.map((p) => [p.player_id, p.lineup_slot_id]));
const input = (boards: LineupState[], stagedByDay: Record<number, Staged> = {}, held: number[] = []): CarryInput => ({
  boards,
  stagedByDay,
  held: new Set(held),
  played: () => false,
});

// Who plays each day: X only on day 0, W on days 1 and 3, Y and Z every day but day 2.
const PLAYS: Record<number, number[]> = { 0: [X, Y, Z], 1: [Y, Z, W], 2: [X, W], 3: [Y, Z, W] };
/** A stand-in for the desk's planner: the first two players who play take G and UT, everyone else sits. */
function planner(day: number, b: LineupState): Staged {
  const playing = PLAYS[day].filter((id) => b.players.some((p) => p.player_id === id));
  const target: Staged = {};
  for (const p of b.players) if (p.lineup_slot_id !== IR) target[p.player_id] = BE;
  if (playing[0] != null) target[playing[0]] = G;
  if (playing[1] != null) target[playing[1]] = UT;
  return normalize(b, target);
}

describe("lineupsBeforeSend", () => {
  test("a day with no edit of its own takes the staged edit of the day before", () => {
    const boards = flat();
    const before = lineupsBeforeSend(input(boards, { 0: { [X]: G, [Y]: BE } }));
    expect(before[0]!.get(X)).toBe(BE);
    expect(before[1]!.get(X)).toBe(G);
    expect(before[1]!.get(Y)).toBe(BE);
    // It carries on through the week until a day has its own edit.
    expect(before[3]!.get(X)).toBe(G);
  });

  test("a day with its own edit keeps it", () => {
    const boards = flat();
    boards[2] = boardOf(2, { ...LINEUP0, [W]: UT, [Z]: BE });
    const before = lineupsBeforeSend(input(boards, { 0: { [X]: G, [Y]: BE } }));
    expect(before[2]!.get(W)).toBe(UT);
    expect(before[2]!.get(X)).toBe(BE);
  });

  test("a player staged to drop doesn't count as an edit of the day he's gone from", () => {
    const boards = flat().map((b, d) => (d >= 1 ? { ...b, players: b.players.filter((p) => p.player_id !== W) } : b));
    const carry = { ...input(boards, { 0: { [X]: G, [Y]: BE } }), leaves: [{ id: W, from: 1 }] };
    expect(lineupsBeforeSend(carry)[1]!.get(X)).toBe(G);
  });

  test("a held day ends as planned, so the next one takes its plan", () => {
    const boards = flat();
    const staged = { 0: { [X]: G, [Y]: BE }, 1: wholeLineup(boards[1], {}) };
    const before = lineupsBeforeSend(input(boards, staged, [1]));
    expect(before[1]!.get(X)).toBe(G);
    expect(before[2]!.get(X)).toBe(BE);
    expect(before[2]!.get(Y)).toBe(G);
  });
});

describe("heldMoves", () => {
  test("a held day whose plan is ESPN's own lineup moves back what the day before carries in", () => {
    const boards = flat();
    const stagedByDay = { 0: { [X]: G, [Y]: BE }, 1: wholeLineup(boards[1], {}) };
    const before = lineupsBeforeSend(input(boards, stagedByDay, [1]));
    const moves = heldMoves(boards[1], before[1], normalize(boards[1], stagedByDay[1]));
    expect(moves.map((m) => [m.player_id, m.from_slot_id, m.to_slot_id]).sort()).toEqual([
      [X, G, BE],
      [Y, BE, G],
    ]);
  });

  test("taking one back leaves him, and the one he swaps with, as carried in", () => {
    const boards = flat();
    const stagedByDay = { 0: { [X]: G, [Y]: BE }, 1: wholeLineup(boards[1], {}) };
    const before = lineupsBeforeSend(input(boards, stagedByDay, [1]));
    const next = unstageHeld(boards[1], before[1], normalize(boards[1], stagedByDay[1]), X);
    expect(next[X]).toBe(G);
    expect(next[Y]).toBe(BE);
    expect(heldMoves(boards[1], before[1], normalize(boards[1], next))).toEqual([]);
  });
});

describe("planDays", () => {
  test("plans each day on the lineup the days before it carry in, and holds it whole", () => {
    const boards = flat();
    const out = planDays(input(boards), [0, 1, 2, 3], planner);
    expect([...out.held].sort()).toEqual([0, 1, 2, 3]);
    // Day 0 starts X (his only game) over Z; day 1 sits him again, though day 0's edit carries him in at G.
    expect(out.stagedByDay[0]).toMatchObject({ [X]: G, [Y]: UT, [Z]: BE });
    expect(out.stagedByDay[1]).toMatchObject({ [Y]: G, [Z]: UT, [X]: BE, [W]: BE });
    // Every player's slot is kept, IR untouched.
    expect(Object.keys(out.stagedByDay[1]).length).toBe(5);
    expect(out.stagedByDay[1][HURT]).toBe(IR);
    expect(out.changed).toEqual([0, 1, 2, 3]);
  });

  test("a day already as planned, with nothing staged before it, is left alone", () => {
    const boards = flat();
    const out = planDays(input(boards), [1], (_day, b) => normalize(b, { [Y]: G, [Z]: UT }));
    expect(out.held.size).toBe(0);
    expect(out.stagedByDay[1]).toBeUndefined();
    expect(out.changed).toEqual([]);
  });

  test("a planner with no plan for a day (today's failed) leaves it", () => {
    const boards = flat();
    const out = planDays(input(boards, { 0: { [X]: UT, [Z]: BE } }), [0, 1], (day, b) => (day === 0 ? null : planner(day, b)));
    expect(out.stagedByDay[0]).toEqual({ [X]: UT, [Z]: BE });
    expect(out.held.has(0)).toBe(false);
    expect(out.held.has(1)).toBe(true);
  });
});

describe("sending a planned week", () => {
  /** ESPN as the send sees it: an edit carries into later days until the next day with its own. */
  function fakeEspn(boards: LineupState[]) {
    const edits = new Map<number, Record<number, number>>([[-1, slotsOf(boards[0])]]);
    const slotsOn = (day: number) => {
      let at = -1;
      for (const d of edits.keys()) if (d <= day && d > at) at = d;
      return edits.get(at)!;
    };
    let version = 0;
    const read = (day: number) => boardOf(day, slotsOn(day), `r${version}`);
    return {
      read,
      write: (day: number, moves: Array<{ player_id: number; to_slot_id: number }>) => {
        const next = { ...slotsOn(day) };
        for (const m of moves) next[m.player_id] = m.to_slot_id;
        edits.set(day, next);
        version++;
        return read(day);
      },
    };
  }

  test("every day ends with its own plan, and a day already best is written back after the carry", async () => {
    const boards = flat();
    const planned = planDays(input(boards), [0, 1, 2, 3], planner);
    const carry = input(boards, planned.stagedByDay, [...planned.held]);
    const before = lineupsBeforeSend(carry);
    const pending = boards
      .map((b, day) => ({ day, label: `d${day}`, moves: heldMoves(b, before[day], normalize(b, planned.stagedByDay[day] ?? {})) }))
      .filter((p) => p.moves.length > 0);
    // Day 3's plan is ESPN's own lineup for it, but day 2's edit would carry over it.
    expect(planned.stagedByDay[3]).toMatchObject({ [Y]: G, [Z]: UT, [W]: BE });
    expect(pending.map((p) => p.day)).toEqual([0, 1, 2, 3]);

    const espn = fakeEspn(boards);
    const { done, failed } = await sendLineupDays(pending, {
      board: (day) => boards[day],
      moves: (day, b) => diff(b, normalize(b, planned.stagedByDay[day] ?? {})),
      apply: async (day, _b, moves) => ({ lineup: espn.write(day, moves), verified: true }),
      refresh: async (day) => espn.read(day),
      settle: () => {},
    });
    expect(failed).toBeNull();
    expect(done.map((d) => d.day)).toEqual([0, 1, 2, 3]);
    for (let day = 0; day < DAYS; day++) {
      expect(slotsOf(espn.read(day))).toEqual(wholeLineup(boards[day], planned.stagedByDay[day]));
    }
  });
});
