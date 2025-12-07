export interface GameLog {
  date: string;
  fpts: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  min: number;
}

export interface AvgStats {
  avg_fpts: number;
  avg_points: number;
  avg_rebounds: number;
  avg_assists: number;
  avg_steals: number;
  avg_blocks: number;
  avg_turnovers: number;
  avg_minutes: number;
}

export interface PlayerStats {
  id: number;
  name: string;
  team: string;
  games_played: number;
  avg_stats: AvgStats;
  game_logs: GameLog[];
}

