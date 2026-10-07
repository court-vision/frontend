import { describe, expect, test } from "bun:test";
import {
  assignMin,
  buildWeekGrid,
  healthOf,
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

  test("staging White into Maxey's seat carries forward: today and every later White game count", () => {
    const before = buildWeekGrid({ source, board, staged: {}, incoming: null, viewDay: today });
    const staged = { [white.player_id]: 0, [maxey.player_id]: 12 };
    const after = buildWeekGrid({ source, board, staged, incoming: null, viewDay: today });
    expect(after.rows[0].player?.name).toBe("Derrick White");
    expect(after.rows[0].staged).toBe(true);
    expect(after.you[today].projected! - before.you[today].projected!).toBeCloseTo(33.5, 5);
    // Tue + Thu + Sat + Sun at 33.5; Maxey is out all week.
    expect(after.projected.you - before.projected.you).toBeCloseTo(134, 5);
  });

  test("as set on ESPN, future days keep the board's lineup and benched games don't count", () => {
    const grid = buildWeekGrid({ source, board, staged: {}, incoming: null, viewDay: 3 });
    expect(grid.rows[0].player?.name).toBe("Tyrese Maxey");
    const row = grid.rows.find((r) => r.player?.id === white.player_id)!;
    expect(row.slot).toBe("BE");
    expect(row.cells[3]).toMatchObject({ state: "upcoming", tag: "BENCH", counts: false });
  });

  test("the best lineup each day starts White on his game days without a move", () => {
    const before = buildWeekGrid({ source, board, staged: {}, incoming: null, viewDay: today, mode: "best" });
    const staged = { [white.player_id]: 0, [maxey.player_id]: 12 };
    const after = buildWeekGrid({ source, board, staged, incoming: null, viewDay: today, mode: "best" });
    expect(after.projected.you - before.projected.you).toBeCloseTo(33.5, 5);
    const asSet = buildWeekGrid({ source, board, staged: {}, incoming: null, viewDay: today });
    expect(before.projected.you).toBeGreaterThan(asSet.projected.you);
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

  test("in the best-lineup view a light future day shows open slots", () => {
    const grid = buildWeekGrid({ source, board, staged: {}, incoming: null, viewDay: 3, mode: "best" });
    const open = grid.rows.filter((r) => r.kind === "open");
    expect(open.length).toBeGreaterThan(0);
    // Every healthy player with a game that day is seated.
    for (const r of grid.rows) {
      const c = r.cells[3];
      if (r.player && c.state === "upcoming") expect(c.counts).toBe(true);
    }
  });

  test("previewing a free agent seats him in his own spot, sends the dropped player to the bottom, and moves the finish", () => {
    const fa = DEMO_STREAMERS.find((s) => s.name === "Toumani Camara")!;
    const murray = board.players.find((p) => p.name === "Keegan Murray")!;
    const player = sourceFromStreamer(fa, DEMO_DAYS, demoSchedule(fa.team));
    const base = buildWeekGrid({ source, board, staged: {}, incoming: null, viewDay: today, mode: "best" });
    const grid = buildWeekGrid({ source, board, staged: {}, incoming: { player, replaces: murray.player_id }, viewDay: today, mode: "best" });
    const last = grid.rows[grid.rows.length - 1];
    expect(last.player?.id).toBe(murray.player_id);
    expect(last.outgoing).toBe(true);
    expect(last.slot).toBe("DROP");
    const incomingRow = grid.rows.find((r) => r.kind === "incoming")!;
    expect(incomingRow.player?.name).toBe("Toumani Camara");
    expect(incomingRow.cells[2].opp).toBe("@ PHX");
    // Camara plays more games than Murray this week.
    expect(grid.projected.you).toBeGreaterThan(base.projected.you);
  });
});

describe("daily lineups", () => {
  const source = demoSource();
  const board = demoBoard();
  const today = source.todayIndex!;
  const name = (seat: { player: { name: string } } | null) => seat?.player.name ?? null;

  test("one row per lineup spot: ten active, three bench, one IR", () => {
    const { lineups } = buildWeekGrid({ source, board, staged: {}, incoming: null, viewDay: today });
    expect(lineups.slots.map((s) => s.slot)).toEqual(["PG", "SG", "SF", "PF", "C", "G", "F", "UT", "UT", "UT", "BE", "BE", "BE", "IR"]);
    expect(lineups.boardDay).toBe(today);
  });

  test("as set, every day from today shows the board; a staged move shows on all of them", () => {
    const staged = { [board.players.find((p) => p.name === "Derrick White")!.player_id]: 0, [board.players.find((p) => p.name === "Tyrese Maxey")!.player_id]: 12 };
    const { lineups } = buildWeekGrid({ source, board, staged, incoming: null, viewDay: today });
    for (let d = today; d < 7; d++) {
      expect(name(lineups.seats[d][0])).toBe("Derrick White");
      expect(lineups.seats[d][0]?.staged).toBe(true);
    }
    const bench = lineups.slots.map((s, i) => (s.group === "bench" ? name(lineups.seats[3][i]) : null)).filter(Boolean);
    expect(bench).toContain("Tyrese Maxey");
  });

  test("best each day fills each day's spots from that day's games", () => {
    const { lineups } = buildWeekGrid({ source, board, staged: {}, incoming: null, viewDay: today, mode: "best" });
    const wed = lineups.seats[2];
    const active = lineups.slots.map((s, i) => (s.group === "active" ? wed[i] : undefined)).filter((x) => x !== undefined);
    for (const seat of active) if (seat) expect(seat.cell.state).not.toBe("none");
    expect(active.filter((s) => s === null).length).toBe(3); // seven games for ten spots Wednesday
  });

  test("a previewed free agent takes a seat; the player he replaces moves to a row of his own", () => {
    const fa = DEMO_STREAMERS.find((s) => s.name === "Toumani Camara")!;
    const murray = board.players.find((p) => p.name === "Keegan Murray")!;
    const player = sourceFromStreamer(fa, DEMO_DAYS, demoSchedule(fa.team));
    const { lineups } = buildWeekGrid({ source, board, staged: {}, incoming: { player, replaces: murray.player_id }, viewDay: today });
    const drop = lineups.slots.length - 1;
    expect(lineups.slots[drop]).toMatchObject({ group: "drop", slot: "DROP" });
    const wed = lineups.seats[2];
    expect(wed.slice(0, drop).map(name)).toContain("Toumani Camara");
    expect(wed.slice(0, drop).map(name)).not.toContain("Keegan Murray");
    expect(wed[drop]).toMatchObject({ outgoing: true, player: { name: "Keegan Murray" } });
    expect(wed.find((s) => s?.incoming)?.player.name).toBe("Toumani Camara");
    // On a day already played he is still where he sat, and the drop row is empty.
    expect(lineups.seats[0].map(name)).toContain("Keegan Murray");
    expect(lineups.seats[0][drop]).toBeNull();
  });

  test("the free agent starts where he helps most, not just in the dropped player's spot", () => {
    // Dropping a bench player leaves no active spot open; Wednesday's UT (Sengun) has no game.
    const fa = DEMO_STREAMERS.find((s) => s.name === "Toumani Camara")!;
    const kessler = board.players.find((p) => p.name === "Walker Kessler")!;
    const sengun = board.players.find((p) => p.name === "Alperen Şengün")!;
    const player = sourceFromStreamer(fa, DEMO_DAYS, demoSchedule(fa.team));
    const { lineups } = buildWeekGrid({ source, board, staged: {}, incoming: { player, replaces: kessler.player_id }, viewDay: today });
    const wed = lineups.seats[2];
    const at = wed.findIndex((s) => s?.incoming);
    expect(lineups.slots[at].group).toBe("active");
    expect(wed[at]?.cell.counts).toBe(true);
    const sengunAt = wed.findIndex((s) => s?.player.id === sengun.player_id);
    expect(lineups.slots[sengunAt].group).toBe("bench");
    expect(wed[sengunAt]?.shifted).toBe(true);
  });

  test("the preview never brings anyone up from the bench", () => {
    const fa = DEMO_STREAMERS.find((s) => s.name === "Toumani Camara")!;
    const murray = board.players.find((p) => p.name === "Keegan Murray")!;
    const white = board.players.find((p) => p.name === "Derrick White")!;
    const player = sourceFromStreamer(fa, DEMO_DAYS, demoSchedule(fa.team));
    const { lineups } = buildWeekGrid({ source, board, staged: {}, incoming: { player, replaces: murray.player_id }, viewDay: today });
    for (const day of [2, 3, 4, 5, 6]) {
      const at = lineups.seats[day].findIndex((s) => s?.player.id === white.player_id);
      expect(lineups.slots[at].group).toBe("bench");
    }
  });

  test("after today's first tip he isn't seated in an active spot today", () => {
    const fa = DEMO_STREAMERS.find((s) => s.name === "Toumani Camara")!;
    const murray = board.players.find((p) => p.name === "Keegan Murray")!;
    const player = sourceFromStreamer(fa, DEMO_DAYS, demoSchedule(fa.team), today + 1);
    const { lineups } = buildWeekGrid({ source, board, staged: {}, incoming: { player, replaces: murray.player_id }, viewDay: today });
    const at = lineups.seats[today].findIndex((s) => s?.incoming);
    expect(lineups.slots[at].group).not.toBe("active");
  });
});

describe("assignMin", () => {
  test("finds the cheapest assignment, rows to columns", () => {
    expect(assignMin([[4, 1, 3], [2, 0, 5], [3, 2, 2]])).toEqual([1, 0, 2]);
    expect(assignMin([[5, 1, 9, 9]])).toEqual([1]);
    expect(assignMin([])).toEqual([]);
  });
});

describe("each day's own ESPN lineup", () => {
  const source = demoSource();
  const today = source.todayIndex!;
  const board = demoBoard();
  const white = board.players.find((p) => p.name === "Derrick White")!.player_id;
  const maxey = board.players.find((p) => p.name === "Tyrese Maxey")!.player_id;
  const name = (seat: { player: { name: string } } | null) => seat?.player.name ?? null;
  // Thursday already has its own edit on ESPN: White starts at PG.
  const thursday = demoBoard(undefined, "demo-1-3", 3, { [white]: 0, [maxey]: 12 });
  const wednesday = demoBoard(undefined, "demo-1-2", 2);

  test("a day shows its own lineup; a day not read carries the day before", () => {
    const dayBoards = [null, { board, staged: {} }, { board: wednesday, staged: {} }, { board: thursday, staged: {} }];
    const { lineups } = buildWeekGrid({ source, board, staged: {}, dayBoards, incoming: null, viewDay: today });
    expect(name(lineups.seats[2][0])).toBe("Tyrese Maxey");
    expect(name(lineups.seats[3][0])).toBe("Derrick White");
    expect(name(lineups.seats[4][0])).toBe("Derrick White"); // Friday not read: Thursday carries
    expect(lineups.editable.slice(1, 5)).toEqual([true, true, true, false]);
  });

  test("a move staged today carries to days that match it, and stops at a day with its own edit", () => {
    const hart = board.players.find((p) => p.name === "Josh Hart")!.player_id;
    const kessler = board.players.find((p) => p.name === "Walker Kessler")!.player_id;
    const staged = { [kessler]: 11, [hart]: 12 }; // Kessler UT, Hart to the bench
    const dayBoards = [null, { board, staged }, { board: wednesday, staged: {} }, { board: thursday, staged: {} }];
    const { lineups } = buildWeekGrid({ source, board, staged, dayBoards, incoming: null, viewDay: today });
    const benchOn = (d: number) =>
      lineups.slots.map((s, i) => (s.group === "bench" ? name(lineups.seats[d][i]) : null)).filter(Boolean);
    expect(benchOn(2)).toContain("Josh Hart"); // Wednesday matched today, so it inherits
    expect(benchOn(3)).not.toContain("Josh Hart"); // Thursday has its own edit
    const wedHart = lineups.seats[2].find((s) => s?.player.name === "Josh Hart");
    expect(wedHart?.staged).toBe(true);
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

  test("healthOf: active is green, day-to-day yellow, out and suspended red", () => {
    expect([null, "ACTIVE", ""].map(healthOf)).toEqual(["ok", "ok", "ok"]);
    expect(["DAY_TO_DAY", "QUESTIONABLE", "DTD"].map(healthOf)).toEqual(["dtd", "dtd", "dtd"]);
    expect(["OUT", "SUSPENSION", "INJURY_RESERVE"].map(healthOf)).toEqual(["out", "out", "out"]);
  });

  test("slotsFromPositions adds G, F and UT", () => {
    expect(slotsFromPositions(["PG"])).toEqual([0, 5, 11]);
    expect(slotsFromPositions(["SF", "PF"])).toEqual([2, 3, 6, 11]);
  });
});
