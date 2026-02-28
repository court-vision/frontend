// Mirrors backend schemas/breakout.py

export interface BreakoutBeneficiary {
  player_id: number;
  name: string;
  team: string;
  position: string;
  depth_rank: number;
  avg_min: number;
  avg_fpts: number;
  games_remaining: number;
  has_b2b: boolean;
}

export interface BreakoutInjuredPlayer {
  player_id: number;
  name: string;
  avg_min: number;
  status: string;
  expected_return: string | null;
}

export interface BreakoutSignals {
  depth_rank: number;
  projected_min_boost: number;
  opp_min_avg: number | null;
  opp_fpts_avg: number | null;
  opp_game_count: number;
  breakout_score: number;
}

export interface BreakoutCandidateResp {
  beneficiary: BreakoutBeneficiary;
  injured_player: BreakoutInjuredPlayer;
  signals: BreakoutSignals;
}

export interface BreakoutData {
  as_of_date: string;
  candidates: BreakoutCandidateResp[];
}

export interface BreakoutResponse {
  status: string;
  message: string;
  data?: BreakoutData;
}
