/**
 * The live projection's prices on the Week desk (the Live rankings plan, step 8).
 *
 * A pickup is priced on the window it is for: each of his games left this matchup at
 * what he is expected to score that night, his role that night and his chance of
 * playing counted. A drop cannot be taken back, so the player given up is priced on
 * the rest of the season (`SourcePlayer.season`, off the lineup board's `live_season`).
 *
 * The backend sends both where it prices the league (a points league, a fresh
 * projection, a player it carries). Without them the desk reads the recent averages
 * it always has, and every rule here falls back to the one it was.
 */
import type { StreamerPlayer } from "@/types/streamer";

type Priced = Pick<StreamerPlayer, "game_days" | "avg_points_last_n" | "avg_points_season"> &
  Partial<Pick<StreamerPlayer, "live_values">>;

/** A free agent's expected points on each of his game days (day index to points), or null when he is not priced. */
export function nightly(fa: Priced): Map<number, number> | null {
  const values = fa.live_values;
  if (!values || values.length === 0 || values.length !== fa.game_days.length) return null;
  return new Map(fa.game_days.map((day, i) => [day, values[i]]));
}

export interface FaValue {
  /** Points a game. */
  value: number;
  /** From the live projection (expected points), not his recent average. */
  live: boolean;
}

/**
 * What a free agent is worth a game: on `day` when one is asked for and he is priced
 * there, else across his games left this matchup; his recent average when the live
 * projection has no price for him.
 */
export function faValue(fa: Priced, day: number | null = null): FaValue {
  const prices = nightly(fa);
  if (!prices) return { value: fa.avg_points_last_n ?? fa.avg_points_season, live: false };
  const on = day != null ? prices.get(day) : undefined;
  if (on != null) return { value: on, live: true };
  let sum = 0;
  for (const v of prices.values()) sum += v;
  return { value: sum / prices.size, live: true };
}

/** What giving a roster player up costs: his rest-of-season price, or his per-game figure when he has none. */
export function dropPrice(p: { avg: number; season?: number | null }): number {
  return p.season ?? p.avg;
}
