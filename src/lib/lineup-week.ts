import type { ScheduleWeek } from "@/types/lineup";

/**
 * Default matchup week for the lineup optimizer, as the string the form uses.
 * Prefers the server's current week; outside the season (`current_week` null)
 * falls back to the first week that hasn't ended yet, then to the first week
 * at all (offseason → week 1 of the upcoming season). `weeks` is assumed to be
 * in calendar order, as the API returns it.
 */
export function defaultLineupWeek(
  weeks: ScheduleWeek[],
  currentWeek: number | null | undefined,
  todayISO: string
): string | null {
  if (currentWeek != null) return String(currentWeek);
  const next = weeks.find((w) => w.end_date >= todayISO) ?? weeks[0];
  return next ? String(next.week) : null;
}
