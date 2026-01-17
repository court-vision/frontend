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
 * Calculate the recent form trend by comparing last N games to season average.
 * Returns a value indicating if player is hot (positive), cold (negative), or neutral (near zero).
 */
export function calculateRecentFormTrend(
  gameLogs: GameLog[],
  seasonAvg: number,
  recentGames: number = 5
): { trend: "hot" | "cold" | "neutral"; diff: number } {
  if (gameLogs.length < recentGames) {
    return { trend: "neutral", diff: 0 };
  }

  const recentLogs = gameLogs.slice(-recentGames);
  const recentAvg = recentLogs.reduce((acc, g) => acc + g.fpts, 0) / recentGames;
  const diff = Math.round((recentAvg - seasonAvg) * 10) / 10;

  // Threshold: +/- 3 points difference to be considered hot/cold
  const threshold = 3;

  if (diff >= threshold) {
    return { trend: "hot", diff };
  } else if (diff <= -threshold) {
    return { trend: "cold", diff };
  } else {
    return { trend: "neutral", diff };
  }
}
