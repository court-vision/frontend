/**
 * The Week desk's API answers, shaped field for field like the backend's
 * (`schemas/matchup.py`, `schemas/lineup_editor.py`): one ESPN points team,
 * one ESPN categories team and one Yahoo team, on Wednesday 2026-10-28 of the
 * second matchup period (Monday and Tuesday played, Thursday to Sunday ahead).
 *
 * Every player, team and score here is sample data.
 */
import type { LineupPlayer, LineupState } from "../../types/lineup-editor";
import type {
  CategoryComparison,
  DailyMatchupFuturePlayer,
  DailyMatchupPlayerStats,
  LiveMatchupData,
  LiveMatchupPlayer,
  MatchupData,
  MatchupPlayer,
  PlayerLiveStats,
  WeeklyMatchupData,
} from "../../types/matchup";

export const DATES = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const TODAY = 2;
export const PERIOD = 2;

/** One rostered player: who he is, where he sits today, and his NBA team's tip each day (null: no game). */
export interface Spec {
  id: number;
  nbaId: number | null;
  name: string;
  team: string;
  position: string;
  slot: string;
  slotId: number;
  eligible: number[];
  avg: number;
  injury?: string | null;
  tips: Array<string | null>;
}

export const MINE: Spec[] = [
  { id: 3112335, nbaId: 203999, name: "Nikola Jokic", team: "DEN", position: "C", slot: "C", slotId: 4, eligible: [4, 11, 12], avg: 61.4, tips: ["21:00", null, "19:00", null, "21:00", "21:00", null] },
  { id: 4278073, nbaId: 1630169, name: "Tyrese Haliburton", team: "IND", position: "PG", slot: "PG", slotId: 0, eligible: [0, 5, 11, 12], avg: 44.1, tips: [null, "19:00", "19:30", null, "19:00", null, "18:00"] },
  { id: 4065648, nbaId: 1628983, name: "Shai Gilgeous-Alexander", team: "OKC", position: "SG", slot: "SG", slotId: 1, eligible: [0, 1, 5, 11, 12], avg: 52.7, tips: ["20:00", null, "20:30", null, null, "22:00", "19:00"] },
  { id: 4432816, nbaId: 1631094, name: "Paolo Banchero", team: "ORL", position: "PF", slot: "UT", slotId: 11, eligible: [3, 6, 11, 12], avg: 40.3, tips: [null, "19:00", null, "19:30", "21:00", null, null] },
  { id: 4683021, nbaId: 1641705, name: "Victor Wembanyama", team: "SAS", position: "C", slot: "BE", slotId: 12, eligible: [3, 4, 6, 11, 12], avg: 55.8, tips: ["20:00", null, "20:30", null, "20:00", null, null] },
  { id: 4397020, nbaId: 1630578, name: "Alperen Sengun", team: "HOU", position: "C", slot: "IR", slotId: 13, eligible: [4, 11, 12, 13], avg: 43.0, injury: "OUT", tips: [null, "20:00", "19:00", null, "20:00", null, "21:00"] },
];

export const THEIRS: Spec[] = [
  { id: 3934672, nbaId: 1628369, name: "Jayson Tatum", team: "BOS", position: "SF", slot: "SF", slotId: 2, eligible: [2, 3, 6, 11, 12], avg: 47.9, injury: "OUT", tips: [null, "19:30", null, "22:00", null, "20:30", "21:30"] },
  { id: 4594268, nbaId: 1641706, name: "Brandon Miller", team: "CHA", position: "SF", slot: "UT", slotId: 11, eligible: [1, 2, 6, 11, 12], avg: 33.2, tips: ["19:00", null, "22:30", null, "19:00", "19:30", null] },
  { id: 4066457, nbaId: 1629627, name: "Zion Williamson", team: "NOP", position: "PF", slot: "BE", slotId: 12, eligible: [3, 6, 11, 12], avg: 38.6, tips: [null, "20:00", "21:00", null, "20:00", null, "19:00"] },
];

const SLOT_DEFS = [
  { slot_id: 0, slot: "PG", count: 1 }, { slot_id: 1, slot: "SG", count: 1 }, { slot_id: 2, slot: "SF", count: 1 },
  { slot_id: 3, slot: "PF", count: 1 }, { slot_id: 4, slot: "C", count: 1 }, { slot_id: 5, slot: "G", count: 1 },
  { slot_id: 6, slot: "F", count: 1 }, { slot_id: 11, slot: "UT", count: 3 }, { slot_id: 12, slot: "BE", count: 3 },
  { slot_id: 13, slot: "IR", count: 1 },
];

function lineupPlayer(s: Spec, day: number, now: string | null): LineupPlayer {
  const tip = s.tips[day];
  const started = tip != null && now != null && tip <= now;
  return {
    player_id: s.id,
    nba_player_id: s.nbaId,
    name: s.name,
    team: s.team,
    lineup_slot_id: s.slotId,
    lineup_slot: s.slot,
    eligible_slot_ids: s.eligible,
    eligible_slots: s.eligible.map((id) => SLOT_DEFS.find((d) => d.slot_id === id)!.slot),
    injured: s.injury === "OUT",
    injury_status: s.injury ?? null,
    default_position_id: null,
    lineup_locked: false,
    has_game_today: tip != null,
    opponent: tip != null ? "@ LAL" : null,
    game_time_et: tip,
    game_started: started,
    locked: started,
    playable: tip != null && s.injury !== "OUT",
    avg_points: s.avg,
    value_kind: "fpts",
    value_source: "rolling",
  };
}

/**
 * Today's ESPN board (or `day`'s). `now` is the ET wall time it was read at
 * ("19:45"), which decides who has locked; `first` the slate's first tip.
 */
export function espnBoard(day: number = TODAY, opts: { now?: string | null; first?: string | null; canWrite?: boolean; roster?: Spec[] } = {}): LineupState {
  const roster = opts.roster ?? MINE;
  return {
    provider: "espn",
    team_name: "Sample Points Team",
    espn_team_id: 3,
    nba_date: DATES[day],
    scoring_period_id: 7 + day,
    current_scoring_period_id: 7 + TODAY,
    final_scoring_period_id: 167,
    scoring_period_source: "provider",
    first_game_time_et: opts.first === undefined ? "19:00" : opts.first,
    slot_counts: Object.fromEntries(SLOT_DEFS.map((d) => [String(d.slot_id), d.count])),
    position_limits: {},
    slots: SLOT_DEFS,
    lock_type: "INDIVIDUAL_GAME",
    players: roster.map((s) => lineupPlayer(s, day, opts.now ?? null)),
    can_write: opts.canWrite ?? true,
    write_blocked_reason: opts.canWrite === false ? "no_credentials" : null,
    roster_version: "v-1",
    fetched_at: `${DATES[day]}T15:00:00-04:00`,
    acquisitions: null,
  };
}

export function matchupPlayer(s: Spec): MatchupPlayer {
  return {
    player_id: s.id,
    nba_player_id: s.nbaId,
    name: s.name,
    team: s.team,
    position: s.position,
    lineup_slot: s.slot,
    avg_points: s.avg,
    projected_points: Math.round(s.avg * s.tips.slice(TODAY).filter(Boolean).length * 100) / 100,
    games_remaining: s.tips.slice(TODAY).filter(Boolean).length,
    injured: s.injury === "OUT",
    injury_status: s.injury ?? null,
  };
}

/** A box score in progress (status 2), final (3) or not started (1). */
export function liveStats(nbaId: number, status: number, fpts: number): PlayerLiveStats {
  return {
    nba_player_id: nbaId,
    game_status: status,
    period: status === 2 ? 3 : status === 3 ? 4 : null,
    game_clock: status === 2 ? "PT05M12.00S" : null,
    last_updated: "2026-10-28T23:40:00Z",
    live_fpts: fpts,
    live_pts: Math.round(fpts / 2),
    live_reb: 6,
    live_ast: 4,
    live_stl: 1,
    live_blk: 1,
    live_tov: 2,
    live_min: status === 1 ? 0 : 24,
    live_fgm: 7,
    live_fga: 14,
    live_ftm: 3,
    live_fta: 4,
    live_fg3m: 2,
    live_fg3a: 5,
  };
}

const NINE_CAT: CategoryComparison = {
  wins: 5,
  losses: 3,
  ties: 1,
  items: [
    { key: "fg_pct", label: "FG%", you: 0.488, opp: 0.471, higher_is_better: true, is_rate: true, winner: "you" },
    { key: "ft_pct", label: "FT%", you: 0.79, opp: 0.812, higher_is_better: true, is_rate: true, winner: "opp" },
    { key: "fg3m", label: "3PM", you: 21, opp: 21, higher_is_better: true, is_rate: false, winner: "tie" },
    { key: "pts", label: "PTS", you: 402, opp: 388, higher_is_better: true, is_rate: false, winner: "you" },
    { key: "reb", label: "REB", you: 151, opp: 133, higher_is_better: true, is_rate: false, winner: "you" },
    { key: "ast", label: "AST", you: 88, opp: 97, higher_is_better: true, is_rate: false, winner: "opp" },
    { key: "stl", label: "STL", you: 24, opp: 19, higher_is_better: true, is_rate: false, winner: "you" },
    { key: "blk", label: "BLK", you: 17, opp: 22, higher_is_better: true, is_rate: false, winner: "opp" },
    { key: "tov", label: "TO", you: 41, opp: 45, higher_is_better: false, is_rate: false, winner: "you" },
  ],
};

/** /matchups/current: both rosters, ESPN's (or Yahoo's) totals. */
export function current(opts: { categories?: boolean; mine?: Spec[]; theirs?: Spec[] } = {}): MatchupData {
  const cats = !!opts.categories;
  return {
    matchup_period: PERIOD,
    matchup_period_start: DATES[0],
    matchup_period_end: DATES[6],
    schedule_week: PERIOD,
    scoring_period_id: 7 + TODAY,
    scoring_period_source: "provider",
    scoring_format: cats ? "categories" : "points",
    settings_synced: true,
    your_team: {
      team_id: 3, team_name: "Sample Points Team", current_score: cats ? 5 : 211.5, projected_score: 640.2,
      roster: (opts.mine ?? MINE).map(matchupPlayer), categories: null,
    },
    opponent_team: {
      team_id: 8, team_name: "Sample Rivals", current_score: cats ? 3 : 198, projected_score: 602.7,
      roster: (opts.theirs ?? THEIRS).map(matchupPlayer), categories: null,
    },
    projected_winner: "Sample Points Team",
    projected_margin: 37.5,
    category_comparison: cats ? NINE_CAT : null,
    projected_category_comparison: null,
  };
}

/**
 * /matchups/live: the same rosters (the server builds it from the same read)
 * with tonight's box scores on top; `boxes` maps an ESPN player id to his.
 */
export function live(from: MatchupData, boxes: Record<number, PlayerLiveStats> = {}): LiveMatchupData {
  const overlay = (p: MatchupPlayer): LiveMatchupPlayer => ({ ...p, live: boxes[p.player_id] ?? null });
  return {
    matchup_period: from.matchup_period,
    matchup_period_start: from.matchup_period_start,
    matchup_period_end: from.matchup_period_end,
    game_date: DATES[TODAY],
    baseline_stale_days: 0,
    scoring_format: from.scoring_format,
    settings_synced: from.settings_synced,
    category_comparison: from.category_comparison,
    projected_winner: from.projected_winner,
    projected_margin: from.projected_margin,
    your_team: { ...from.your_team, current_score: from.your_team.current_score + 12.5, roster: from.your_team.roster.map(overlay) },
    opponent_team: { ...from.opponent_team, roster: from.opponent_team.roster.map(overlay) },
  };
}

/** A played day's (or today's) row: the box score, once the day is over. */
function dayRow(s: Spec, day: number, past: boolean): DailyMatchupPlayerStats {
  const tip = s.tips[day];
  const played = past && tip != null && s.injury !== "OUT";
  return {
      player_id: s.id, nba_player_id: s.nbaId, name: s.name, team: s.team, position: s.position,
      had_game: tip != null, lineup_slot: null, lineup_slot_id: null, injury_status: s.injury ?? null,
      fpts: played ? Math.round(s.avg * 10) / 10 : null,
      pts: played ? 24 : null, reb: played ? 9 : null, ast: played ? 6 : null, stl: played ? 1 : null, blk: played ? 1 : null,
      tov: played ? 3 : null, min: played ? 34 : null, fgm: played ? 9 : null, fga: played ? 17 : null,
    fg3m: played ? 2 : null, fg3a: played ? 5 : null, ftm: played ? 4 : null, fta: played ? 5 : null,
  };
}

/** /matchups/week: every day of the period; `today` moves the day the server calls today (-1: preseason, all ahead). */
export function weekOf(opts: { today?: number; mine?: Spec[]; theirs?: Spec[]; categories?: boolean } = {}): WeeklyMatchupData {
  const today = opts.today ?? TODAY;
  const mine = opts.mine ?? MINE;
  const theirs = opts.theirs ?? THEIRS;
  return {
    matchup_period: PERIOD,
    days: DATES.map((date, i) => {
      const kind = i < today ? "past" : i === today ? "today" : "future";
      // Rows follow the server's rule: box scores up to today, the schedule after.
      const rows = (side: Spec[]) => side.map((s) => (kind === "future" ? futureRow(s, i) : dayRow(s, i, kind === "past")));
      return {
        date,
        day_index: i,
        day_of_week: DOW[i],
        day_type: kind,
        matchup_period: PERIOD,
        matchup_period_start: DATES[0],
        matchup_period_end: DATES[6],
        scoring_format: opts.categories ? "categories" : "points",
        category_comparison: null,
        your_team: {
          team_id: 3, team_name: "Sample Points Team", total_fpts: kind === "past" ? 101.5 : null,
          roster: rows(mine) as DailyMatchupPlayerStats[], categories: null, lineup_captured_at: null, roster_source: "current",
        },
        opponent_team: {
          team_id: 8, team_name: "Sample Rivals", total_fpts: kind === "past" ? 96 : null,
          roster: rows(theirs) as DailyMatchupPlayerStats[], categories: null, lineup_captured_at: null, roster_source: "current",
        },
      };
    }),
  };
}

function futureRow(s: Spec, day: number): DailyMatchupFuturePlayer {
  const tip = s.tips[day];
  return {
    player_id: s.id, nba_player_id: s.nbaId, name: s.name, team: s.team, position: s.position,
    has_game: tip != null, opponent: tip != null ? "vs MIA" : null, game_time_et: tip,
    injured: s.injury === "OUT", injury_status: s.injury ?? null,
  };
}

/** A Yahoo team: Yahoo's own player ids and slot names, no board. */
export const YAHOO_MINE: Spec[] = [
  { id: 6014, nbaId: 203999, name: "Nikola Jokic", team: "DEN", position: "C", slot: "C", slotId: -1, eligible: [], avg: 59.9, tips: MINE[0].tips },
  { id: 6450, nbaId: 1628983, name: "Shai Gilgeous-Alexander", team: "OKC", position: "PG", slot: "Util", slotId: -1, eligible: [], avg: 51.2, tips: MINE[2].tips },
  { id: 6604, nbaId: 1641705, name: "Victor Wembanyama", team: "SAS", position: "C", slot: "BN", slotId: -1, eligible: [], avg: 54.1, tips: MINE[4].tips },
];
export const YAHOO_THEIRS: Spec[] = [
  { id: 5826, nbaId: 1628369, name: "Jayson Tatum", team: "BOS", position: "SF", slot: "IL", slotId: -1, eligible: [], avg: 46.5, injury: "INJ", tips: THEIRS[0].tips },
  { id: 6513, nbaId: 1629627, name: "Zion Williamson", team: "NOP", position: "PF", slot: "PF", slotId: -1, eligible: [], avg: 37.4, tips: THEIRS[2].tips },
];
