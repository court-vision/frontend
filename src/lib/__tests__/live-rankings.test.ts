import { describe, expect, test } from "bun:test";
import { migrateScout } from "@/components/scout/useScoutStore";
import {
  comparedText,
  dayTicks,
  espnAgeText,
  filterLive,
  flagText,
  fmtPlaces,
  gapText,
  lastDay,
  liveMovers,
  liveRows,
  loneDays,
  nearestPoint,
  rankChart,
  rankChartSummary,
  rankPoints,
  rankRuns,
  rankTicks,
  sortLive,
  spreadLabels,
  widestGap,
  type LiveRow,
  type RankPoint,
} from "@/lib/live-rankings";
import type { LiveBoardPlace, LiveRankDay, LiveRankingsPlayer } from "@/types/scout";

function place(rank: number, over: Partial<LiveBoardPlace> = {}): LiveBoardPlace {
  return { rank, value: 40 - rank, move_1d: null, move_7d: null, espn_rank: null, ...over };
}

function player(id: number, name: string, over: Partial<LiveRankingsPlayer> = {}): LiveRankingsPlayer {
  return { player_id: id, name, team: "DEN", position: "G", injury_status: null, season_gp: 12, games: 60, points: null, categories: null, ...over };
}

const BOARD: LiveRankingsPlayer[] = [
  player(3, "Carter", { position: "F-C", points: place(3, { move_1d: -2, move_7d: 4, espn_rank: 3 }), categories: place(1) }),
  player(1, "Avery", { points: place(1, { move_1d: 0, move_7d: 0, espn_rank: 9 }), injury_status: "DTD", games: 58.5 }),
  player(2, "Blake", { team: null, points: place(2, { move_1d: 5, move_7d: null, espn_rank: null }) }),
  player(4, "Devon", { position: null, categories: place(2, { espn_rank: 1 }) }),
];

const row = (id: number, rank: number, over: Partial<LiveRow> = {}): LiveRow => ({ id, name: `P${id}`, team: "DEN", position: "G", status: null, games: 60, rank, value: 30, day: null, week: null, espnRank: null, gap: null, ...over });

describe("the rows of a rest-of-season board", () => {
  test("only the players on that board, best first, with the gap to ESPN worked out", () => {
    const rows = liveRows(BOARD, "points");
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(rows[0]).toEqual({ id: 1, name: "Avery", team: "DEN", position: "G", status: "DTD", games: 58.5, rank: 1, value: 39, day: 0, week: 0, espnRank: 9, gap: 8 });
    // ESPN does not rank him: there is no gap to give, not a gap of zero
    expect(rows[1].gap).toBeNull();
    expect(rows[2].gap).toBe(0);
  });

  test("the 9-cat board is its own list", () => {
    expect(liveRows(BOARD, "categories").map((r) => [r.id, r.rank, r.gap])).toEqual([[3, 1, null], [4, 2, -1]]);
  });

  test("nothing stored is an empty board", () => {
    expect(liveRows(null, "points")).toEqual([]);
    expect(liveRows(undefined, "categories")).toEqual([]);
  });
});

describe("sorting and filtering the board", () => {
  const rows = liveRows(BOARD, "points");

  test("a move sorts biggest gain first, and a move that was never measured goes last", () => {
    expect(sortLive(rows, "day").map((r) => r.id)).toEqual([2, 1, 3]);
    // Blake has no week to measure: after the fallers, not between them
    expect(sortLive(rows, "week").map((r) => r.id)).toEqual([3, 1, 2]);
  });

  test("against ESPN sorts by how far above ESPN's rank he is here, the unranked last", () => {
    expect(sortLive(rows, "espn").map((r) => r.id)).toEqual([1, 3, 2]);
  });

  test("by name, and back to the board's own order", () => {
    expect(sortLive([...rows].reverse(), "name").map((r) => r.name)).toEqual(["Avery", "Blake", "Carter"]);
    expect(sortLive([...rows].reverse(), "rank").map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  test("equal moves keep the board's order", () => {
    const tied = [row(1, 9, { day: 2 }), row(2, 4, { day: 2 }), row(3, 6, { day: 2 })];
    expect(sortLive(tied, "day").map((r) => r.rank)).toEqual([4, 6, 9]);
  });

  test("a position filter reads every position a player is listed at", () => {
    expect(filterLive(rows, "C", "rank").map((r) => r.id)).toEqual([3]);
    expect(filterLive(rows, "G", "rank").map((r) => r.id)).toEqual([1, 2]);
    expect(filterLive(rows, "ALL", "day").map((r) => r.id)).toEqual([2, 1, 3]);
  });

  test("sorting leaves the rows it was given alone", () => {
    const before = rows.map((r) => r.id);
    sortLive(rows, "name");
    expect(rows.map((r) => r.id)).toEqual(before);
  });
});

describe("the day's movers", () => {
  const rows = [
    row(1, 10, { day: 6, week: -3 }),
    row(2, 40, { day: 12, week: 1 }),
    row(3, 90, { day: -8 }),
    row(4, 30, { day: 0 }),
    row(5, 20, { day: null }),
    // Thirty places gained, far down the board: he was 330th and is 300th
    row(6, 300, { day: 30 }),
    // Fell out of the top 150: he was inside it yesterday, so the fall counts
    row(7, 170, { day: -40 }),
    // Climbed into it
    row(8, 140, { day: 25 }),
  ];

  test("the biggest risers and fallers, without the unmoved, the unmeasured and the deep board", () => {
    const { up, down } = liveMovers(rows, "day");
    expect(up.map((r) => r.id)).toEqual([8, 2, 1]);
    expect(down.map((r) => r.id)).toEqual([7, 3]);
  });

  test("a limit keeps the top of each list", () => {
    const { up, down } = liveMovers(rows, "day", 1);
    expect(up.map((r) => r.id)).toEqual([8]);
    expect(down.map((r) => r.id)).toEqual([7]);
  });

  test("over a week it reads the week's move", () => {
    const { up, down } = liveMovers(rows, "week");
    expect(up.map((r) => r.id)).toEqual([2]);
    expect(down.map((r) => r.id)).toEqual([1]);
  });

  test("a board with no earlier board has no movers", () => {
    expect(liveMovers([row(1, 1), row(2, 2)], "day")).toEqual({ up: [], down: [] });
  });
});

describe("the widest gap to ESPN", () => {
  test("the biggest disagreement in either direction, inside the top of the board", () => {
    const rows = [row(1, 5, { espnRank: 9, gap: 4 }), row(2, 20, { espnRank: 8, gap: -12 }), row(3, 150, { espnRank: 20, gap: -130 })];
    expect(widestGap(rows)?.id).toBe(2);
    expect(widestGap(rows, 200)?.id).toBe(3);
  });

  test("none when ESPN ranks nobody, or agrees on everyone", () => {
    expect(widestGap([row(1, 1), row(2, 2)])).toBeNull();
    expect(widestGap([row(1, 1, { espnRank: 1, gap: 0 })])).toBeNull();
  });
});

describe("the words beside a rank", () => {
  test("places carry their sign, and a move that could not be measured is a dash", () => {
    expect([fmtPlaces(6), fmtPlaces(-3), fmtPlaces(0), fmtPlaces(null), fmtPlaces(undefined)]).toEqual(["+6", "−3", "0", "—", "—"]);
  });

  test("a gap says which side of ESPN he is on", () => {
    expect([gapText(6), gapText(-3), gapText(0), gapText(null)]).toEqual(["6 above ESPN", "3 below ESPN", "level with ESPN", null]);
  });

  test("what the moves are measured against, or why there is nothing yet", () => {
    expect(comparedText({ day: "2026-11-20", week: "2026-11-14" })).toBe("moves since Nov 20 and Nov 14");
    expect(comparedText({ day: "2026-11-20", week: null })).toBe("moves since Nov 20 · a week of boards is not stored yet");
    expect(comparedText({ day: null, week: "2026-11-14" })).toBe("moves since Nov 14");
    expect(comparedText({ day: null, week: null })).toBe("no earlier board to measure moves against yet");
    expect(comparedText(null)).toBe("no earlier board to measure moves against yet");
  });

  test("how long ESPN has held a rank, and that a run reaching the first stored day may be older", () => {
    expect(espnAgeText({ rank: 9, unchanged_since: "2026-11-19", since_first_stored: false })).toBe("held since Nov 19");
    expect(espnAgeText({ rank: 1, unchanged_since: "2026-11-12", since_first_stored: true })).toBe("held since at least Nov 12");
    expect(espnAgeText(null)).toBeNull();
  });

  test("an availability flag as a chip prints it, and nothing for a player who plays", () => {
    expect([flagText("DTD"), flagText("day_to_day"), flagText("OUT"), flagText("Out For Season"), flagText("SUSPENSION"), flagText("QUESTIONABLE")]).toEqual(["DTD", "DTD", "OUT", "OUT", "SUSP", "QUES"]);
    expect([flagText(null), flagText(""), flagText("ACTIVE"), flagText("healthy")]).toEqual([null, null, null, null]);
  });
});

const day = (as_of: string, points: number | null, espn_points: number | null, categories: number | null = null, espn_categories: number | null = null): LiveRankDay => ({ as_of, points, categories, espn_points, espn_categories });

describe("a player's days on a board", () => {
  const sheet = {
    history: [day("2026-11-19", null, 9), day("2026-11-12", null, 12), day("2026-11-21", 1, 9, 2), day("2026-11-20", 2, 9), day("2026-11-14", 3, null)],
    board_days: ["2026-11-14", "2026-11-18", "2026-11-20", "2026-11-21"],
    espn_days: ["2026-11-10", "2026-11-12", "2026-11-19", "2026-11-20", "2026-11-21"],
  };

  test("every stored day from the first that ranked him, oldest first, with who stored a board that day", () => {
    expect(rankPoints(sheet, "points")).toEqual([
      { day: "2026-11-12", cv: null, espn: 12, cvStored: false, espnStored: true },
      { day: "2026-11-14", cv: 3, espn: null, cvStored: true, espnStored: false },
      // Our board was stored without him: a day off it. On Nov 19 it was never stored at all.
      { day: "2026-11-18", cv: null, espn: null, cvStored: true, espnStored: false },
      { day: "2026-11-19", cv: null, espn: 9, cvStored: false, espnStored: true },
      { day: "2026-11-20", cv: 2, espn: 9, cvStored: true, espnStored: true },
      { day: "2026-11-21", cv: 1, espn: 9, cvStored: true, espnStored: true },
    ]);
  });

  test("the other board starts on its own first day", () => {
    expect(rankPoints(sheet, "categories")).toEqual([{ day: "2026-11-21", cv: 2, espn: null, cvStored: true, espnStored: true }]);
  });

  test("a player dropped from this morning's boards keeps the morning, without a rank", () => {
    const dropped = { history: [day("2026-11-20", 3, 40)], board_days: ["2026-11-20", "2026-11-21"], espn_days: ["2026-11-20", "2026-11-21"] };
    expect(rankPoints(dropped, "points")).toEqual([
      { day: "2026-11-20", cv: 3, espn: 40, cvStored: true, espnStored: true },
      { day: "2026-11-21", cv: null, espn: null, cvStored: true, espnStored: true },
    ]);
  });

  test("a rank is proof its board was stored, whatever the lists of days say", () => {
    const bare = { history: sheet.history, board_days: [], espn_days: [] };
    expect(rankPoints(bare, "points").map((p) => [p.day.slice(8), p.cvStored, p.espnStored])).toEqual([
      ["12", false, true],
      ["14", true, false],
      ["19", false, true],
      ["20", true, true],
      ["21", true, true],
    ]);
  });

  test("with no rank on a board there are no days of it", () => {
    expect(rankPoints(null, "points")).toEqual([]);
    expect(rankPoints({ history: [], board_days: ["2026-11-21"], espn_days: ["2026-11-21"] }, "points")).toEqual([]);
  });
});

const PAD = { top: 10, right: 20, bottom: 20, left: 30 };
/** Days of a chart; a fourth entry names a source that stored no board at all that day. */
const pts = (...rows: Array<[string, number | null, number | null, ("cv" | "espn")?]>): RankPoint[] =>
  rows.map(([d, cv, espn, missed]) => ({ day: d, cv, espn, cvStored: missed !== "cv", espnStored: missed !== "espn" }));

describe("the rank chart's geometry", () => {
  test("rank 1 is at the top and the days are spaced by the calendar", () => {
    const points = pts(["2026-11-11", 1, 21], ["2026-11-12", 11, 21], ["2026-11-21", 21, 21]);
    const g = rankChart(points, 230, 130, PAD)!;
    expect([g.best, g.worst]).toEqual([1, 21]);
    expect([g.y(1), g.y(11), g.y(21)]).toEqual([10, 60, 110]);
    // Ten days across 180 px: the second day is one tenth of the way, not half
    expect([g.x("2026-11-11"), g.x("2026-11-12"), g.x("2026-11-21")]).toEqual([30, 48, 210]);
    expect(g.cv).toEqual(["M30.0 10.0 L48.0 60.0 L210.0 110.0"]);
    expect(g.espn).toEqual(["M30.0 110.0 L48.0 110.0 L210.0 110.0"]);
  });

  test("a day he was off the board breaks the line instead of bridging it", () => {
    const points = pts(["2026-11-11", 5, null], ["2026-11-12", 6, null], ["2026-11-13", null, null], ["2026-11-14", 8, null], ["2026-11-15", 12, null]);
    const g = rankChart(points, 230, 130, PAD)!;
    expect(g.cv.length).toBe(2);
    expect(g.cv[0].startsWith("M30.0")).toBe(true);
    expect(g.cv[1].split(" L").length).toBe(2);
    expect(g.espn).toEqual([]);
  });

  test("a morning no board was stored is stepped over: the line runs on across it", () => {
    const points = pts(["2026-11-11", 5, null], ["2026-11-12", 6, null], ["2026-11-13", null, 9, "cv"], ["2026-11-14", 8, null], ["2026-11-15", 12, null]);
    const g = rankChart(points, 230, 130, PAD)!;
    expect(g.cv.length).toBe(1);
    expect(g.cv[0].split(" L").length).toBe(4);
    expect(rankRuns(points, "cv")).toEqual([[0, 1, 3, 4]]);
    // ESPN stored its ranks on the other four days and did not rank him: one day alone
    expect(rankRuns(points, "espn")).toEqual([[2]]);
  });

  test("a rank that never moved is a flat line across a span of six places, not a cliff", () => {
    const g = rankChart(pts(["2026-11-20", 40, 41], ["2026-11-21", 40, 41]), 230, 130, PAD)!;
    expect(g.worst - g.best).toBe(6);
    expect(g.best).toBeLessThanOrEqual(40);
    expect(g.worst).toBeGreaterThanOrEqual(41);
  });

  test("the axis never reaches above rank 1", () => {
    const g = rankChart(pts(["2026-11-21", 1, 2]), 230, 130, PAD)!;
    expect([g.best, g.worst]).toEqual([1, 7]);
  });

  test("a single stored day sits in the middle of the plot", () => {
    const g = rankChart(pts(["2026-11-21", 12, null]), 230, 130, PAD)!;
    expect(g.x("2026-11-21")).toBe(120);
    expect(g.cv).toEqual(["M120.0 " + g.y(12).toFixed(1)]);
  });

  test("with no rank at all there is nothing to draw", () => {
    expect(rankChart([], 230, 130, PAD)).toBeNull();
    expect(rankChart(pts(["2026-11-21", null, null]), 230, 130, PAD)).toBeNull();
  });
});

describe("the rules across the plot", () => {
  test("both ends, and clean ranks between them", () => {
    expect(rankTicks(1, 21)).toEqual([1, 10, 21]);
    expect(rankTicks(40, 46)).toEqual([40, 42, 44, 46]);
    expect(rankTicks(1, 300)).toEqual([1, 100, 200, 300]);
  });

  test("a clean rank a hair from an end is left out, so two labels never print on one another", () => {
    // 10 would sit one place under the top rule
    expect(rankTicks(9, 31)).toEqual([9, 20, 31]);
    expect(rankTicks(3, 9)).toEqual([3, 6, 9]);
  });
});

describe("what the chart marks besides its lines", () => {
  const points = pts(["2026-11-12", null, 12], ["2026-11-14", 3, null], ["2026-11-19", null, 9], ["2026-11-20", 2, 9], ["2026-11-21", 1, null]);

  test("the last day each source ranked him", () => {
    expect([lastDay(points, "cv"), lastDay(points, "espn")]).toEqual([4, 3]);
    expect(lastDay(pts(["2026-11-21", null, 4]), "cv")).toBe(-1);
  });

  test("a ranked day with no ranked day either side is a dot: a line needs two", () => {
    expect(loneDays(points, "cv")).toEqual([1]);
    expect(loneDays(points, "espn")).toEqual([0]);
    expect(loneDays(pts(["2026-11-21", 7, null]), "cv")).toEqual([0]);
  });

  test("the pointer snaps to the nearest stored day", () => {
    const g = rankChart(points, 230, 130, PAD)!;
    // Nine days over 180 px: Nov 14 is at 70, Nov 19 at 170
    expect(nearestPoint(points, g, 0)).toBe(0);
    expect(nearestPoint(points, g, 75)).toBe(1);
    expect(nearestPoint(points, g, 150)).toBe(2);
    expect(nearestPoint(points, g, 400)).toBe(4);
  });

  test("days under the plot are labelled as far apart as they fit, the first and the last always", () => {
    const daily = pts(...Array.from({ length: 10 }, (_, i) => [`2026-11-${String(11 + i).padStart(2, "0")}`, i + 1, null] as [string, number, null]));
    const g = rankChart(daily, 230, 130, PAD)!;
    // 20 px a day, labels at least 64 px apart: every fourth day, and the last in place of the one beside it
    expect(dayTicks(daily, g)).toEqual([0, 4, 9]);
    expect(dayTicks(daily, g, 10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(dayTicks(pts(["2026-11-21", 1, null]), rankChart(pts(["2026-11-21", 1, null]), 230, 130, PAD)!)).toEqual([0]);
    expect(dayTicks([], g)).toEqual([]);
  });

  test("two labels at a line's end keep their heights when they are apart", () => {
    expect(spreadLabels(20, 60)).toEqual([20, 60]);
    expect(spreadLabels(20, null)).toEqual([20, null]);
    expect(spreadLabels(null, null)).toEqual([null, null]);
  });

  test("and are moved apart around their midpoint when they would print on one another", () => {
    expect(spreadLabels(50, 54)).toEqual([46, 58]);
    expect(spreadLabels(54, 50)).toEqual([58, 46]);
    // Level: ours goes above
    expect(spreadLabels(50, 50)).toEqual([44, 56]);
  });
});

describe("the chart in a sentence", () => {
  test("where he started and stands, the range between, and ESPN's newest rank", () => {
    const points = pts(["2026-11-14", 3, null], ["2026-11-20", 2, 9], ["2026-11-21", 1, 9]);
    expect(rankChartSummary(points, "Rising Guard", "points")).toBe(
      "Rising Guard on Court Vision's points board: rank 3 on Nov 14, rank 1 on Nov 21, between 1 and 3 over 3 stored days. ESPN ranked him 9 on Nov 21."
    );
  });

  test("one day reads as one day, and ESPN is left out when it never ranked him", () => {
    expect(rankChartSummary(pts(["2026-11-21", 12, null]), "New Big", "categories")).toBe(
      "New Big on Court Vision's 9-cat board: rank 12 on Nov 21, rank 12 on Nov 21, between 12 and 12 over 1 stored day."
    );
  });

  test("a player only ESPN ranks says so", () => {
    expect(rankChartSummary(pts(["2026-11-21", null, 40]), "Old Wing", "points")).toBe("Old Wing has not been on Court Vision's points board this season.");
  });
});

describe("what an older browser stored for Scout", () => {
  const v3 = { lens: "market", window: "l10", pool: { scope: "league", format: "categories", span: 14, pos: "G", sort: "fpts" }, pinned: [{ kind: "player", id: 7 }], recent: [] };

  test("a version before the rest-of-season board keeps its pool controls and opens on the so-far board", () => {
    const next = migrateScout(v3, 3);
    expect(next.pool).toEqual({ board: "season", scope: "league", format: "categories", span: 14, pos: "G", sort: "fpts", liveSort: "rank" });
    expect([next.lens, next.window, next.pinned]).toEqual(["market", "l10", [{ kind: "player", id: 7 }]]);
  });

  test("a version before the league score has no league to score by", () => {
    const next = migrateScout({ ...v3, pool: { format: "categories", span: 7, pos: "C", sort: "rank" } }, 2);
    expect(next.pool).toEqual({ board: "season", scope: "global", format: "categories", span: 7, pos: "C", sort: "rank", liveSort: "rank" });
  });

  test("anything older is dropped but for the lens and the window", () => {
    const next = migrateScout({ lens: "teams", window: "l5", pinned: [1], recent: [2] }, 1);
    expect([next.lens, next.window, next.pinned, next.recent]).toEqual(["teams", "l5", [], []]);
    expect(next.pool?.board).toBe("season");
  });

  test("the current version is left as it is", () => {
    const now: unknown = { lens: "pool", pool: { board: "live" } };
    expect(migrateScout(now, 4) as unknown).toBe(now);
  });
});
