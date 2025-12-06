export interface StandingsPlayer {
  rank: number;
  player_name: string;
  team: string;
  total_fpts: number;
  avg_fpts: number;
  rank_change: number;
}

export interface StandingsPlayerStats {
  avg_stats: {
    avg_points: number;
    avg_rebounds: number;
    avg_assists: number;
  };
  game_logs: {
    date: string;
    fpts: number;
  }[];
}
