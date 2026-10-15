import { describe, expect, test } from "bun:test";
import { dropBlockedReason, unstageEverywhere, withoutDropped } from "../drops";
import { buildWeekGrid } from "../week-grid";
import { sourceFromStreamer } from "../week-source";
import { DEMO_DAYS, DEMO_STREAMERS, demoBoard, demoSchedule, demoSource } from "../week-demo";
import type { LineupState } from "@/types/lineup-editor";

const F = 6, BE = 12;

const source = demoSource();
const board = demoBoard();
const today = source.todayIndex!;
const idOf = (name: string) => board.players.find((p) => p.name === name)!.player_id;
const johnson = idOf("Jalen Johnson");
const white = idOf("Derrick White");
const murray = idOf("Keegan Murray");
const name = (seat: { player: { name: string } } | null) => seat?.player.name ?? null;

describe("withoutDropped", () => {
  const later = demoBoard(undefined, "demo-1", today + 1);
  const boards: Array<LineupState | undefined> = [undefined, board, later];

  test("leaves each dropped player out from his day on", () => {
    const out = withoutDropped(boards, [{ id: johnson, from: today }, { id: murray, from: today + 1 }]);
    expect(out[today]!.players.some((p) => p.player_id === johnson)).toBe(false);
    expect(out[today]!.players.some((p) => p.player_id === murray)).toBe(true);
    expect(out[today + 1]!.players.some((p) => p.player_id === murray)).toBe(false);
    expect(out[0]).toBeUndefined();
  });

  test("keeps the array, and a board nobody leaves, as they were", () => {
    expect(withoutDropped(boards, [])).toBe(boards);
    const out = withoutDropped(boards, [{ id: murray, from: today + 1 }]);
    expect(out[today]).toBe(board);
  });
});

describe("unstageEverywhere", () => {
  test("takes his moves back on every day, with the swap each made", () => {
    const later = demoBoard(undefined, "demo-1", today + 1);
    const boards = [undefined, board, later];
    const staged = {
      [today]: { [johnson]: BE, [white]: F },
      [today + 1]: { [johnson]: BE },
      [today + 2]: { [white]: F },
    };
    const out = unstageEverywhere(boards, staged, johnson);
    expect(out[today]).toEqual({});
    expect(out[today + 1]).toEqual({});
    // A day with no board to read the swap from is left alone.
    expect(out[today + 2]).toEqual({ [white]: F });
  });

  test("hands back the same staging when he had nothing staged", () => {
    const staged = { [today]: { [white]: F } };
    expect(unstageEverywhere([undefined, board], staged, murray)).toBe(staged);
  });
});

describe("dropBlockedReason", () => {
  const player = { id: murray, name: "Keegan Murray" };
  const base = { player, board, laneHolder: null, scheduled: null, pinnedDrops: false, demo: false };
  const lockedBoard = (gameStarted: boolean): LineupState => ({
    ...board,
    players: board.players.map((p) => (p.player_id === murray ? { ...p, locked: true, game_started: gameStarted } : p)),
  });

  test("a writable board with him on it can drop him", () => {
    expect(dropBlockedReason(base)).toBeNull();
  });

  test("names each refusal the server would make", () => {
    expect(dropBlockedReason({ ...base, board: null })).toBe("Dropping from here needs an ESPN team.");
    expect(dropBlockedReason({ ...base, board: lockedBoard(true) })).toBe(
      "Keegan Murray is locked until tomorrow: his game has started."
    );
    expect(dropBlockedReason({ ...base, board: lockedBoard(false) })).toBe("Keegan Murray is locked on ESPN today.");
    expect(dropBlockedReason({ ...base, laneHolder: murray })).toBe("A stream lane is streaming his spot: stop it to drop him.");
    expect(dropBlockedReason({ ...base, scheduled: { add: "Toumani Camara", day: "Thu" } })).toBe(
      "Keegan Murray is already being dropped for Toumani Camara on Thu: cancel that pickup to drop him now."
    );
    expect(dropBlockedReason({ ...base, pinnedDrops: true })).toBe("The add staged in the tray already drops him.");
    expect(dropBlockedReason({ ...base, player: { id: 1, name: "Nobody" } })).toBe("Nobody isn't on today's ESPN roster.");
  });

  test("a board ESPN won't take writes on blocks every drop, except in the demo", () => {
    const blocked: LineupState = { ...board, can_write: false, write_blocked_reason: "no_scoring_period" };
    expect(dropBlockedReason({ ...base, board: blocked })).not.toBeNull();
    expect(dropBlockedReason({ ...base, board: blocked, demo: true })).toBeNull();
  });
});

describe("buildWeekGrid with a staged drop", () => {
  const leaves = [{ id: johnson, from: today }];
  const after = withoutDropped([undefined, board], leaves)[today]!;
  const base = buildWeekGrid({ source, board, staged: {}, incoming: null, viewDay: today });
  const dropped = buildWeekGrid({ source, board: after, staged: {}, incoming: null, dropping: leaves, viewDay: today });

  test("moves him to the drop rows, his games from today on no longer counting", () => {
    const last = dropped.rows[dropped.rows.length - 1];
    expect(last).toMatchObject({ slot: "DROP", outgoing: true, dropped: true, player: { id: johnson } });
    for (const c of last.cells.slice(today)) if (c.state !== "none") expect(c).toMatchObject({ counts: false, tag: "DROP" });
    expect(dropped.projected.you).toBeLessThan(base.projected.you);
  });

  test("empties his seat from today on and keeps him where he sat on days already played", () => {
    const { slots, seats } = dropped.lineups;
    const drop = slots.findIndex((s) => s.group === "drop");
    expect(slots[drop]).toMatchObject({ key: "drop-0", slot: "DROP" });
    expect(seats[today][drop]).toMatchObject({ outgoing: true, dropped: true, player: { name: "Jalen Johnson" } });
    expect(seats[today].slice(0, drop).map(name)).not.toContain("Jalen Johnson");
    expect(seats[0].map(name)).toContain("Jalen Johnson");
    expect(seats[0][drop]).toBeNull();
  });

  test("the spot he leaves can be filled: White's move into it counts", () => {
    const filled = buildWeekGrid({ source, board: after, staged: { [white]: F }, incoming: null, dropping: leaves, viewDay: today });
    expect(filled.projected.you).toBeGreaterThan(dropped.projected.you);
    const row = filled.rows.find((r) => r.player?.id === white)!;
    expect(row.slot).toBe("F");
  });

  test("a previewed add into the open spot sits beside the drop, each in his own drop row", () => {
    const fa = DEMO_STREAMERS.find((s) => s.name === "Toumani Camara")!;
    const player = sourceFromStreamer(fa, DEMO_DAYS, demoSchedule(fa.team));
    const grid = buildWeekGrid({
      source,
      board: withoutDropped([undefined, board], [...leaves, { id: murray, from: today }])[today]!,
      staged: {},
      incoming: { player, replaces: -1 },
      dropping: [...leaves, { id: murray, from: today }],
      viewDay: today,
    });
    const drops = grid.lineups.slots.filter((s) => s.group === "drop");
    expect(drops.map((s) => s.key)).toEqual(["drop-0", "drop-1"]);
    expect(grid.rows.slice(-2).map((r) => r.player?.id)).toEqual([johnson, murray]);
    expect(grid.rows.some((r) => r.kind === "incoming" && r.player?.id === fa.player_id)).toBe(true);
  });

  test("a drop that waits for a later day leaves him on the roster until then", () => {
    const later = [{ id: johnson, from: today + 2 }];
    const grid = buildWeekGrid({ source, board, staged: {}, incoming: null, dropping: later, viewDay: today });
    const row = grid.rows.find((r) => r.player?.id === johnson)!;
    expect(row.cells[today + 2].tag === "DROP" || row.cells[today + 2].state === "none").toBe(true);
    const drop = grid.lineups.slots.findIndex((s) => s.group === "drop");
    expect(grid.lineups.seats[today][drop]).toBeNull();
    expect(grid.lineups.seats[today].map(name)).toContain("Jalen Johnson");
  });
});
