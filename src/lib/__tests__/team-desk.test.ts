import { describe, expect, test } from "bun:test";
import {
  chartRange,
  clearsLine,
  dayRange,
  groupShares,
  lineWindow,
  pct,
  pts,
  rankTone,
  rosterSums,
  signedPts,
  spread,
  startersOf,
  teamTracks,
  tierEdge,
  tierRows,
  trackPos,
  weekBars,
  windowFromParam,
} from "@/lib/team-desk";
import { TEAM_DEMO } from "@/lib/team-desk-demo";
import type { LeagueValuesData, PlayerWindowValue } from "@/types/team-desk";

function player(p: Partial<PlayerWindowValue> & { name: string; league_team_id: number | null }): PlayerWindowValue {
  return {
    player_id: null,
    espn_id: null,
    nba_team: null,
    positions: ["PG"],
    team_name: null,
    mine: false,
    slot: null,
    availability: null,
    injury_status: null,
    per_game: 30,
    team_games: 4,
    games: 4,
    value: 120,
    started: 120,
    window_rank: 1,
    season_games: 4,
    season_value: 120,
    season_rank: 1,
    projected: true,
    ...p,
  };
}

describe("the window", () => {
  test("a bad or missing ?w= opens the rest of the season", () => {
    expect(windowFromParam("next_4")).toBe("next_4");
    expect(windowFromParam("nope")).toBe("rest_of_season");
    expect(windowFromParam(null)).toBe("rest_of_season");
  });

  test("the line reads four matchups at most", () => {
    expect(lineWindow("this_week", 3)).toBe("this_week");
    expect(lineWindow("next_4", 3)).toBe("next_4");
    expect(lineWindow("playoffs", 3)).toBe("playoffs");
    expect(lineWindow("playoffs", null)).toBe("playoffs");
    expect(lineWindow("playoffs", 5)).toBe("next_4");
    expect(lineWindow("to_playoffs", 3)).toBe("next_4");
    expect(lineWindow("rest_of_season", 3)).toBe("next_4");
  });
});

describe("numbers", () => {
  test("points: whole above a thousand, a tenth below, a real minus", () => {
    expect(pts(1520.9)).toBe("1,521");
    expect(pts(350.1)).toBe("350.1");
    expect(pts(-11.74)).toBe("−11.7");
    expect(pts(null)).toBe("–");
    expect(signedPts(19.6)).toBe("+19.6");
    expect(signedPts(-1204.4)).toBe("−1,204");
    expect(signedPts(0.01)).toBe("0.0");
  });

  test("odds stay honest at the ends", () => {
    expect(pct(0.988)).toBe("99%");
    expect(pct(0.9991)).toBe(">99%");
    expect(pct(0.003)).toBe("<1%");
    expect(pct(0)).toBe("0%");
    expect(pct(1)).toBe("100%");
  });

  test("date ranges", () => {
    expect(dayRange("2026-11-27", "2026-11-29")).toBe("Nov 27–29");
    expect(dayRange("2026-11-27", "2026-12-20")).toBe("Nov 27 – Dec 20");
    expect(dayRange("2026-11-27", "2026-11-27")).toBe("Nov 27");
  });
});

describe("spread", () => {
  test("median, playoff line, best, worst and rank among every team", () => {
    const sp = spread(30, [10, 20, 30, 40, 50, 60], 4);
    expect(sp).toEqual({ you: 30, median: 35, line: 30, best: 60, worst: 10, rank: 4, teams: 6 });
  });

  test("fewer is better runs the other way", () => {
    const sp = spread(20, [10, 20, 30], 2, false);
    expect(sp.best).toBe(10);
    expect(sp.worst).toBe(30);
    expect(sp.line).toBe(20);
    expect(sp.rank).toBe(2);
  });

  test("a tie shares the better rank", () => {
    expect(spread(20, [20, 20, 10], 2).rank).toBe(1);
  });

  test("a rank's tone: top and bottom quarter", () => {
    expect(rankTone(2, 8)).toBe("up");
    expect(rankTone(3, 8)).toBe("flat");
    expect(rankTone(7, 8)).toBe("down");
  });

  test("the track runs worst to best", () => {
    expect(trackPos(30, { worst: 10, best: 50 })).toBe(50);
    expect(trackPos(20, { worst: 30, best: 10 })).toBe(50);
    expect(trackPos(99, { worst: 10, best: 50 })).toBe(100);
    expect(trackPos(5, { worst: 5, best: 5 })).toBe(50);
  });
});

describe("where your points come from", () => {
  test("a player eligible at two groups counts half to each", () => {
    expect(groupShares(["PG", "SG"])).toEqual({ G: 1 });
    expect(groupShares(["PF", "C"])).toEqual({ F: 0.5, C: 0.5 });
    expect(groupShares(["UT"])).toEqual({});
  });

  test("a roster's sums: lineup, groups, bench, depth past the starters, games missed", () => {
    const sums = rosterSums(
      [
        player({ name: "a", league_team_id: 1, positions: ["PG"], value: 100, started: 100 }),
        player({ name: "b", league_team_id: 1, positions: ["PF", "C"], value: 80, started: 60 }),
        player({ name: "c", league_team_id: 1, positions: ["C"], value: 50, started: 0, per_game: 25, team_games: 4, games: 2 }),
        player({ name: "fa", league_team_id: null, value: 999, started: null }),
      ],
      2
    ).get(1)!;
    expect(sums.lineup).toBe(160);
    expect(sums.guards).toBe(100);
    expect(sums.forwards).toBe(30);
    expect(sums.centers).toBe(30);
    expect(sums.bench).toBe(70);
    expect(sums.depth).toBe(50);
    expect(sums.missed).toBe(50);
  });

  test("the lineup's seats leave out the bench and IR", () => {
    expect(startersOf({ PG: 1, SG: 1, SF: 1, PF: 1, C: 1, G: 1, F: 1, UT: 3, BE: 3, IR: 1 })).toBe(10);
    expect(startersOf(null)).toBe(10);
  });

  test("no tracks until your roster is in the read", () => {
    const values = { players: [player({ name: "x", league_team_id: 2 })] } as unknown as LeagueValuesData;
    expect(teamTracks(values, { starters: 10, playoffTeams: 4 })).toBeNull();
  });
});

describe("your roster by tier", () => {
  test("your Nth best player beside the league's Nth best", () => {
    const values = {
      players: [
        player({ name: "low", league_team_id: 1, mine: true, value: 50, window_rank: 9 }),
        player({ name: "high", league_team_id: 1, mine: true, value: 90, window_rank: 2 }),
      ],
      tiers: [
        { tier: 2, you: 50, rank: 3, average: 60, median: 60, best: 70, worst: 50, teams: 3 },
        { tier: 1, you: 90, rank: 1, average: 80, median: 80, best: 90, worst: 70, teams: 3 },
      ],
    } as unknown as LeagueValuesData;
    const rows = tierRows(values);
    expect(rows.map((r) => [r.tier, r.player?.name, r.diff])).toEqual([
      [1, "high", 10],
      [2, "low", -10],
    ]);
    const edge = tierEdge(rows, 2);
    expect(edge.total).toBe(0);
    expect(edge.ahead).toBe(1);
    expect(edge.best?.tier).toBe(1);
    expect(edge.worst?.tier).toBe(2);
  });
});

describe("the demo", () => {
  test("its tiers are what the backend sent that day (team tier 1 to 3 over the next 4)", () => {
    const tiers = TEAM_DEMO.values("next_4").tiers.slice(0, 3);
    expect(tiers.map((t) => [t.tier, t.you, t.rank])).toEqual([
      [1, 350.1, 8],
      [2, 309.8, 8],
      [3, 299.4, 6],
    ]);
    // Averaged from rounded values here and rounded again, so within a tenth of the backend's
    [433.7, 341.4, 313].forEach((avg, i) => expect(Math.abs(tiers[i].average! - avg)).toBeLessThanOrEqual(0.1 + 1e-9));
  });

  test("the week-by-week bars: scored, now, undercounted, playoffs", () => {
    const bars = weekBars(TEAM_DEMO.projections);
    expect(bars).toHaveLength(23);
    expect(bars[0].result).toBe("L");
    expect(bars[2].result).toBe("W");
    expect(bars[5].status).toBe("current");
    expect(bars[6].incomplete).toBe(true);
    expect(clearsLine(bars[6])).toBe(false);
    expect(bars[22].playoffs).toBe(true);
    expect(clearsLine(bars[22])).toBe(true);
    const r = chartRange(bars);
    expect(r.lo).toBeLessThanOrEqual(-183);
    expect(r.hi).toBeGreaterThanOrEqual(244);
  });

  test("the tracks: your lineup over the next four is about what the projections add up to", () => {
    const tracks = teamTracks(TEAM_DEMO.values("next_4"), { starters: 10, playoffTeams: 6 })!;
    const lineup = tracks.find((t) => t.id === "lineup")!;
    expect(lineup.teams).toBe(8);
    expect(Math.round(lineup.you)).toBe(3456);
    const g = tracks.find((t) => t.id === "guards")!.you;
    const f = tracks.find((t) => t.id === "forwards")!.you;
    const c = tracks.find((t) => t.id === "centers")!.you;
    expect(g + f + c).toBeCloseTo(lineup.you, 6);
  });

  test("the streaming line it carries", () => {
    expect(TEAM_DEMO.line("next_4")?.line).toBe(29);
    expect(TEAM_DEMO.line("rest_of_season")).toBeNull();
  });

  test("no real team or league names", () => {
    const names = [TEAM_DEMO.projections.league_name, ...TEAM_DEMO.projections.teams.map((t) => t.team_name)];
    expect(names).toEqual(["The Sunday Run", "Hack-a-Team", "Splash Dept.", "Paint Beasts", "Full Court Press", "Backdoor Cuts", "Iso Lab", "And-One Club", "Glass Cleaners"]);
  });
});
