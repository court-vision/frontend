import { describe, expect, test } from "bun:test";
import type { GameLog } from "@/types/player";
import type { RankingsPlayer } from "@/types/rankings";
import {
  addDays,
  ageOn,
  averageLine,
  bestOf,
  clockText,
  dayName,
  deltaSign,
  filterPool,
  fmtDelta,
  fmtPctDot,
  focusFromSearch,
  focusToSearch,
  gameStatusText,
  hasPosition,
  isDate,
  lensOf,
  lineFromAvg,
  matchPool,
  matchTeams,
  nextLens,
  nextWindow,
  parseDateQuery,
  projectionRows,
  sameFocus,
  shortName,
  slateDates,
  splitLines,
  standings,
  tier,
  tipText,
} from "@/lib/scout";

function log(i: number, over: Partial<GameLog> = {}): GameLog {
  return {
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    game_id: null,
    opponent: "LAL",
    home: true,
    fpts: 40 + i,
    pts: 20 + i,
    reb: 10,
    ast: 5,
    stl: 1,
    blk: 1,
    tov: 3,
    min: 34,
    fgm: 8,
    fga: 16,
    fg3m: 2,
    fg3a: 6,
    ftm: 4,
    fta: 5,
    ...over,
  };
}

function row(id: number, name: string, over: Partial<RankingsPlayer> = {}): RankingsPlayer {
  return {
    id,
    player_name: name,
    team: "DEN",
    position: "C",
    rank: id,
    rank_change: 0,
    avg_fpts: 50 - id,
    total_fpts: 1000,
    gp: 20,
    categories: null,
    category_z: null,
    score: null,
    ...over,
  };
}

describe("focus ↔ URL", () => {
  test("a player, a team, a game, a market list, an overview, or nothing", () => {
    expect(focusFromSearch(new URLSearchParams("p=203999"))).toEqual({ kind: "player", id: 203999 });
    expect(focusFromSearch(new URLSearchParams("t=den"))).toEqual({ kind: "team", abbrev: "DEN" });
    expect(focusFromSearch(new URLSearchParams("g=2026-10-20:0022600001"))).toEqual({ kind: "game", date: "2026-10-20", gameId: "0022600001" });
    expect(focusFromSearch(new URLSearchParams("m=drops"))).toEqual({ kind: "market", section: "drops" });
    expect(focusFromSearch(new URLSearchParams("o=teams"))).toEqual({ kind: "overview", lens: "teams" });
    expect(focusFromSearch(new URLSearchParams("o=slate&d=2026-10-20"))).toEqual({ kind: "overview", lens: "slate" });
    expect(focusFromSearch(new URLSearchParams(""))).toBeNull();
    expect(focusFromSearch(new URLSearchParams("p=abc"))).toBeNull();
    expect(focusFromSearch(new URLSearchParams("t=XXX"))).toBeNull();
    expect(focusFromSearch(new URLSearchParams("g=2026-02-31:1"))).toBeNull();
    expect(focusFromSearch(new URLSearchParams("m=sells"))).toBeNull();
    expect(focusFromSearch(new URLSearchParams("o=nope"))).toBeNull();
  });

  test("round trips", () => {
    for (const f of [
      { kind: "player" as const, id: 7 },
      { kind: "team" as const, abbrev: "BOS" },
      { kind: "game" as const, date: "2026-11-01", gameId: "0022600123" },
      { kind: "game" as const, date: "2026-11-01", gameId: "BOS@NYK" },
      { kind: "market" as const, section: "draft" as const },
      { kind: "overview" as const, lens: "market" as const },
      { kind: "overview" as const, lens: "slate" as const },
    ]) {
      expect(focusFromSearch(new URLSearchParams(focusToSearch(f)))).toEqual(f);
    }
    expect(focusToSearch(null)).toBe("");
  });

  test("sameFocus compares by identity, not reference; lensOf names the lens", () => {
    expect(sameFocus({ kind: "player", id: 1 }, { kind: "player", id: 1 })).toBe(true);
    expect(sameFocus({ kind: "player", id: 1 }, { kind: "team", abbrev: "DEN" })).toBe(false);
    expect(sameFocus({ kind: "overview", lens: "slate" }, { kind: "overview", lens: "pool" })).toBe(false);
    expect(sameFocus(null, null)).toBe(true);
    expect(sameFocus(null, { kind: "player", id: 1 })).toBe(false);
    expect(lensOf({ kind: "game", date: "2026-10-20", gameId: "x" })).toBe("slate");
    expect(lensOf({ kind: "market", section: "adds" })).toBe("market");
  });
});

describe("standings", () => {
  test("orders by winning percentage within each conference and measures games behind", () => {
    const row = (abbrev: string, conference: string, w: number, l: number, net: number) => ({ abbrev, name: abbrev, conference, w, l, net, off: null, def: null, pace: null, pts: null });
    const table = standings([row("OKC", "West", 68, 14, 12.1), row("DEN", "West", 50, 32, 3.8), row("CLE", "East", 64, 18, 9.2), row("BOS", "East", 61, 21, 8.0), row("NYK", "East", 61, 21, 6.0)]);
    expect(table.West.map((r) => r.abbrev)).toEqual(["OKC", "DEN"]);
    expect(table.West[1].gb).toBe(18);
    expect(table.East.map((r) => r.abbrev)).toEqual(["CLE", "BOS", "NYK"]);
    expect(table.East[1].gb).toBe(3);
    expect(fmtPctDot(table.West[0].pct)).toBe(".829");
  });
});

describe("lens and window cycling", () => {
  test("wrap around both ways", () => {
    expect(nextLens("pool", 1)).toBe("teams");
    expect(nextLens("market", 1)).toBe("pool");
    expect(nextLens("pool", -1)).toBe("market");
    expect(nextWindow("season")).toBe("l5");
    expect(nextWindow("l30")).toBe("season");
    expect(nextWindow("season", -1)).toBe("l30");
  });
});

describe("stat lines", () => {
  test("averages count the games and derive rates from totals", () => {
    const line = averageLine([log(0, { fgm: 10, fga: 20 }), log(1, { fgm: 0, fga: 10 })]);
    expect(line?.gp).toBe(2);
    expect(line?.fpts).toBe(40.5);
    // 10/30 = 33.3%, not the mean of 50% and 0%
    expect(line?.fgPct).toBe(33.3);
    expect(line?.ftPct).toBe(80);
  });

  test("no games is no line; no attempts is no rate", () => {
    expect(averageLine([])).toBeNull();
    expect(averageLine([log(0, { fta: 0, ftm: 0 })])?.ftPct).toBeNull();
  });

  test("splits take the last N games in date order, whatever order they came in", () => {
    const logs = Array.from({ length: 12 }, (_, i) => log(i)).reverse();
    const splits = splitLines(logs);
    const by = Object.fromEntries(splits.map((s) => [s.window, s.line]));
    expect(by.season?.gp).toBe(12);
    expect(by.l5?.gp).toBe(5);
    expect(by.l5?.fpts).toBe((47 + 48 + 49 + 50 + 51) / 5);
    expect(by.l10?.gp).toBe(10);
    expect(by.l30?.gp).toBe(12);
  });

  test("the API's averages become a line, with a rate only where attempts exist", () => {
    const line = lineFromAvg(
      {
        avg_fpts: 50,
        avg_points: 25,
        avg_rebounds: 10,
        avg_assists: 8,
        avg_steals: 1,
        avg_blocks: 1,
        avg_turnovers: 3,
        avg_minutes: 34,
        avg_fg_pct: 55.5,
        avg_fg3_pct: 0,
        avg_ft_pct: 0,
        avg_ts_pct: 60,
        avg_efg_pct: 58,
        avg_three_rate: 30,
        avg_ft_rate: 20,
        avg_fgm: 10,
        avg_fga: 18,
        avg_fg3m: 0,
        avg_fg3a: 0,
        avg_ftm: 0,
        avg_fta: 0,
      },
      40
    );
    expect(line.gp).toBe(40);
    expect(line.fgPct).toBe(55.5);
    expect(line.ftPct).toBeNull();
    expect(line.fg3Pct).toBeNull();
  });

  test("deltas read right for stats where lower is better", () => {
    expect(fmtDelta(2.44)).toBe("+2.4");
    expect(fmtDelta(-0.3)).toBe("−0.3");
    expect(fmtDelta(0.01)).toBe("0.0");
    expect(deltaSign(1, "high")).toBe("up");
    expect(deltaSign(1, "low")).toBe("down");
    expect(deltaSign(-1, "low")).toBe("up");
    expect(deltaSign(0.01, "high")).toBeNull();
  });
});

describe("compare", () => {
  test("the best cell per row, ties shared, nulls skipped", () => {
    expect([...bestOf([3, 5, null, 5], "high")]).toEqual([1, 3]);
    expect([...bestOf([3, 5, null, 1], "low")]).toEqual([3]);
    expect(bestOf([null, undefined], "high").size).toBe(0);
  });

  test("percentile tiers", () => {
    expect(tier(95)).toBe("hot");
    expect(tier(80)).toBe("hot");
    expect(tier(50)).toBe("mid");
    expect(tier(20)).toBe("cold");
  });
});

describe("calendar", () => {
  test("real dates only", () => {
    expect(isDate("2026-10-20")).toBe(true);
    expect(isDate("2026-02-29")).toBe(false);
    expect(isDate("2028-02-29")).toBe(true);
    expect(isDate("10/20/2026")).toBe(false);
  });

  test("day arithmetic crosses months and years", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(slateDates("2026-10-20", 1, 2)).toEqual(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"]);
  });

  test("day names relative to today", () => {
    expect(dayName("2026-10-08", "2026-10-08")).toBe("Today");
    expect(dayName("2026-10-09", "2026-10-08")).toBe("Tomorrow");
    expect(dayName("2026-10-07", "2026-10-08")).toBe("Yesterday");
    expect(dayName("2026-10-20", "2026-10-08")).toBe("Tue Oct 20");
  });

  test("age counts the birthday", () => {
    expect(ageOn("1995-02-19", "2026-02-18")).toBe(30);
    expect(ageOn("1995-02-19", "2026-02-19")).toBe(31);
    expect(ageOn(null, "2026-02-19")).toBeNull();
    expect(ageOn("not a date", "2026-02-19")).toBeNull();
  });

  test("the finder reads dates the way people type them", () => {
    const today = "2026-10-08"; // a Thursday
    expect(parseDateQuery("today", today)).toBe(today);
    expect(parseDateQuery("Tonight", today)).toBe(today);
    expect(parseDateQuery("tomorrow", today)).toBe("2026-10-09");
    expect(parseDateQuery("yesterday", today)).toBe("2026-10-07");
    expect(parseDateQuery("2026-10-20", today)).toBe("2026-10-20");
    expect(parseDateQuery("10/20", today)).toBe("2026-10-20");
    expect(parseDateQuery("10/20/26", today)).toBe("2026-10-20");
    expect(parseDateQuery("2/31", today)).toBeNull();
    expect(parseDateQuery("fri", today)).toBe("2026-10-09");
    expect(parseDateQuery("thursday", today)).toBe(today);
    expect(parseDateQuery("wed", today)).toBe("2026-10-14");
    expect(parseDateQuery("jokic", today)).toBeNull();
    expect(parseDateQuery("", today)).toBeNull();
  });
});

describe("finder matching", () => {
  test("teams by abbreviation, city or name", () => {
    expect(matchTeams("den").map((t) => t.abbrev)).toEqual(["DEN"]);
    expect(matchTeams("los")[0].abbrev).toBe("LAC");
    expect(matchTeams("Lakers").map((t) => t.abbrev)).toEqual(["LAL"]);
    expect(matchTeams("x")).toEqual([]);
  });

  test("players by name, word, initials and team, best first then by rank", () => {
    const pool = [row(1, "Nikola Jokić"), row(2, "Jalen Johnson"), row(3, "Shai Gilgeous-Alexander"), row(4, "Jamal Murray")];
    expect(matchPool("jokic", pool).map((p) => p.id)).toEqual([1]);
    expect(matchPool("ja", pool).map((p) => p.id)).toEqual([2, 4]);
    expect(matchPool("sga", pool).map((p) => p.id)).toEqual([3]);
    expect(matchPool("den", pool).map((p) => p.id)).toEqual([1, 2, 3, 4]);
    expect(matchPool("", pool)).toEqual([]);
  });

  test("the pool filter honours position and sort", () => {
    const pool = [row(1, "A", { position: "G-F" }), row(2, "B", { position: "C", gp: 30 }), row(3, "C", { position: "F" })];
    expect(hasPosition("G-F", "F")).toBe(true);
    expect(hasPosition("C", "G")).toBe(false);
    expect(hasPosition(null, "ALL")).toBe(true);
    expect(filterPool(pool, "", "F", "rank").map((p) => p.id)).toEqual([1, 3]);
    expect(filterPool(pool, "", "ALL", "gp").map((p) => p.id)).toEqual([2, 1, 3]);
    expect(filterPool(pool, "b", "ALL", "rank").map((p) => p.id)).toEqual([2]);
  });
});

describe("games", () => {
  test("clocks, tips and states", () => {
    expect(clockText("PT05M23.00S")).toBe("5:23");
    expect(clockText("PT00M09.40S")).toBe("0:09");
    expect(clockText(null)).toBe("");
    expect(tipText("19:30")).toBe("7:30 PM");
    expect(tipText("12:00")).toBe("12:00 PM");
    expect(gameStatusText("scheduled", null, null, "19:30")).toBe("7:30 PM ET");
    expect(gameStatusText("in_progress", 3, "PT05M23.00S", "19:30")).toBe("Q3 5:23");
    expect(gameStatusText("in_progress", 2, "PT00M00.00S", null)).toBe("Half");
    expect(gameStatusText("final", 4, null, null)).toBe("Final");
    expect(gameStatusText("final", 5, null, null)).toBe("Final/OT");
    expect(gameStatusText(2, 1, "PT11M00.00S", null)).toBe("Q1 11:00");
  });
});

describe("projection vs actual", () => {
  test("rates scale up from fractions and deltas follow the actual", () => {
    const rows = projectionRows(
      { min: 34, pts: 26.5, reb: 12, ast: 9, stl: 1.3, blk: 0.8, tov: 3.2, fg3m: 1.1, fg_pct: 0.575, ft_pct: 0.81, fgm: null, fga: null, fg3a: null, ftm: null, fta: null, fg3_pct: null },
      averageLine([log(0, { pts: 30, fgm: 10, fga: 20 })])
    );
    const pts = rows.find((r) => r.key === "pts")!;
    expect(pts.projected).toBe(26.5);
    expect(pts.actual).toBe(30);
    expect(pts.delta).toBe(3.5);
    const fg = rows.find((r) => r.key === "fg_pct")!;
    expect(fg.projected).toBe(57.5);
    expect(fg.actual).toBe(50);
    expect(fg.delta).toBe(-7.5);
  });
});

describe("names", () => {
  test("short names drop suffixes", () => {
    expect(shortName("Nikola Jokić")).toBe("N. Jokić");
    expect(shortName("Jaren Jackson Jr.")).toBe("J. Jackson");
    expect(shortName("Nenê")).toBe("Nenê");
  });
});
