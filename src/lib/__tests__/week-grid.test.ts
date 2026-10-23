import { describe, expect, test } from "bun:test";
import {
  assignMin,
  buildWeekGrid,
  defaultViewDay,
  healthOf,
  liveClock,
  planDay,
  recordedSlots,
  slotsFromPositions,
  viewableDays,
  type DayGame,
  type SourcePlayer,
  type WeekSource,
} from "../week-grid";
import { isActiveSlot } from "../lineup-editor";
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
    expect(grid.now.you).toBe(449.5);
    expect(grid.now.opp).toBe(477.5);
    // Monday's starters only: Hart's 33.5 sat on the bench, Thompson's 24.5 counted.
    expect(grid.you[0].projected).toBe(309.5);
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

  test("best each day fills each day's spots from that day's games, and idle starters keep spots nobody needs", () => {
    const { lineups } = buildWeekGrid({ source, board, staged: {}, incoming: null, viewDay: today, mode: "best" });
    const wed = lineups.seats[2];
    const active = lineups.slots
      .map((s, i) => (s.group === "active" ? { slotId: s.slotId, seat: wed[i] } : null))
      .filter((x): x is { slotId: number; seat: (typeof wed)[number] } => x !== null);
    // Seven games for ten spots Wednesday: all seven play, ...
    expect(active.filter((a) => a.seat && a.seat.cell.state !== "none")).toHaveLength(7);
    // ... and a starter without a game stays where ESPN has him, rather than going to the bench.
    const idle = active.filter((a) => a.seat && a.seat.cell.state === "none");
    expect(idle.length).toBeGreaterThan(0);
    for (const a of idle) expect(board.players.find((p) => p.player_id === a.seat!.player.id)?.lineup_slot_id).toBe(a.slotId);
    // A bench player without a game stays on the bench.
    const bench = lineups.slots.map((s, i) => (s.group === "bench" ? name(wed[i]) : null)).filter(Boolean);
    expect(bench).toContain("Derrick White");
  });

  test("an idle starter whose spot a player with a game needs goes to the bench", () => {
    // Wednesday: Kessler (bench, plays) takes C from Jokić (idle); Williams (SG) and Şengün (UT) keep theirs.
    const { lineups } = buildWeekGrid({ source, board, staged: {}, incoming: null, viewDay: today, mode: "best" });
    const wed = lineups.seats[2];
    const at = (slot: string) => lineups.slots.map((s, i) => (s.slot === slot ? name(wed[i]) : null)).filter(Boolean);
    expect(at("C")).toEqual(["Walker Kessler"]);
    expect(at("BE")).toContain("Nikola Jokić");
    expect(at("SG")).toEqual(["Jalen Williams"]);
    expect(at("UT")).toContain("Alperen Şengün");
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
    // A day already played is as it stood (Murray joined on Tuesday), and the drop row is empty.
    expect(lineups.seats[0].map(name)).not.toContain("Keegan Murray");
    expect(lineups.seats[0].map(name)).toContain("Ausar Thompson");
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

describe("ESPN's bench is unbounded", () => {
  const source = demoSource();
  const board = demoBoard();
  const today = source.todayIndex!;
  const name = (seat: { player: { name: string } } | null) => seat?.player.name ?? null;

  test("dropping a starter leaves his spot empty rather than shuffling guards to refill it", () => {
    // Thursday: Maxey (PG) is dropped for Watson (SF/PF/F); Barnes, at SF, has no game.
    // Nobody else who plays fits PG, so the fewest moves leave PG open and bench Barnes.
    const fa = DEMO_STREAMERS.find((s) => s.name === "Peyton Watson")!;
    const maxey = board.players.find((p) => p.name === "Tyrese Maxey")!;
    const player = sourceFromStreamer(fa, DEMO_DAYS, demoSchedule(fa.team), today + 1);
    const { lineups } = buildWeekGrid({ source, board, staged: {}, incoming: { player, replaces: maxey.player_id }, viewDay: today });
    const thu = lineups.seats[3];
    const at = (slot: string) => lineups.slots.map((s, i) => (s.slot === slot ? name(thu[i]) : undefined)).filter((x) => x !== undefined);
    expect(at("PG")).toEqual([null]);
    expect(at("SF")).toEqual(["Peyton Watson"]);
    expect(thu.filter((s) => s?.shifted).map(name)).toEqual(["Scottie Barnes"]);
    expect(at("BE")).toContain("Scottie Barnes");
    expect(at("BE").filter(Boolean)).toHaveLength(4);
  });

  test("a free agent takes his position before a UT spot when both cost the same", () => {
    // Watson fits SF (Barnes idle) or a UT held by an idle player: one move either way.
    const fa = DEMO_STREAMERS.find((s) => s.name === "Peyton Watson")!;
    const maxey = board.players.find((p) => p.name === "Tyrese Maxey")!;
    const player = sourceFromStreamer(fa, DEMO_DAYS, demoSchedule(fa.team), today + 1);
    const { lineups } = buildWeekGrid({ source, board, staged: {}, incoming: { player, replaces: maxey.player_id }, viewDay: today });
    const i = lineups.seats[3].findIndex((s) => s?.incoming);
    expect(lineups.slots[i].slot).not.toBe("UT");
  });
});

describe("a pickup scheduled ahead", () => {
  const source = demoSource();
  const board = demoBoard();
  const today = source.todayIndex!;
  const name = (seat: { player: { name: string } } | null) => seat?.player.name ?? null;
  // Camara plays Sat and Sun; Barnes, the starter he replaces, plays Wed and Fri before that.
  const fa = DEMO_STREAMERS.find((s) => s.name === "Toumani Camara")!;
  const barnes = board.players.find((p) => p.name === "Scottie Barnes")!;
  const sat = 5;
  const scheduled = buildWeekGrid({
    source,
    board,
    staged: {},
    incoming: { player: sourceFromStreamer(fa, DEMO_DAYS, demoSchedule(fa.team), sat), replaces: barnes.player_id, from: sat },
    viewDay: today,
  });

  test("leaves the roster as it stands until his day", () => {
    const { slots, seats } = scheduled.lineups;
    const drop = slots.findIndex((s) => s.group === "drop");
    for (const day of [today, 2, 3, 4]) {
      expect(seats[day].map(name)).toContain("Scottie Barnes");
      expect(seats[day].some((s) => s?.incoming || s?.shifted)).toBe(false);
      expect(seats[day][drop]).toBeNull();
    }
    expect(seats[sat].find((s) => s?.incoming)?.player.name).toBe("Toumani Camara");
    expect(seats[sat][drop]).toMatchObject({ outgoing: true, player: { name: "Scottie Barnes" } });
  });

  test("the dropped player's games before it still count", () => {
    const row = scheduled.rows.find((r) => r.player?.id === barnes.player_id)!;
    expect(row.cells[2]).toMatchObject({ counts: true, tag: null });
    expect(row.cells[4]).toMatchObject({ counts: true, tag: null });
    expect(row.cells[6]).toMatchObject({ counts: false, tag: "DROP" });
  });

  test("which makes it worth more than the same swap made today", () => {
    const now = buildWeekGrid({
      source,
      board,
      staged: {},
      incoming: { player: sourceFromStreamer(fa, DEMO_DAYS, demoSchedule(fa.team), today + 1), replaces: barnes.player_id },
      viewDay: today,
    });
    const base = buildWeekGrid({ source, board, staged: {}, incoming: null, viewDay: today });
    expect(now.projected.you).toBeLessThan(base.projected.you);
    expect(scheduled.projected.you).toBeGreaterThan(now.projected.you);
    expect(scheduled.projected.you).toBeGreaterThan(base.projected.you);
  });

  test("in the best lineups too", () => {
    const best = buildWeekGrid({
      source,
      board,
      staged: {},
      incoming: { player: sourceFromStreamer(fa, DEMO_DAYS, demoSchedule(fa.team), sat), replaces: barnes.player_id, from: sat },
      viewDay: today,
      mode: "best",
    });
    expect(best.lineups.seats[4].map(name)).toContain("Scottie Barnes");
    expect(best.lineups.seats[4].map(name)).not.toContain("Toumani Camara");
    expect(best.lineups.seats[sat].map(name)).toContain("Toumani Camara");
  });
});

describe("a stream lane's chain of free agents through one spot", () => {
  const source = demoSource();
  const board = demoBoard();
  const today = source.todayIndex!;
  const name = (seat: { player: { name: string } } | null) => seat?.player.name ?? null;
  // Murray's spot: Huff (C; plays Wed, Fri) holds it Wed–Thu, then Ellis (SG; plays Thu, Sat, Sun) from Fri.
  const murray = board.players.find((p) => p.name === "Keegan Murray")!;
  const huff = DEMO_STREAMERS.find((s) => s.name === "Jay Huff")!;
  const ellis = DEMO_STREAMERS.find((s) => s.name === "Keon Ellis")!;
  const chain = [
    { player: sourceFromStreamer(huff, DEMO_DAYS, null, 2), replaces: murray.player_id, from: 2, until: 4 },
    { player: sourceFromStreamer(ellis, DEMO_DAYS, null, 4), replaces: murray.player_id, from: 4 },
  ];
  const grid = buildWeekGrid({ source, board, staged: {}, incoming: chain, viewDay: today });

  test("each day has the stretch's free agent, and only his", () => {
    const { seats } = grid.lineups;
    expect(seats[today].map(name)).toContain("Keegan Murray");
    expect(seats[today].some((st) => st?.incoming)).toBe(false);
    for (const day of [2, 3]) {
      expect(seats[day].filter((st) => st?.incoming).map(name)).toEqual(["Jay Huff"]);
    }
    for (const day of [4, 5, 6]) {
      expect(seats[day].filter((st) => st?.incoming).map(name)).toEqual(["Keon Ellis"]);
      expect(seats[day].map(name)).not.toContain("Jay Huff");
    }
  });

  test("the spot's player leaves from the chain's first day", () => {
    const { slots, seats } = grid.lineups;
    const drop = slots.findIndex((st) => st.group === "drop");
    expect(seats[today][drop]).toBeNull();
    for (const day of [2, 3, 4, 5, 6]) expect(seats[day][drop]).toMatchObject({ outgoing: true, player: { name: "Keegan Murray" } });
  });

  test("a free agent's games outside his stretch don't count", () => {
    const huffRow = grid.rows.find((r) => r.player?.name === "Jay Huff")!;
    const ellisRow = grid.rows.find((r) => r.player?.name === "Keon Ellis")!;
    expect(huffRow.kind).toBe("incoming");
    expect(huffRow.cells[2].state).toBe("upcoming");
    expect(huffRow.cells[4]).toMatchObject({ state: "none", counts: false });   // he plays Fri, but Ellis has the spot
    expect(ellisRow.cells[3]).toMatchObject({ state: "none", counts: false });  // and Ellis's Thu game is before his stretch
    expect(ellisRow.cells[5].state).toBe("upcoming");
  });

  test("one stretch alone is the scheduled pickup it always was", () => {
    const single = buildWeekGrid({ source, board, staged: {}, incoming: chain[1], viewDay: today });
    const asList = buildWeekGrid({ source, board, staged: {}, incoming: [chain[1]], viewDay: today });
    expect(asList.projected).toEqual(single.projected);
    expect(asList.lineups.seats.map((d) => d.map(name))).toEqual(single.lineups.seats.map((d) => d.map(name)));
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

describe("a day already played", () => {
  const source = demoSource();
  const board = demoBoard();
  const today = source.todayIndex!;
  const MON = 0;
  const row = (g: ReturnType<typeof buildWeekGrid>, who: string) => g.rows.find((r) => r.player?.name === who);
  const seatsOn = (g: ReturnType<typeof buildWeekGrid>, day: number) =>
    g.lineups.slots.map((def, i) => [def.slot, g.lineups.seats[day][i]?.player.name ?? null] as const);

  test("sits as it stood: a benched game doesn't count, and nobody added since is there", () => {
    const grid = buildWeekGrid({ source, board, staged: {}, incoming: null, viewDay: today });
    expect(grid.lineups.asItStood).toEqual([true, false, false, false, false, false, false]);
    expect(row(grid, "Josh Hart")!.cells[MON]).toMatchObject({ state: "final", value: 33.5, counts: false, tag: "BENCH" });
    expect(row(grid, "Jalen Johnson")!.cells[MON]).toMatchObject({ state: "final", value: 47, counts: true, tag: null });
    expect(row(grid, "Keegan Murray")!.cells[MON].state).toBe("none");
    const monday = seatsOn(grid, MON);
    expect(monday.filter(([slot]) => slot === "UT").map(([, who]) => who)).toEqual(["Alperen Şengün", "Trey Murphy III", "Ausar Thompson"]);
    expect(monday.filter(([slot]) => slot === "BE").map(([, who]) => who)).toContain("Josh Hart");
    expect(monday.map(([, who]) => who)).not.toContain("Keegan Murray");
  });

  test("before the board loads, its starters sit in the spots on record", () => {
    const grid = buildWeekGrid({ source, board: null, staged: {}, incoming: null, viewDay: MON });
    const monday = seatsOn(grid, MON);
    expect(monday.filter(([slot]) => slot === "UT").map(([, who]) => who)).toEqual(["Alperen Şengün", "Trey Murphy III", "Ausar Thompson"]);
    expect(monday.find(([slot]) => slot === "PG")?.[1]).toBe("Tyrese Maxey");
    expect(monday.filter(([slot]) => slot === "BE").map(([, who]) => who)).toContain("Josh Hart");
    const viewed = grid.rows.filter((r) => r.player && r.slotId != null && isActiveSlot(r.slotId)).map((r) => r.player!.name);
    expect(viewed).toHaveLength(10);
    expect(viewed).toContain("Tyrese Maxey");
    expect(grid.you[MON].actual).toBe(309.5);
  });

  test("before the board loads, a finished day with no record sits in today's spots, not another day's record", () => {
    // Tuesday is played too, with nothing on record; Wednesday is today.
    const later = {
      ...source,
      todayIndex: 2,
      days: source.days.map((d) => (d.index === 1 ? { ...d, kind: "past" as const } : d.index === 2 ? { ...d, kind: "today" as const } : d)),
    };
    const grid = buildWeekGrid({ source: later, board: null, staged: {}, incoming: null, viewDay: 1 });
    expect(grid.lineups.asItStood.slice(0, 3)).toEqual([true, false, false]);
    const slotOf = (day: number) =>
      new Map(seatsOn(grid, day).filter(([, who]) => who).map(([slot, who]) => [who!, slot]));
    const tuesday = slotOf(1);
    const wednesday = slotOf(2);
    expect(tuesday.get("Tyrese Maxey")).toBe(wednesday.get("Tyrese Maxey"));
    for (const [who, slot] of tuesday) if (wednesday.has(who)) expect(`${who} ${slot}`).toBe(`${who} ${wednesday.get(who)}`);
  });

  test("a spot left empty on every day on record still holds a starter on the days ahead", () => {
    const ausar = source.gone!.mine.find((p) => p.name === "Ausar Thompson")!.id;
    const benched = new Map(source.pastLineups!.you[MON]!).set(ausar, 12);
    const emptyUt = { ...source, pastLineups: { ...source.pastLineups!, you: source.pastLineups!.you.map((l, d) => (d === MON ? benched : l)) } };
    const grid = buildWeekGrid({ source: emptyUt, board: null, staged: {}, incoming: null, viewDay: today });
    const ut = (day: number) => seatsOn(grid, day).filter(([slot]) => slot === "UT").map(([, who]) => who);
    expect(ut(MON)).toEqual(["Alperen Şengün", "Trey Murphy III", null]);
    // Every day plans with the league's 10 active spots, not the 9 Monday filled.
    expect(grid.lineups.slots.filter((s) => isActiveSlot(s.slotId))).toHaveLength(source.activeSlotCount);
    expect(recordedSlots([benched], 10)).toContainEqual({ slotId: 11, count: 3 });
    expect(recordedSlots([null, null], 10)).toEqual([]);
  });

  test("a player dropped since is on that day only: not in today's rows or any later day", () => {
    const grid = buildWeekGrid({ source, board, staged: {}, incoming: null, viewDay: today });
    expect(row(grid, "Ausar Thompson")).toBeUndefined();
    for (let day = today; day < grid.days.length; day++) {
      expect(seatsOn(grid, day).map(([, who]) => who)).not.toContain("Ausar Thompson");
    }
    expect(seatsOn(grid, today).map(([, who]) => who)).toContain("Keegan Murray");
  });

  test("the player view can show it, read-only, with the players added since below", () => {
    expect(viewableDays(source)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(defaultViewDay(source)).toBe(today);
    const grid = buildWeekGrid({ source, board, staged: {}, incoming: null, viewDay: MON });
    expect(grid.rows.filter((r) => r.slot === "UT").map((r) => r.player?.name)).toContain("Ausar Thompson");
    expect(row(grid, "Josh Hart")!.slot).toBe("BE");
    expect(row(grid, "Keegan Murray")).toMatchObject({ slot: "—", slotId: null, later: true });
    expect(grid.rows[grid.rows.length - 1].later).toBe(true);
    expect(grid.lineups.editable[MON]).toBe(false);
    // The week's totals are the same whichever day the roster column shows.
    const onToday = buildWeekGrid({ source, board, staged: {}, incoming: null, viewDay: today });
    expect(grid.projected).toEqual(onToday.projected);
    expect(grid.you.map((t) => t.projected)).toEqual(onToday.you.map((t) => t.projected));
  });

  test("with no lineup on record it sits in today's spots and every game shows as counted", () => {
    const bare = { ...source, gone: undefined, pastLineups: undefined };
    const grid = buildWeekGrid({ source: bare, board, staged: {}, incoming: null, viewDay: today });
    expect(grid.lineups.asItStood[MON]).toBe(false);
    expect(row(grid, "Josh Hart")!.cells[MON]).toMatchObject({ state: "final", counts: true, tag: null });
    expect(seatsOn(grid, MON).map(([, who]) => who)).toContain("Keegan Murray");
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
    expect(defaultViewDay(source)).toBe(0);
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
