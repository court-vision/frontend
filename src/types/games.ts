export interface GameInfo {
  game_id: string;
  game_date: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: "scheduled" | "in_progress" | "final";
  arena: string | null;
}

export interface GamesOnDateData {
  date: string;
  games: GameInfo[];
  count: number;
}
