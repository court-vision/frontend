import type { BaseApiResponse } from "./auth";

export interface PlayerScheduleInfo {
  game_days: number[];
  games_remaining: number;
  has_b2b: boolean;
}

export interface EnrichedRosterPlayer {
  player_id: number;
  name: string;
  avg_points: number;
  team: string;
  valid_positions: string[];
  injured: boolean;
  injury_status: string | null;
  schedule: PlayerScheduleInfo | null;
  avg_fpts_l7: number | null;
  avg_fpts_l14: number | null;
  avg_fpts_l30: number | null;
}

export interface CategoryStrengths {
  avg_points: number;
  avg_rebounds: number;
  avg_assists: number;
  avg_steals: number;
  avg_blocks: number;
  avg_turnovers: number;
  avg_fg_pct: number;
  avg_ft_pct: number;
}

export interface ScheduleOverview {
  matchup_number: number;
  matchup_start: string;
  matchup_end: string;
  current_day_index: number;
  game_span: number;
  total_team_games: number;
  teams_with_b2b: string[];
  day_game_counts: number[];
}

export interface RosterHealthSummary {
  total_players: number;
  healthy: number;
  out: number;
  day_to_day: number;
  game_time_decision: number;
}

export interface TeamInsightsData {
  roster: EnrichedRosterPlayer[];
  category_strengths: CategoryStrengths | null;
  schedule_overview: ScheduleOverview | null;
  roster_health: RosterHealthSummary;
  projected_week_fpts: number | null;
}

export type TeamInsightsResponse = BaseApiResponse<TeamInsightsData>;
