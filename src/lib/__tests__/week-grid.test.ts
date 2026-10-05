import { describe, expect, test } from "bun:test";
import {
  buildWeekGrid,
  liveClock,
  planDay,
  slotsFromPositions,
  viewableDays,
  type DayGame,
  type SourcePlayer,
  type WeekSource,
} from "../week-grid";
import { sourceFromStreamer } from "../week-source";
import { DEMO_DAYS, DEMO_STREAMERS, demoBoard, demoSchedule, demoSource } from "../week-demo";

const C = 4, UT = 11;

describe("planDay", () => {
  test("moves a flexible player to make room (greedy alone would bench B)", () => {
    const plan = planDay(
      [
        { id: 1, avg: 50, eligible: [C, UT] },
        { id: 2, avg: 40, eligible: [C] },
      ],
      [{ slotId: C, count: 1 }, { slotId: UT, count: 1 }]
    );
    expect(plan.get(1)).toBe(UT);
    expect(plan.get(2)).toBe(C);
  });

  test("the lowest projection sits when there are more players than seats", () => {
    const plan = planDay(
      [
        { id: 1, avg: 30, eligible: [UT] },
        { id: 2, avg: 20, eligible: [UT] },
        { id: 3, avg: 25, eligible: [UT] },
      ],
      [{ slotId: UT, count: 2 }]
    );
    expect([...plan.keys()].sort()).toEqual([1, 3]);
  });

  test("prefers the specific slot over UT", () => {
    const plan = planDay([{ id: 1, avg: 50, eligible: [C, UT] }], [{ slotId: C, count: 1 }, { slotId: UT, count: 3 }]);
    expect(plan.get(1)).toBe(C);
  });
});

describe("buildWeekGrid on the demo week", () => {
  const source = demoSource();
  const board = demoBoard();
  const today = source.todayIndex!;
  const white = board.players.find((p) => p.name === "Derrick White")!;
  const maxey = board.players.find((p) => p.name === "Tyrese Maxey")!;

  test("today's rows follow the ESPN board, PG first", () => {
    const grid = buildWeekGrid({ source, board, staged: {}, incoming: null, viewDay: today });
    expect(grid.rows[0].slot).toBe("PG");
    expect(grid.rows[0].player?.name).toBe("Tyrese Maxey");
    expect(grid.rows.map((r) => r.slot).slice(-4)).toEqual(["BE", "BE", "BE", "IR"]);
    expect(grid.rows[grid.rows.length - 1].kind).toBe("open");
  });

  test("a bench player with a game today is flagged and does not count", () => {
    const grid = buildWeekGrid({ source, board, staged: {}, incoming: null, viewDay: today });
    const row = grid.rows.find((r) => r.player?.id === white.player_id)!;
    expect(row.cells[today]).toMatchObject({ state: "upcoming", tag: "BENCH", counts: false });
  });

  test("staging White into Maxey's seat adds his projection to today and the finish", () => {
    const before = buildWeekGrid({ source, board, staged: {}, incoming: null, viewDay: today });
    const staged = { [white.player_id]: 0, [maxey.player_id]: 12 };
    const after = buildWeekGrid({ source, board, staged, incoming: null, viewDay: today });
    expect(after.rows[0].player?.name).toBe("Derrick White");
    expect(after.rows[0].staged).toBe(true);
    expect(after.you[today].projected! - before.you[today].projected!).toBeCloseTo(33.5, 5);
    expect(after.projected.you - before.projected.you).toBeCloseTo(33.5, 5);
  });

  test("now is the official score; past days use the API totals", () => {
    const grid = buildWeekGrid({ source, board, staged: {}, incoming: null, viewDay: today });
    expect(grid.now.you).toBe(458.5);
    expect(grid.now.opp).toBe(477.5);
    expect(grid.you[0].projected).toBe(318.5);
  });

  test("an OUT player's future games are marked out and never planned", () => {
    const grid = buildWeekGrid({ source, board, staged: {}, incoming: null, viewDay: today });
    const row = grid.rows.find((r) => r.player?.id === maxey.player_id)!;
    const sunday = row.cells[6];
    expect(sunday.state).toBe("out");
    expect(sunday.counts).toBe(false);
  });

  test("a light future day shows open slots", () => {
    const grid = buildWeekGrid({ source, board, staged: {}, incoming: null, viewDay: 3 });
    const open = grid.rows.filter((r) => r.kind === "open");
    expect(open.length).toBeGreaterThan(0);
    // Every healthy player with a game that day is seated.
    for (const r of grid.rows) {
      const c = r.cells[3];
      if (r.player && c.state === "upcoming") expect(c.counts).toBe(true);
    }
  });

  test("previewing a free agent puts his row under the replaced player and moves the finish", () => {
    const fa = DEMO_STREAMERS.find((s) => s.name === "Toumani Camara")!;
    const murray = board.players.find((p) => p.name === "Keegan Murray")!;
    const player = sourceFromStreamer(fa, DEMO_DAYS, demoSchedule(fa.team));
    const base = buildWeekGrid({ source, board, staged: {}, incoming: null, viewDay: today });
    const grid = buildWeekGrid({ source, board, staged: {}, incoming: { player, replaces: murray.player_id }, viewDay: today });
    const at = grid.rows.findIndex((r) => r.player?.id === murray.player_id);
    expect(grid.rows[at].outgoing).toBe(true);
    expect(grid.rows[at + 1].kind).toBe("incoming");
    expect(grid.rows[at + 1].player?.name).toBe("Toumani Camara");
    expect(grid.rows[at + 1].cells[2].opp).toBe("@ PHX");
    // Camara plays more games than Murray this week.
    expect(grid.projected.you).toBeGreaterThan(base.projected.you);
  });
});

describe("buildWeekGrid without a board", () => {
  const g = (avg: number): DayGame => ({ opp: "vs X", time: "19:00", status: "scheduled", fpts: null, clock: null, remaining: 1, out: false });
  const player = (id: number, avg: number): SourcePlayer => ({
    id, name: `P${id}`, team: "X", nbaId: null, avg, injury: null, eligible: [UT], games: [g(avg)],
  });
  const source: WeekSource = {
    period: 1,
    days: [{ index: 0, date: "2026-10-20", dow: "Tue", kind: "future" }],
    todayIndex: null,
    you: { name: "A", current: null },
    opp: { name: "B", current: null },
    mine: [player(1, 30), player(2, 20), player(3, 25)],
    opponents: [],
    pastTotals: { you: [null], opp: [null] },
    activeSlotCount: 2,
  };

  test("before the period starts every day is viewable and extras sit", () => {
    expect(viewableDays(source)).toEqual([0]);
    const grid = buildWeekGrid({ source, board: null, staged: {}, incoming: null, viewDay: 0 });
    const sits = grid.rows.filter((r) => r.cells[0].tag === "SITS").map((r) => r.player?.id);
    expect(sits).toEqual([2]);
    expect(grid.you[0].projected).toBe(55);
    expect(grid.startsLeft.you).toBe(2);
  });
});

describe("helpers", () => {
  test("liveClock reads the NBA's ISO clock", () => {
    expect(liveClock(3, "PT04M12.00S")).toEqual({ label: "Q3 4:12", remaining: expect.closeTo(0.337, 2) });
    expect(liveClock(5, "PT02M00.00S").label).toBe("OT 2:00");
  });

  test("slotsFromPositions adds G, F and UT", () => {
    expect(slotsFromPositions(["PG"])).toEqual([0, 5, 11]);
    expect(slotsFromPositions(["SF", "PF"])).toEqual([2, 3, 6, 11]);
  });
});
