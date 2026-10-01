/**
 * The terminal's stat window: `"season"`, or `"lN"` for a player's last N games,
 * N from 1 to 82 -- the range `:window` accepts. The backend computes averages
 * for any N; these helpers let every panel that slices or labels game logs do
 * the same, instead of each matching a hard-coded l5 / l10 / l20.
 */
import type { StatWindow } from "@/types/terminal";

const LAST_N = /^l(\d+)$/i;

/** Games a window covers, or null for the full season (and for anything unreadable). */
export function windowGames(window: StatWindow): number | null {
  const match = LAST_N.exec(window);
  if (!match) return null;
  const n = Number(match[1]);
  return n >= 1 && n <= 82 ? n : null;
}

/** "Season", or "L15" for the last 15 games. */
export function windowLabel(window: StatWindow): string {
  const n = windowGames(window);
  return n === null ? "Season" : `L${n}`;
}

/** The window's games from a list in date order: the last N, or all of them for the season. */
export function lastGames<T>(logs: readonly T[], window: StatWindow): T[] {
  const n = windowGames(window);
  return n === null ? [...logs] : logs.slice(-n);
}
