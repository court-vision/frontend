/**
 * Season calendar — the one place that knows which season it is and what
 * phase we're in. The server is the source of truth (`GET /schedule/weeks`
 * → `season`, see `@/hooks/useSeason`); `SEASON_FALLBACK` covers loading,
 * SSR/static output, and an API build that predates the `season` block.
 * Bump the fallback at rollover.
 *
 * Dates are ISO `YYYY-MM-DD` compared against the fantasy day in ET.
 * This module is pure — no hooks.
 */

import { getTodayET } from "@/lib/utils";
import type { SeasonInfo } from "@/types/lineup";

export type SeasonPhase = "preseason" | "regular" | "playoffs" | "offseason";

export interface Season {
  /** Canonical key, e.g. "2026-27". */
  key: string;
  /** Display label, e.g. "2026–27" (en dash). */
  label: string;
  /** First preseason game, or null until the NBA publishes it. */
  preseasonStart: string | null;
  /** Opening night — first fantasy day (schedule week 1 start_date). */
  regularSeasonStart: string;
  /** Last fantasy regular-season day (final schedule week end_date). */
  regularSeasonEnd: string;
  /** Roughly the end of the NBA Finals; offseason after this. */
  playoffsEnd: string;
}

export const SEASON_FALLBACK: Season = {
  key: "2026-27",
  label: "2026–27",
  preseasonStart: "2026-10-03",
  regularSeasonStart: "2026-10-20",
  regularSeasonEnd: "2027-04-11",
  playoffsEnd: "2027-06-20",
};

/** Regular-season end → end of the Finals, when the server season isn't the one we have a date for. */
const PLAYOFFS_LENGTH_DAYS = 70;

export function getSeasonPhase(today: string, season: Season): SeasonPhase {
  if (today < season.regularSeasonStart) {
    // Mirrors the server: no published preseason date means offseason until opening night.
    return season.preseasonStart !== null && today >= season.preseasonStart ? "preseason" : "offseason";
  }
  if (today <= season.regularSeasonEnd) return "regular";
  if (today <= season.playoffsEnd) return "playoffs";
  return "offseason";
}

/** "2026-27" → "2025–26". */
export function prevSeasonLabel(key: string): string {
  return shiftedSeasonLabel(key, -1);
}

/** "2026-27" → "2027–28". */
export function nextSeasonLabel(key: string): string {
  return shiftedSeasonLabel(key, 1);
}

/** "2026-27" → "2026–27" (en dash). Unparseable keys pass through unchanged. */
export function seasonLabel(key: string): string {
  return shiftedSeasonLabel(key, 0);
}

function shiftedSeasonLabel(key: string, delta: number): string {
  const start = parseInt(key.slice(0, 4), 10);
  if (Number.isNaN(start)) return key;
  const from = start + delta;
  return `${from}–${String(from + 1).slice(-2)}`;
}

/** ISO date → "Oct 20". */
export function formatSeasonDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso + "T00:00:00Z") - Date.parse(fromIso + "T00:00:00Z")) / 86_400_000);
}

const SERVER_PHASES: ReadonlySet<string> = new Set(["preseason", "regular", "offseason"]);

/** The API may still be an older build: only trust a `season` block that carries what we need. */
function usableSeasonInfo(info?: SeasonInfo | null): SeasonInfo | null {
  if (!info) return null;
  if (typeof info.key !== "string" || !info.key) return null;
  if (typeof info.regular_season_start !== "string" || typeof info.regular_season_end !== "string") return null;
  return info;
}

export interface ResolvedSeason extends Season {
  phase: SeasonPhase;
  /** 1-based day of the regular season (ESPN's scoringPeriodId), null outside it. */
  seasonDay: number | null;
  source: "server" | "fallback";
  /** True until opening night — the season is still ahead of us. */
  isUpcoming: boolean;
  /** Label of the season before `key`, e.g. "2025–26" for 2026-27. */
  prevLabel: string;
  /** Label of the season after `key`, e.g. "2027–28" for 2026-27. */
  nextLabel: string;
  /**
   * Label of the most recent season that has actually been played —
   * `prevLabel` until opening night, `label` from then on. Use it for copy
   * about final standings and results.
   */
  latestLabel: string;
}

/**
 * Resolve the server's season block (or the fallback constants) into a season
 * with a phase. The server calendar has no playoffs, so "playoffs" is always
 * computed client-side from `playoffsEnd`; the server's own phase wins for
 * preseason/regular/offseason.
 */
export function resolveSeason(info?: SeasonInfo | null, today: string = getTodayET()): ResolvedSeason {
  const server = usableSeasonInfo(info);
  const season: Season = server
    ? {
        key: server.key,
        label: server.label || shiftedSeasonLabel(server.key, 0),
        preseasonStart: server.preseason_start ?? null,
        regularSeasonStart: server.regular_season_start,
        regularSeasonEnd: server.regular_season_end,
        playoffsEnd:
          server.key === SEASON_FALLBACK.key
            ? SEASON_FALLBACK.playoffsEnd
            : addDays(server.regular_season_end, PLAYOFFS_LENGTH_DAYS),
      }
    : SEASON_FALLBACK;

  const clientPhase = getSeasonPhase(today, season);
  let phase: SeasonPhase = clientPhase;
  if (server && SERVER_PHASES.has(server.phase)) {
    // Promote the server's post-season "offseason" to "playoffs" while the Finals are on.
    phase = server.phase === "offseason" && clientPhase === "playoffs" ? "playoffs" : server.phase;
  }

  const seasonDay = server
    ? (server.season_day ?? null)
    : phase === "regular"
      ? daysBetween(season.regularSeasonStart, today) + 1
      : null;

  const isUpcoming = today < season.regularSeasonStart;
  const prevLabel = prevSeasonLabel(season.key);

  return {
    ...season,
    phase,
    seasonDay,
    source: server ? "server" : "fallback",
    isUpcoming,
    prevLabel,
    nextLabel: nextSeasonLabel(season.key),
    latestLabel: isUpcoming ? prevLabel : season.label,
  };
}

export type SeasonCopyContext = "matchup" | "rankings" | "summary";

/** Page subtitles that used to be hardcoded per season. */
export function seasonHeadline(context: SeasonCopyContext, phase: SeasonPhase, season: ResolvedSeason): string {
  switch (context) {
    case "matchup":
      if (phase === "regular") return "Your head-to-head matchup this week.";
      if (phase === "preseason") return `The ${season.label} season hasn't tipped off yet.`;
      return `Final matchup results — ${season.latestLabel} regular season.`;
    case "rankings":
      if (phase === "regular") return `${season.label} season leaders — updated daily.`;
      if (phase === "preseason") return `${season.latestLabel} final standings — live rankings resume opening night.`;
      return `${season.latestLabel} season leaders — final standings.`;
    case "summary":
      return `${season.latestLabel} Season Record`;
  }
}
