import type { BaseApiResponse } from "./auth";

export interface PlayoffSeriesData {
  series_id: string;
  conference: string;          // "East", "West", "Finals"
  round_num: number;
  top_seed_team_id: number | null;
  top_seed_name: string | null;
  top_seed_abbr: string;
  top_seed_wins: number;
  bottom_seed_team_id: number | null;
  bottom_seed_name: string | null;
  bottom_seed_abbr: string;
  bottom_seed_wins: number;
  series_complete: boolean;
  series_leader_abbr: string | null;
  updated_at: string | null;
}

export interface PlayoffRound {
  round_num: number;
  round_name: string;
  series: PlayoffSeriesData[];
}

export interface PlayoffBracketData {
  season: string;
  rounds: PlayoffRound[];
}

export type PlayoffBracketResponse = BaseApiResponse<PlayoffBracketData>;
