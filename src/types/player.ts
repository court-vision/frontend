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
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
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
  avg_fg_pct: number;
  avg_fg3_pct: number;
  avg_ft_pct: number;
  // Shooting efficiency
  avg_ts_pct: number;
  avg_efg_pct: number;
  avg_three_rate: number;
  avg_ft_rate: number;
  // Volume averages
  avg_fgm: number;
  avg_fga: number;
  avg_fg3m: number;
  avg_fg3a: number;
  avg_ftm: number;
  avg_fta: number;
}

export interface AdvancedStatsData {
  off_rating: number | null;
  def_rating: number | null;
  net_rating: number | null;
  usg_pct: number | null;
  ast_pct: number | null;
  ast_to_tov: number | null;
  reb_pct: number | null;
  oreb_pct: number | null;
  dreb_pct: number | null;
  tov_pct: number | null;
  pace: number | null;
  pie: number | null;
  plus_minus: number | null;
}

export interface PlayerStats {
  id: number;
  name: string;
  team: string;
  games_played: number;
  window: string;
  window_games: number;
  avg_stats: AvgStats;
  advanced_stats: AdvancedStatsData | null;
  game_logs: GameLog[];
}
