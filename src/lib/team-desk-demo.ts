/**
 * The Team desk's demo (`/team?demo`): one real league's reads from Nov 27, 2026, with every
 * team renamed (the demo opens signed out). The fixture is kept compact; this builds the three
 * reads' shapes from it. Loaded only by the demo, so the live desk never ships it.
 */
import raw from "@/__fixtures__/team-desk-demo.json";
import type {
  LeagueProjectionData,
  LeagueValuesData,
  MatchupBenchmark,
  PlayerWindowValue,
  StreamingLineData,
  TeamProjection,
  TierBenchmark,
  ValueWindow,
  ValueWindowKey,
} from "@/types/team-desk";

type Num = number | null;

interface Fixture {
  teams: string[];
  proj: {
    today: string;
    slots: Record<string, number>;
    cur: number;
    rs: number;
    pm: number[];
    pt: number;
    iw: number[];
    tw: number;
    bench: LeagueProjectionData["benchmarks"];
    notes: string[];
    // id, standing, wins, losses, pf, pa, week, week rank, playoff week, its rank, wins projected, playoff odds, title odds, seeds, players
    teams: Array<[number, Num, number, number, Num, Num, Num, Num, Num, Num, Num, Num, Num, number[], number]>;
    // matchup, status, you, rank, median, low, high, line, best, worst, opponent id, opponent score, win chance, start, end, playoffs, incomplete
    m: Array<[number, string, Num, Num, Num, Num, Num, Num, Num, Num, Num, Num, Num, string, string, number, number]>;
  };
  // name, NBA team, positions, team id, slot, injury, per game
  players: Array<[string, string, string, number, string, string | null, number]>;
  // per window: its range, notes, and each player's [team games, games, value, started, window rank]
  windows: Array<{ w: ValueWindow; notes: string[]; p: Array<[number, number, number, number, number]> }>;
  lines: Record<
    string,
    {
      f: number;
      l: number;
      line: Num;
      low: Num;
      notes: string[];
      // matchup, start, end, days, adds, base, worth running, line, low, games, streamed, lanes
      m: Array<[number, string, string, number, number, number, number, Num, Num, number, string[], number]>;
      // name, per game, below the line, streamed in, worth, slot, protected, on IR, by matchup
      p: Array<[string, number, boolean | null, number[], number, string, number, number, number[]]>;
    }
  >;
}

const F = raw as unknown as Fixture;
const MINE = 1;
const LEAGUE = "The Sunday Run";

export const TEAM_DEMO_TEAM = { id: 1, name: F.teams[MINE - 1], tag: "ESPN · PTS" };

function teamName(id: Num): string | null {
  return id == null ? null : (F.teams[id - 1] ?? null);
}

function projections(): LeagueProjectionData {
  const p = F.proj;
  const status = { f: "final", c: "current", u: "upcoming" } as const;
  return {
    league_name: LEAGUE,
    format: "points",
    today: p.today,
    projection_as_of: p.today,
    teams_count: F.teams.length,
    playoff_teams: p.pt,
    seed_tiebreaker: "head_to_head",
    lineup_slots: p.slots,
    current_matchup: p.cur,
    regular_season_matchups: p.rs,
    playoff_matchups: p.pm,
    playoff_weeks: p.pm,
    incomplete_weeks: p.iw,
    typical_week: p.tw,
    simulations: 10_000,
    in_playoffs: false,
    benchmarks: p.bench,
    notes: p.notes,
    teams: p.teams.map(
      ([id, standing, wins, losses, pf, pa, week, weekRank, po, poRank, projWins, odds, title, seeds, projected]): TeamProjection => ({
        league_team_id: id,
        team_name: teamName(id) ?? "",
        mine: id === MINE,
        standing,
        wins,
        losses,
        ties: 0,
        points_for: pf,
        points_against: pa,
        regular_season_week: week,
        regular_season_rank: weekRank,
        playoff_week: po,
        playoff_rank: poRank,
        projected_wins: projWins,
        playoff_odds: odds,
        title_odds: title,
        seed_odds: seeds,
        players_projected: projected,
        players_unprojected: [],
      })
    ),
    matchups: p.m.map(
      ([matchup, st, you, rank, median, low, high, line, best, worst, opp, oppScore, win, start, end, playoffs, incomplete]): MatchupBenchmark => ({
        matchup,
        weeks: [matchup],
        start,
        end,
        status: status[st as keyof typeof status] ?? "upcoming",
        playoffs: playoffs === 1,
        schedule_incomplete: incomplete === 1,
        you,
        rank,
        median,
        low,
        high,
        line,
        best,
        worst,
        teams: F.teams.length,
        opponent: teamName(opp),
        opponent_league_team_id: opp,
        opponent_score: oppScore,
        win_chance: win,
        result: null,
      })
    ),
  };
}

/** Each roster's Nth best over the window against the league's (what the backend's tiers are). */
function tiers(players: PlayerWindowValue[]): TierBenchmark[] {
  const byTeam = new Map<number, number[]>();
  for (const p of players) {
    if (p.league_team_id == null) continue;
    byTeam.set(p.league_team_id, [...(byTeam.get(p.league_team_id) ?? []), p.value]);
  }
  for (const v of byTeam.values()) v.sort((a, b) => b - a);
  const mine = byTeam.get(MINE) ?? [];
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return mine.map((you, i) => {
    const all = [...byTeam.values()].map((v) => v[i]).filter((v): v is number => v != null);
    const sorted = [...all].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return {
      tier: i + 1,
      you,
      rank: 1 + all.filter((v) => v > you).length,
      average: r1(all.reduce((s, v) => s + v, 0) / all.length),
      median: r1(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2),
      best: sorted[sorted.length - 1],
      worst: sorted[0],
      teams: all.length,
    };
  });
}

function values(key: ValueWindowKey): LeagueValuesData {
  const win = F.windows.find((w) => w.w.key === key) ?? F.windows[F.windows.length - 1];
  const players: PlayerWindowValue[] = F.players.map(([name, nbaTeam, positions, teamId, slot, injury, perGame], i) => {
    const [teamGames, games, value, started, rank] = win.p[i];
    return {
      name,
      player_id: null,
      espn_id: i + 1,
      nba_team: nbaTeam,
      positions: positions.split("/"),
      league_team_id: teamId,
      team_name: teamName(teamId),
      mine: teamId === MINE,
      slot,
      availability: null,
      injury_status: injury,
      per_game: perGame,
      team_games: teamGames,
      games,
      value,
      started,
      window_rank: rank,
      season_games: games,
      season_value: value,
      season_rank: rank,
      projected: true,
    };
  });
  return {
    league_name: LEAGUE,
    format: "points",
    today: F.proj.today,
    projection_as_of: F.proj.today,
    current_matchup: F.proj.cur,
    regular_season_matchups: F.proj.rs,
    final_matchup: F.proj.pm[F.proj.pm.length - 1] ?? F.proj.rs,
    season_end: "2027-04-04",
    window: win.w,
    players: [...players].sort((a, b) => a.window_rank - b.window_rank),
    free_agents_read: 150,
    ranked_players: 260,
    tiers: tiers(players),
    notes: win.notes,
  };
}

function line(key: ValueWindowKey): StreamingLineData | null {
  const l = F.lines[key];
  if (!l) return null;
  const byName = new Map(F.players.map(([name, nbaTeam, positions, , , injury], i) => [name, { nbaTeam, positions, injury, id: i + 1 }]));
  return {
    league_name: LEAGUE,
    today: F.proj.today,
    projection_as_of: F.proj.today,
    current_matchup: F.proj.cur,
    key,
    first_matchup: l.f,
    last_matchup: l.l,
    line: l.line,
    line_low: l.low,
    free_agents_read: 150,
    notes: l.notes,
    matchups: l.m.map(([matchup, start, end, days, adds, base, worth, mLine, mLow, games, streamed, lanes]) => ({
      matchup,
      start,
      end,
      days,
      adds,
      playoffs: matchup > F.proj.rs,
      base,
      lanes: Array.from({ length: lanes }, (_, i) => ({ lane: i + 1, holder: "", holder_espn_id: 0, adds: 0, total: 0, gain: 0 })),
      worth_running: worth,
      line: mLine,
      line_low: mLow,
      games,
      streamed: streamed.map((name) => ({ name, espn_id: byName.get(name)?.id ?? 0 })),
      proven: true,
    })),
    players: l.p.map(([name, perGame, below, streamedIn, worth, slot, prot, ir, byMatchup]) => {
      const p = byName.get(name);
      return {
        name,
        player_id: null,
        espn_id: p?.id ?? 0,
        nba_team: p?.nbaTeam ?? null,
        positions: p?.positions.split("/") ?? [],
        injury_status: p?.injury ?? null,
        slot,
        on_ir: ir === 1,
        protected: prot === 1,
        per_game: perGame,
        below_line: below,
        streamed_in: streamedIn,
        worth,
        by_matchup: byMatchup,
      };
    }),
  };
}

export const TEAM_DEMO = {
  projections: projections(),
  values,
  line,
};

export type TeamDemo = typeof TEAM_DEMO;
