export interface GameInfo {
  game_id: string;
  game_date: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: "scheduled" | "in_progress" | "final";
  arena: string | null;
  period: number | null;
  game_clock: string | null; // ISO 8601 duration e.g. "PT05M23.00S", null if not live
  start_time_et?: string | null; // Scheduled tip-off time in ET (HH:MM format)
}

export interface GamesOnDateData {
  date: string;
  games: GameInfo[];
  count: number;
}

export interface ScheduleGame {
  date: string;
  opponent: string;
  home: boolean;
  back_to_back: boolean;
  status: "scheduled" | "in_progress" | "final";
  team_score: number | null;
  opponent_score: number | null;
  opponent_def_rating: number | null;
}

export interface TeamScheduleData {
  team: string;
  team_name: string;
  schedule: ScheduleGame[];
  remaining_games: number;
  total_games: number;
}

export interface TopPerformer {
  player_id: number;
  name: string;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  min: number;
  fgm: number;
  fga: number;
  fg3m: number;
}

export interface InjuredPlayer {
  player_id: number;
  name: string;
  status: string;
  injury_type: string | null;
  expected_return: string | null;
}

export interface GameScoreSnapshot {
  captured_at: string; // ISO 8601 datetime (UTC)
  period: number | null;
  game_clock: string | null;
  home_score: number;
  away_score: number;
  game_status: number; // 1=scheduled, 2=in_progress, 3=final
}

export interface NBATeamLiveGameData {
  game_id: string | null;
  game_date: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: "scheduled" | "in_progress" | "final";
  period: number | null;
  game_clock: string | null;
  start_time_et: string | null;
  arena: string | null;
  home_periods: number[];
  away_periods: number[];
  home_top_performers: TopPerformer[];
  away_top_performers: TopPerformer[];
  injured_players: InjuredPlayer[];
  is_today: boolean;
  is_upcoming: boolean;
  score_history: GameScoreSnapshot[];
}
