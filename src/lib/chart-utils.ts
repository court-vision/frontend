import type { GameLog } from "@/types/player";

export type MovingAverageWindow = 3 | 5 | 10;

export interface ChartDataPoint {
  date: string;
  fpts: number;
  movingAvg?: number;
}

/**
 * Calculate moving average for fantasy points over a sliding window.
 * Returns chart data points with both raw fpts and moving average values.
 * Moving average is undefined until there are enough games for the window.
 */
export function calculateMovingAverage(
  gameLogs: GameLog[],
  windowSize: MovingAverageWindow
): ChartDataPoint[] {
  return gameLogs.map((log, index) => {
    let movingAvg: number | undefined = undefined;

    if (index >= windowSize - 1) {
      const window = gameLogs.slice(index - windowSize + 1, index + 1);
      const sum = window.reduce((acc, g) => acc + g.fpts, 0);
      movingAvg = Math.round((sum / windowSize) * 10) / 10;
    }

    return {
      date: log.date,
      fpts: log.fpts,
      movingAvg,
    };
  });
}

/**
 * Hot/cold threshold relative to the player's own level: 7.5% of the season
 * average (±3 for a 40-fpts player, ±0.9 for a 12-fpts player), floored at 0.5.
 */
export function formTrendThreshold(seasonAvg: number): number {
  return Math.max(0.5, Math.abs(seasonAvg) * 0.075);
}

/**
 * Calculate the recent form trend by comparing last N games to season average.
 * Returns a value indicating if player is hot (positive), cold (negative), or neutral (near zero).
 * `accessor` picks the metric (fantasy points by default).
 */
export function calculateRecentFormTrend(
  gameLogs: GameLog[],
  seasonAvg: number,
  recentGames: number = 5,
  accessor: (g: GameLog) => number = (g) => g.fpts
): { trend: "hot" | "cold" | "neutral"; diff: number } {
  if (gameLogs.length < recentGames) {
    return { trend: "neutral", diff: 0 };
  }

  const recentLogs = gameLogs.slice(-recentGames);
  const recentAvg = recentLogs.reduce((acc, g) => acc + accessor(g), 0) / recentGames;
  const diff = Math.round((recentAvg - seasonAvg) * 10) / 10;

  const threshold = formTrendThreshold(seasonAvg);

  if (diff >= threshold) {
    return { trend: "hot", diff };
  } else if (diff <= -threshold) {
    return { trend: "cold", diff };
  } else {
    return { trend: "neutral", diff };
  }
}
