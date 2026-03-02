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
