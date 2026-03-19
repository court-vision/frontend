export interface NBATeamStatsData {
  team: string;
  team_name: string;
  conference: string;
  division: string;
  as_of_date: string;
  season: string;
  gp: number | null;
  w: number | null;
  l: number | null;
  w_pct: number | null;
  pts: number | null;
  reb: number | null;
  ast: number | null;
  stl: number | null;
  blk: number | null;
  tov: number | null;
  fg_pct: number | null;
  fg3_pct: number | null;
  ft_pct: number | null;
  off_rating: number | null;
  def_rating: number | null;
  net_rating: number | null;
  pace: number | null;
  ts_pct: number | null;
  efg_pct: number | null;
  pie: number | null;
}

export interface NBATeamRosterPlayer {
  player_id: number;
  name: string;
  position: string | null;
  gp: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fpts: number;
  fg_pct: number | null;
  fg3_pct: number | null;
  ft_pct: number | null;
  injury_status: string | null;
}

export interface NBATeamRosterData {
  team: string;
  team_name: string;
  players: NBATeamRosterPlayer[];
  as_of_date: string;
}
