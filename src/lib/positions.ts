/**
 * Fantasy roster positions, and display helpers for them.
 *
 * ESPN's `valid_positions` mixes real positions with lineup slots
 * ("UTIL", "BE", "IR"), so anything user-facing filters through
 * `POSITIONS` first.
 */
export const POSITIONS = ["PG", "SG", "SF", "PF", "C", "G", "F"] as const;
export type Position = (typeof POSITIONS)[number];

/**
 * Condense `valid_positions` into a compact label like "PG/SG".
 * Returns null when nothing survives the filter, so callers can omit
 * the field rather than render an empty separator.
 */
export function formatPositions(
  validPositions: string[] | undefined | null,
  max = 3
): string | null {
  if (!validPositions?.length) return null;
  const real = validPositions.filter((pos) =>
    (POSITIONS as readonly string[]).includes(pos)
  );
  return real.length ? real.slice(0, max).join("/") : null;
}
