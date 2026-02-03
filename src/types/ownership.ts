import type { BaseApiResponse } from "./auth";

export interface TrendingPlayer {
  player_id: number;
  player_name: string;
  team: string | null;
  current_ownership: number;
  previous_ownership: number;
  change: number;
  velocity: number;
}

export interface OwnershipTrendingData {
  days: number;
  min_ownership: number;
  sort_by: "velocity" | "change";
  trending_up: TrendingPlayer[];
  trending_down: TrendingPlayer[];
}

export type OwnershipTrendingResponse = BaseApiResponse<OwnershipTrendingData>;

export interface OwnershipTrendingParams {
  days?: number;
  min_change?: number;
  min_ownership?: number;
  sort_by?: "velocity" | "change";
  direction?: "up" | "down" | "both";
  limit?: number;
}
