import { describe, expect, test } from "bun:test";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PlayerSheet, type PlayerSheetProps } from "@/components/scout/PlayerSheet";
import { playerKeys, playerStatsQuery } from "@/hooks/usePlayer";
import { flipNeighbours, flipTarget, sheetIdentity, type Focus } from "@/lib/scout";
import type { AvgStats, PlayerStats } from "@/types/player";
import type { RankingsPlayer } from "@/types/rankings";

const ID = 203999;

const poolRow: RankingsPlayer = {
  id: ID,
  player_name: "Nikola Jokić",
  team: "DEN",
  position: "C",
  rank: 1,
  rank_change: 2,
  avg_fpts: 60,
  total_fpts: 4000,
  gp: 70,
  categories: null,
  category_z: null,
  score: null,
};

const noop = () => {};
const sheet: PlayerSheetProps = {
  id: ID,
  window: "season",
  setWindow: noop,
  poolRow: undefined,
  categories: [],
  today: "2026-10-13",
  open: noop,
  pinned: false,
  togglePin: noop,
  canCompare: false,
  onCompare: noop,
  live: undefined,
  flip: false,
  known: undefined,
  onIdentity: noop,
};

/** A query key as a short name: the block it feeds, and what it was asked by. */
function label(key: readonly unknown[]): string {
  if (key[0] === "market") return `market by "${key[3]}"`;
  if (key[0] === "teams") return `schedule of ${key[2]}`;
  return String(key[1]);
}

/**
 * The sheet's first render, as the server would render it: every query its
 * hooks build lands in the cache with the `enabled` its hook passed, and
 * nothing fetches. So this reads which requests a sheet starts the moment it
 * mounts, and which it holds back.
 */
function firstRender(over: Partial<PlayerSheetProps>, client = new QueryClient()) {
  const html = renderToString(h(QueryClientProvider, { client }, h(PlayerSheet, { ...sheet, ...over })));
  const queries = client.getQueryCache().getAll();
  const on = (q: (typeof queries)[number]) => (q.options as { enabled?: unknown }).enabled !== false;
  return {
    html,
    asked: queries.filter(on).map((q) => label(q.queryKey)).sort(),
    held: queries.filter((q) => !on(q)).map((q) => label(q.queryKey)).sort(),
  };
}

const FOUR = ["ownership", "percentiles", "stats", "status"];
const EXTRAS = ["profile", "projection", "trends"];

describe("a player sheet's first requests", () => {
  test("a click asks for all nine at once: the market by the pool row's name, the schedule by its team", () => {
    const { asked, held } = firstRender({ poolRow });
    expect(asked).toEqual([...FOUR, ...EXTRAS, 'market by "Nikola Jokić"', "schedule of DEN"].sort());
    expect(held).toEqual([]);
  });

  test("an arrow-key flip asks for four and holds the other five until the sheet rests", () => {
    const { asked, held } = firstRender({ poolRow, flip: true });
    expect(asked).toEqual(FOUR);
    expect(held).toEqual([...EXTRAS, 'market by "Nikola Jokić"', "schedule of null"].sort());
  });

  test("a link that lands before the pool asks for seven; the market and the schedule wait for a name and a team", () => {
    const { asked, held } = firstRender({});
    expect(asked).toEqual([...FOUR, ...EXTRAS].sort());
    expect(held).toEqual(['market by ""', "schedule of null"]);
  });

  test("a name and team from an earlier visit seed the sheet as a pool row does", () => {
    const { asked } = firstRender({ known: { name: "Nikola Jokić", team: "DEN" } });
    expect(asked).toEqual([...FOUR, ...EXTRAS, 'market by "Nikola Jokić"', "schedule of DEN"].sort());
  });

  test("an earlier visit that left before stats named his team doesn't hide the pool row's", () => {
    const { asked } = firstRender({ poolRow, known: { name: "Nikola Jokić", team: null } });
    expect(asked).toContain("schedule of DEN");
  });
});

describe("a player sheet while stats load", () => {
  test("with a pool row the header shows at once, the numbers under it still loading", () => {
    const { html } = firstRender({ poolRow });
    expect(html).toContain("<header");
    expect(html).toContain("Nikola Jokić");
    expect(html).toContain("Denver Nuggets");
    expect(html).toContain("aria-busy");
    expect(html).not.toContain("No box scores");
  });

  test("with nothing to name him by, the whole sheet is a skeleton", () => {
    const { html } = firstRender({});
    expect(html).not.toContain("<header");
    expect(html).not.toContain("Unknown player");
    expect(html).toContain("aria-busy");
  });
});

function avg(fpts: number): AvgStats {
  const zero = { avg_points: 0, avg_rebounds: 0, avg_assists: 0, avg_steals: 0, avg_blocks: 0, avg_turnovers: 0, avg_minutes: 0, avg_fg_pct: 0, avg_fg3_pct: 0, avg_ft_pct: 0, avg_ts_pct: 0, avg_efg_pct: 0, avg_three_rate: 0, avg_ft_rate: 0, avg_fgm: 0, avg_fga: 0, avg_fg3m: 0, avg_fg3a: 0, avg_ftm: 0, avg_fta: 0 };
  return { ...zero, avg_fpts: fpts };
}

function statsOf(id: number, name: string, team: string): PlayerStats {
  return { id, name, team, games_played: 70, window: "season", window_games: 70, avg_stats: avg(61.25), advanced_stats: null, game_logs: [] };
}

describe("flipping through the pool", () => {
  const rows: Focus[] = [
    { kind: "overview", lens: "pool" },
    { kind: "player", id: 1 },
    { kind: "player", id: 2 },
    { kind: "player", id: 3 },
  ];

  test("a flip opens the row next to the open player, or next to the cursor when he isn't listed", () => {
    expect(flipTarget(rows, { kind: "player", id: 2 }, 0, 1)).toEqual({ row: 3, opens: true });
    expect(flipTarget(rows, { kind: "player", id: 2 }, 0, -1)).toEqual({ row: 1, opens: true });
    expect(flipTarget(rows, { kind: "player", id: 9 }, 1, 1)).toEqual({ row: 2, opens: true });
    expect(flipTarget(rows, null, 0, -1)).toEqual({ row: 0, opens: true });
  });

  test("at either end the flip stays put and opens nothing, so the open sheet keeps its extras", () => {
    expect(flipTarget(rows, { kind: "player", id: 3 }, 0, 1)).toEqual({ row: 3, opens: false });
    expect(flipTarget(rows, { kind: "overview", lens: "pool" }, 2, -1)).toEqual({ row: 0, opens: false });
    expect(flipTarget([{ kind: "player", id: 1 }], { kind: "player", id: 1 }, 0, 1)).toEqual({ row: 0, opens: false });
  });

  test("an empty list has nowhere to flip", () => {
    expect(flipTarget([], { kind: "player", id: 1 }, 0, 1)).toBeNull();
  });

  test("the rows either side of a flip are the next flips' players", () => {
    expect(flipNeighbours(rows, 2)).toEqual([3, 1]);
    expect(flipNeighbours(rows, 3)).toEqual([2]);
  });

  test("an overview or a team row next door is not a player to ask for", () => {
    expect(flipNeighbours(rows, 1)).toEqual([2]);
    expect(flipNeighbours([{ kind: "team", abbrev: "DEN" }, { kind: "player", id: 1 }, { kind: "team", abbrev: "BOS" }], 1)).toEqual([]);
  });

  test("a prefetch fills the cache entry the flipped-to sheet reads, so it opens on its numbers", () => {
    expect([...playerStatsQuery(2, "nba", "l10").queryKey]).toEqual([...playerKeys.stats(2, "nba", "l10")]);
    const client = new QueryClient();
    client.setQueryData(playerStatsQuery(ID, "nba", "season").queryKey, statsOf(ID, "Nikola Jokic", "DEN"));
    const { html } = firstRender({ poolRow, flip: true }, client);
    expect(html).toContain("Per game");
    expect(html).toContain("70 GP");
    expect(html).toContain("61.3");
  });
});

describe("whom a sheet names", () => {
  const pool = { name: "Bobby Portis", team: "MIL" };

  test("stats win once they land", () => {
    expect(sheetIdentity({ stats: { name: "Bobby Portis Jr.", team: "MIL" }, profile: null, seed: pool, statsPending: false })).toEqual({ name: "Bobby Portis Jr.", team: "MIL" });
  });

  test("until then the seed stands in, for the header and for the market and schedule requests", () => {
    expect(sheetIdentity({ stats: null, profile: null, seed: pool, statsPending: true })).toEqual(pool);
  });

  test("the profile's team waits for stats: before a season it is often a team stats and the pool don't have yet", () => {
    const profile = { name: "Bobby Portis Jr.", team: "CHI" };
    expect(sheetIdentity({ stats: null, profile, seed: null, statsPending: true })).toEqual({ name: "Bobby Portis Jr.", team: null });
    expect(sheetIdentity({ stats: { name: "Bobby Portis Jr.", team: "MIL" }, profile, seed: null, statsPending: false }).team).toBe("MIL");
  });

  test("a player with no games goes by his profile once stats has answered without him", () => {
    expect(sheetIdentity({ stats: null, profile: { name: "A Rookie", team: "SAS" }, seed: null, statsPending: false })).toEqual({ name: "A Rookie", team: "SAS" });
  });

  test("a pool row's empty team is no team", () => {
    expect(sheetIdentity({ stats: null, profile: { name: "X", team: "SAS" }, seed: { name: "X", team: "" }, statsPending: false }).team).toBe("SAS");
  });
});
