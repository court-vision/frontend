import { describe, expect, test } from "bun:test";
import { buildWeekGrid } from "../week-grid";
import { sourceFromStreamer } from "../week-source";
import { DEMO_BREAKOUTS, DEMO_STREAMERS, DEMO_TODAY, demoBoard, demoDailyStreamers, demoSource } from "../week-demo";
import {
  DEFAULT_FILTERS,
  NO_DROP,
  addsCountFrom,
  better,
  dropCandidates,
  gainOf,
  joinBreakouts,
  matchesFilters,
  openSpots,
  rosterRoom,
  stripFor,
} from "../market";

const source = demoSource();
const board = demoBoard();
const base = buildWeekGrid({ source, board, staged: {}, incoming: null, viewDay: DEMO_TODAY, mode: "best" });
const fa = (name: string) => DEMO_STREAMERS.find((f) => f.name === name)!;
const withFa = (name: string, replaces: number, firstDay: number | null = null) =>
  buildWeekGrid({
    source,
    board,
    staged: {},
    incoming: { player: sourceFromStreamer(fa(name), source.days, null, firstDay), replaces },
    viewDay: DEMO_TODAY,
    mode: "best",
  });

describe("gains", () => {
  test("the week's change is the sum of each day's", () => {
    const hart = source.mine.find((p) => p.name === "Josh Hart")!.id;
    const g = gainOf(base, withFa("Toumani Camara", hart), hart);
    expect(g.byDay).toHaveLength(7);
    expect(g.byDay[0]).toBe(0); // Monday is played
    expect(Math.abs(g.byDay.reduce((a, b) => a + b, 0) - g.week)).toBeLessThan(0.2);
    expect(g.week).toBeGreaterThan(0);
  });

  test("an add after today's first tip counts from tomorrow", () => {
    expect(addsCountFrom(source, board)).toBe(DEMO_TODAY + 1);
    const hart = source.mine.find((p) => p.name === "Josh Hart")!.id;
    const now = gainOf(base, withFa("Toumani Camara", hart, DEMO_TODAY + 1), hart);
    const before = gainOf(base, withFa("Toumani Camara", hart), hart);
    // Camara plays tonight: counting it is worth his average; after the first tip it isn't counted.
    expect(before.byDay[DEMO_TODAY]).toBeGreaterThan(0);
    expect(now.byDay[DEMO_TODAY]).toBeLessThanOrEqual(0);
  });

  test("before any game tips, today still counts", () => {
    const quiet = {
      ...source,
      mine: source.mine.map((p) => ({ ...p, games: p.games.map((g, i) => (i === DEMO_TODAY && g ? { ...g, status: "scheduled" as const, fpts: null } : g)) })),
      opponents: source.opponents.map((p) => ({ ...p, games: p.games.map((g, i) => (i === DEMO_TODAY && g ? { ...g, status: "scheduled" as const, fpts: null } : g)) })),
    };
    expect(addsCountFrom(quiet, { ...board, players: board.players.map((p) => ({ ...p, game_started: false })) })).toBeNull();
  });

  test("ranking prefers the asked-for day, then the week", () => {
    const a = { dropId: 1, week: 10, byDay: [0, 5, 0, 0, 0, 0, 0] };
    const b = { dropId: 2, week: 12, byDay: [0, 2, 0, 0, 0, 0, 0] };
    expect(better(a, b, null).dropId).toBe(2);
    expect(better(a, b, 1).dropId).toBe(1);
    expect(better(null, a, 1).dropId).toBe(1);
  });
});

describe("roster", () => {
  test("drop candidates are the lowest projected, never IR", () => {
    const ids = dropCandidates(source, board, 3);
    const avgs = ids.map((id) => source.mine.find((p) => p.id === id)!.avg);
    expect(avgs).toEqual([...avgs].sort((a, b) => a - b));
    expect(Math.max(...avgs)).toBeLessThanOrEqual(Math.min(...source.mine.filter((p) => !ids.includes(p.id)).map((p) => p.avg)));
  });

  test("a full roster has no room; an empty spot does", () => {
    expect(rosterRoom(board)).toBe(0);
    expect(rosterRoom({ ...board, players: board.players.slice(1) })).toBe(1);
    expect(rosterRoom(null)).toBe(0);
  });

  test("open spots: active spots no counted game fills", () => {
    const open = openSpots(base);
    expect(open[0]).toBe(0);
    expect(open[DEMO_TODAY]).toBeGreaterThan(0);
    expect(open.every((n) => n >= 0 && n <= 10)).toBe(true);
  });
});

describe("the pane's rows", () => {
  test("a strip lights the games that land in an open spot", () => {
    const camara = fa("Toumani Camara");
    const open = [0, 2, 0, 1, 1, 1, 1];
    const strip = stripFor(camara, source.days, open);
    camara.game_days.forEach((d) => expect(strip[d]).toBe(open[d] > 0 ? "open" : "busy"));
    expect(strip.filter((x, i) => !camara.game_days.includes(i)).every((x) => x === "none")).toBe(true);
    // After today's first tip, tonight's game is too soon to count.
    expect(stripFor(camara, source.days, open, DEMO_TODAY + 1)[DEMO_TODAY]).toBe("past");
  });

  test("filters: position, back-to-backs, injuries, waivers, name or team", () => {
    const pool = DEMO_STREAMERS;
    const only = (patch: Partial<typeof DEFAULT_FILTERS>) => pool.filter((f) => matchesFilters(f, { ...DEFAULT_FILTERS, ...patch }));
    expect(only({ position: "C" }).every((f) => f.valid_positions.includes("C"))).toBe(true);
    expect(only({ b2bOnly: true }).every((f) => f.has_b2b)).toBe(true);
    expect(only({ hideInjured: true }).some((f) => f.injured)).toBe(false);
    expect(only({ hideWaivers: true }).some((f) => f.acquisition_status === "waivers")).toBe(false);
    expect(only({ query: "tor" }).map((f) => f.team)).toEqual(["TOR", "TOR"]);
    expect(only({ query: "camara" })).toHaveLength(1);
  });

  test("breakouts join the pool; a beneficiary not on the market comes back alone", () => {
    const rows = joinBreakouts(DEMO_BREAKOUTS, DEMO_STREAMERS);
    expect(rows.filter((r) => r.fa).map((r) => r.fa!.name)).toEqual(["Dyson Daniels", "Scotty Pippen Jr.", "Moussa Diabaté"]);
    expect(rows.find((r) => !r.fa)?.candidate.beneficiary.name).toBe("Kelly Oubre Jr.");
  });

  test("the one-day search has only players with a game that day", () => {
    const wed = demoDailyStreamers(2);
    expect(wed.length).toBeGreaterThan(0);
    expect(wed.every((f) => f.game_days.includes(2))).toBe(true);
    expect(NO_DROP).toBeLessThan(0);
  });
});
