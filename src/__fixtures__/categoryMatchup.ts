/**
 * Dev-only fixture: a plausible ESPN H2H 9-cat matchup mid-week, used by
 * `/matchup?mock=cats` (non-production builds only) to render the category
 * surfaces before a real category league is connected.
 */

import { DEFAULT_9CAT, winnerFromValues } from "@/lib/category-format";
import type {
  CategoryComparison,
  CategoryTeamScore,
  LiveMatchupData,
  LiveMatchupPlayer,
  MatchupData,
  MatchupPlayer,
} from "@/types/matchup";

function rates(raw: Record<string, number>): Record<string, number> {
  return {
    ...raw,
    fg_pct: raw.fga > 0 ? raw.fgm / raw.fga : 0,
    ft_pct: raw.fta > 0 ? raw.ftm / raw.fta : 0,
  };
}

function compare(you: Record<string, number>, opp: Record<string, number>): CategoryComparison {
  const items = DEFAULT_9CAT.map((d) => ({
    key: d.key,
    label: d.label,
    you: you[d.key] ?? 0,
    opp: opp[d.key] ?? 0,
    winner: winnerFromValues(you[d.key], opp[d.key], d.higher_is_better),
    higher_is_better: d.higher_is_better,
    is_rate: d.is_rate,
  }));
  return {
    items,
    wins: items.filter((i) => i.winner === "you").length,
    losses: items.filter((i) => i.winner === "opp").length,
    ties: items.filter((i) => i.winner === "tie").length,
  };
}

function teamScore(raw: Record<string, number>, cmp: CategoryComparison, invert: boolean, live: boolean): CategoryTeamScore {
  return {
    totals: rates(raw),
    raw,
    wins: invert ? cmp.losses : cmp.wins,
    losses: invert ? cmp.wins : cmp.losses,
    ties: cmp.ties,
    live_adjusted: live,
  };
}

const YOUR_RAW = { pts: 612, reb: 244, ast: 151, stl: 38, blk: 27, tov: 71, fg3m: 68, fgm: 231, fga: 468, ftm: 82, fta: 101 };
const OPP_RAW = { pts: 598, reb: 262, ast: 139, stl: 44, blk: 21, tov: 63, fg3m: 68, fgm: 228, fga: 492, ftm: 74, fta: 96 };
const YOUR_PROJ = { pts: 1180, reb: 470, ast: 300, stl: 74, blk: 52, tov: 138, fg3m: 131, fgm: 445, fga: 905, ftm: 160, fta: 196 };
const OPP_PROJ = { pts: 1145, reb: 505, ast: 268, stl: 85, blk: 40, tov: 122, fg3m: 129, fgm: 436, fga: 940, ftm: 142, fta: 184 };

const yourTotals = rates(YOUR_RAW);
const oppTotals = rates(OPP_RAW);
const comparison = compare(yourTotals, oppTotals);
const projectedComparison = compare(rates(YOUR_PROJ), rates(OPP_PROJ));

const player = (
  id: number,
  name: string,
  team: string,
  position: string,
  slot: string,
  avg: number,
  extra: Partial<MatchupPlayer> = {}
): MatchupPlayer => ({
  player_id: id,
  // Fixtures use ESPN-shaped ids; nothing here exercises NBA-id navigation.
  nba_player_id: null,
  name,
  team,
  position,
  lineup_slot: slot,
  avg_points: avg,
  projected_points: avg * 3,
  games_remaining: 3,
  injured: false,
  injury_status: null,
  ...extra,
});

const YOUR_ROSTER: MatchupPlayer[] = [
  player(3112335, "Nikola Jokić", "DEN", "C", "C", 66.3),
  player(4066648, "Tyrese Haliburton", "IND", "PG", "PG", 44.1),
  player(4395628, "Jalen Williams", "OKC", "SF", "SF", 38.2),
  player(4432816, "Evan Mobley", "CLE", "PF", "PF", 37.9),
  player(4432173, "Desmond Bane", "MEM", "SG", "SG", 34.4),
  player(4278073, "Josh Hart", "NYK", "G", "G", 31.0),
  player(4397189, "Chet Holmgren", "OKC", "F", "F", 36.2, { injured: true, injury_status: "DTD" }),
  player(4066261, "Malik Monk", "SAC", "SG", "BE", 27.5),
];

const OPP_ROSTER: MatchupPlayer[] = [
  player(3945274, "Luka Dončić", "LAL", "PG", "PG", 62.7),
  player(4278104, "Alperen Şengün", "HOU", "C", "C", 44.6),
  player(3934672, "Jaylen Brown", "BOS", "SG", "SG", 38.0),
  player(4431678, "Scottie Barnes", "TOR", "SF", "SF", 37.1),
  player(4277956, "Jarrett Allen", "CLE", "PF", "PF", 34.9),
  player(3908809, "Derrick White", "BOS", "G", "G", 33.3),
  player(4397424, "Paolo Banchero", "ORL", "F", "F", 40.5),
  player(4066636, "Immanuel Quickley", "TOR", "PG", "BE", 27.9),
];

export const MOCK_CATEGORY_MATCHUP: MatchupData = {
  matchup_period: 12,
  matchup_period_start: "2026-01-05",
  matchup_period_end: "2026-01-11",
  schedule_week: 12,
  scoring_period_id: null,
  scoring_period_source: "unknown",
  your_team: {
    team_name: "Nuggets of Wisdom",
    team_id: 3,
    current_score: comparison.wins,
    projected_score: projectedComparison.wins,
    roster: YOUR_ROSTER,
    categories: teamScore(YOUR_RAW, comparison, false, false),
  },
  opponent_team: {
    team_name: "Luka Magic",
    team_id: 7,
    current_score: comparison.losses,
    projected_score: projectedComparison.losses,
    roster: OPP_ROSTER,
    categories: teamScore(OPP_RAW, comparison, true, false),
  },
  projected_winner: projectedComparison.wins >= projectedComparison.losses ? "Nuggets of Wisdom" : "Luka Magic",
  projected_margin: projectedComparison.wins - projectedComparison.losses,
  scoring_format: "categories",
  settings_synced: true,
  category_comparison: comparison,
  projected_category_comparison: projectedComparison,
};

const liveFor = (
  p: MatchupPlayer,
  stats: Partial<LiveMatchupPlayer["live"]> | null
): LiveMatchupPlayer => ({
  ...p,
  live: stats
    ? {
        nba_player_id: p.player_id,
        live_fpts: 0,
        live_pts: 0,
        live_reb: 0,
        live_ast: 0,
        live_stl: 0,
        live_blk: 0,
        live_tov: 0,
        live_min: 0,
        live_fgm: 0,
        live_fga: 0,
        live_fg3m: 0,
        live_fg3a: 0,
        live_ftm: 0,
        live_fta: 0,
        game_status: 1,
        period: null,
        game_clock: null,
        last_updated: null,
        ...stats,
      }
    : null,
});

const LIVE_YOUR_RAW = { ...YOUR_RAW, pts: YOUR_RAW.pts + 41, reb: YOUR_RAW.reb + 19, ast: YOUR_RAW.ast + 13, tov: YOUR_RAW.tov + 4, fgm: YOUR_RAW.fgm + 16, fga: YOUR_RAW.fga + 29, fg3m: YOUR_RAW.fg3m + 3, ftm: YOUR_RAW.ftm + 6, fta: YOUR_RAW.fta + 7 };
const LIVE_OPP_RAW = { ...OPP_RAW, pts: OPP_RAW.pts + 27, reb: OPP_RAW.reb + 9, ast: OPP_RAW.ast + 8, stl: OPP_RAW.stl + 2, tov: OPP_RAW.tov + 3, fgm: OPP_RAW.fgm + 10, fga: OPP_RAW.fga + 22, fg3m: OPP_RAW.fg3m + 4, ftm: OPP_RAW.ftm + 3, fta: OPP_RAW.fta + 4 };
const liveComparison = compare(rates(LIVE_YOUR_RAW), rates(LIVE_OPP_RAW));

export const MOCK_CATEGORY_LIVE_MATCHUP: LiveMatchupData = {
  matchup_period: 12,
  matchup_period_start: "2026-01-05",
  matchup_period_end: "2026-01-11",
  game_date: "2026-01-08",
  baseline_stale_days: 0,
  your_team: {
    team_name: "Nuggets of Wisdom",
    team_id: 3,
    current_score: liveComparison.wins,
    projected_score: projectedComparison.wins,
    roster: [
      liveFor(YOUR_ROSTER[0], { game_status: 2, period: 3, game_clock: "PT05M12.00S", live_min: 27, live_pts: 24, live_reb: 12, live_ast: 9, live_stl: 1, live_blk: 1, live_tov: 3, live_fgm: 10, live_fga: 16, live_fg3m: 1, live_fg3a: 3, live_ftm: 3, live_fta: 4, live_fpts: 58.5 }),
      liveFor(YOUR_ROSTER[1], { game_status: 3, live_min: 34, live_pts: 17, live_reb: 7, live_ast: 4, live_stl: 0, live_blk: 0, live_tov: 1, live_fgm: 6, live_fga: 13, live_fg3m: 2, live_fg3a: 6, live_ftm: 3, live_fta: 3, live_fpts: 33.0 }),
      liveFor(YOUR_ROSTER[2], null),
      liveFor(YOUR_ROSTER[3], { game_status: 1 }),
      liveFor(YOUR_ROSTER[4], null),
      liveFor(YOUR_ROSTER[5], null),
      liveFor(YOUR_ROSTER[6], null),
      liveFor(YOUR_ROSTER[7], null),
    ],
    categories: teamScore(LIVE_YOUR_RAW, liveComparison, false, true),
  },
  opponent_team: {
    team_name: "Luka Magic",
    team_id: 7,
    current_score: liveComparison.losses,
    projected_score: projectedComparison.losses,
    roster: [
      liveFor(OPP_ROSTER[0], { game_status: 2, period: 2, game_clock: "PT02M40.00S", live_min: 18, live_pts: 15, live_reb: 5, live_ast: 6, live_stl: 2, live_blk: 0, live_tov: 2, live_fgm: 5, live_fga: 12, live_fg3m: 2, live_fg3a: 6, live_ftm: 3, live_fta: 4, live_fpts: 34.5 }),
      liveFor(OPP_ROSTER[1], { game_status: 3, live_min: 31, live_pts: 12, live_reb: 4, live_ast: 2, live_stl: 0, live_blk: 0, live_tov: 1, live_fgm: 5, live_fga: 10, live_fg3m: 2, live_fg3a: 3, live_ftm: 0, live_fta: 0, live_fpts: 20.5 }),
      ...OPP_ROSTER.slice(2).map((p) => liveFor(p, null)),
    ],
    categories: teamScore(LIVE_OPP_RAW, liveComparison, true, true),
  },
  projected_winner: MOCK_CATEGORY_MATCHUP.projected_winner,
  projected_margin: MOCK_CATEGORY_MATCHUP.projected_margin,
  scoring_format: "categories",
  settings_synced: true,
  category_comparison: liveComparison,
};
