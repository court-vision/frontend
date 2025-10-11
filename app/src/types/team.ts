export interface TeamInfo {
  team_name: string;
  league_name: string;
  league_id: number;
  year: number;
  espn_s2?: string;
  swid?: string;
}

export interface Team {
  team_id: number;
  team_info: TeamInfo;
}

export interface RosterPlayer {
  name: string;
  avg_points: number;
  team: string;
  valid_positions: string[];
  injured: boolean;
}

export interface LeagueInfoRequest {
  league_id: number;
  espn_s2?: string;
  swid?: string;
  team_name: string;
  league_name?: string;
  year: number;
}
