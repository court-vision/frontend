/**
 * Season calendar — the one place that knows which season it is and what
 * phase we're in. Bump `SEASON` at rollover (see Phase 3 of the roadmap).
 *
 * Dates are ISO `YYYY-MM-DD` compared against the fantasy day in ET.
 */

import { getTodayET } from "@/lib/utils";

export type SeasonPhase = "preseason" | "regular" | "playoffs" | "offseason";

export const SEASON = {
  /** Label of the most recent/current season. */
  label: "2025–26",
  /** Label of the season that starts next fall. */
  nextLabel: "2026–27",
  /** First fantasy day (schedule week 1 startDate). */
  regularSeasonStart: "2025-10-21",
  /** Last fantasy regular-season day (schedule week 24 endDate). */
  regularSeasonEnd: "2026-04-12",
  /** Roughly the end of the NBA Finals; offseason after this. */
  playoffsEnd: "2026-06-22",
  /** Expected opening night of the next season (update when the NBA publishes it). */
  nextSeasonStart: "2026-10-20",
} as const;

export function getSeasonPhase(today: string = getTodayET()): SeasonPhase {
  if (today < SEASON.regularSeasonStart) return "preseason";
  if (today <= SEASON.regularSeasonEnd) return "regular";
  if (today <= SEASON.playoffsEnd) return "playoffs";
  return "offseason";
}

export type SeasonCopyContext = "matchup" | "rankings" | "summary";

/** Page subtitles that used to be hardcoded per season. */
export function seasonHeadline(context: SeasonCopyContext, phase: SeasonPhase = getSeasonPhase()): string {
  switch (context) {
    case "matchup":
      if (phase === "regular") return "Your head-to-head matchup this week.";
      if (phase === "preseason") return `The ${SEASON.nextLabel} season hasn't tipped off yet.`;
      return `Final matchup results — ${SEASON.label} regular season.`;
    case "rankings":
      if (phase === "regular") return `${SEASON.label} season leaders — updated daily.`;
      if (phase === "preseason") return `${SEASON.label} final standings — live rankings resume opening night.`;
      return `${SEASON.label} season leaders — final standings.`;
    case "summary":
      return `${SEASON.label} Season Record`;
  }
}
