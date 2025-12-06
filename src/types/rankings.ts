export interface RankingsPlayer {
  name: string;
  proj_avg: number;
  proj_total: number;
  rank: number;
}

export type RankingModel = "Handpicked" | "LSTM" | "SVR";
