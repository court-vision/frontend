import type { BaseApiResponse } from "./auth";

export interface LivePlayerData {
  espn_id: number | null;
  player_id: number;
  player_name: string;
  game_id: string;
  game_date: string;
  game_status: 1 | 2 | 3; // 1=scheduled, 2=in_progress, 3=final
  period: number | null;
  game_clock: string | null; // ISO 8601 duration, e.g. "PT07M23.00S"
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
  last_updated: string | null;
}

export interface LivePlayersData {
  game_date: string;
  player_count: number;
  players: LivePlayerData[];
}

export type LivePlayersResponse = BaseApiResponse<LivePlayersData>;
