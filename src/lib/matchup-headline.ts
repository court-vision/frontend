/**
 * Pure derivations for matchup surfaces: the scoreboard headline (points or
 * categories), per-day outcomes, and category chart series. Every matchup
 * component branches on `scoring_format` through these helpers so the points
 * rendering is untouched for points leagues.
 */

import {
  DEFAULT_9CAT,
  categoryDefsFromComparison,
  formatNetCategories,
  formatRecord,
  recordOutcome,
  winnerFromValues,
  type Outcome,
} from "@/lib/category-format";
import type { CategoryDef } from "@/types/scoring";
import type {
  CategoryComparison,
  DailyMatchupData,
  LiveMatchupData,
  MatchupData,
  MatchupScoreHistory,
  ScoringFormat,
} from "@/types/matchup";

/** Projected-margin magnitude at which a "projected W/L" badge is shown. */
export const PROJECTED_BADGE_THRESHOLD: Record<ScoringFormat, number> = {
  points: 5,
  categories: 1,
};

export interface TeamRecord {
  wins: number;
  losses: number;
  ties: number;
}

export interface MatchupHeadline {
  format: ScoringFormat;
  isCategories: boolean;
  /** Current scalar: fantasy points, or categories won. */
  you: number;
  opp: number;
  outcome: Outcome;
  /** "Winning by 12.3" / "Leading 5-3-1" / "Tied 4-4-1" */
  statusLabel: string;
  yourRecord: TeamRecord | null;
  oppRecord: TeamRecord | null;
  categoryCount: number;
  yourProj: number;
  oppProj: number;
  projWinner: string;
  projWinnerIsYou: boolean;
  /** Absolute projected margin (points or categories). */
  projMargin: number;
  /** "Proj: 123.4" / "Proj: 6 cats" */
  yourProjLabel: string;
  oppProjLabel: string;
  /** "(+12.3)" / "(+3 cats)" */
  projMarginLabel: string;
  showProjectedBadge: boolean;
  comparison: CategoryComparison | null;
  projectedComparison: CategoryComparison | null;
  categories: CategoryDef[];
  liveAdjusted: boolean;
  settingsSynced: boolean;
}

export function recordFromComparison(c: CategoryComparison, invert = false): TeamRecord {
  return invert
    ? { wins: c.losses, losses: c.wins, ties: c.ties }
    : { wins: c.wins, losses: c.losses, ties: c.ties };
}

/** Format a scoreboard scalar for the format: `123` for cats, `123.4` for points. */
export function formatScalar(value: number, format: ScoringFormat, opts: { round?: boolean } = {}): string {
  if (format === "categories") return String(Math.round(value));
  return opts.round ? String(Math.round(value)) : value.toFixed(1);
}

export function isProjectionDecisive(margin: number, format: ScoringFormat): boolean {
  const threshold = PROJECTED_BADGE_THRESHOLD[format];
  return format === "categories" ? margin >= threshold : margin > threshold;
}

export function deriveHeadline(
  display: MatchupData | LiveMatchupData,
  matchup?: MatchupData
): MatchupHeadline {
  const format: ScoringFormat = display.scoring_format ?? matchup?.scoring_format ?? "points";
  const isCategories = format === "categories";

  const comparison = display.category_comparison ?? matchup?.category_comparison ?? null;
  const projectedComparison =
    matchup?.projected_category_comparison ??
    ("projected_category_comparison" in display ? display.projected_category_comparison ?? null : null);

  const you = display.your_team.current_score;
  const opp = display.opponent_team.current_score;
  const yourCats = display.your_team.categories ?? null;
  const oppCats = display.opponent_team.categories ?? null;

  const yourRecord: TeamRecord | null = isCategories
    ? yourCats
      ? { wins: yourCats.wins, losses: yourCats.losses, ties: yourCats.ties }
      : comparison
        ? recordFromComparison(comparison)
        : null
    : null;
  const oppRecord: TeamRecord | null = isCategories
    ? oppCats
      ? { wins: oppCats.wins, losses: oppCats.losses, ties: oppCats.ties }
      : comparison
        ? recordFromComparison(comparison, true)
        : null
    : null;

  const derivedDefs = categoryDefsFromComparison(comparison ?? projectedComparison);
  const categories = isCategories ? (derivedDefs.length ? derivedDefs : DEFAULT_9CAT) : [];
  const categoryCount = yourRecord
    ? yourRecord.wins + yourRecord.losses + yourRecord.ties
    : categories.length;

  let outcome: Outcome;
  let statusLabel: string;
  if (isCategories) {
    const w = yourRecord?.wins ?? Math.round(you);
    const l = yourRecord?.losses ?? Math.round(opp);
    const t = yourRecord?.ties ?? 0;
    outcome = recordOutcome(w, l);
    const rec = formatRecord(w, l, t);
    statusLabel = outcome === "win" ? `Leading ${rec}` : outcome === "loss" ? `Trailing ${rec}` : `Tied ${rec}`;
  } else {
    const diff = you - opp;
    outcome = Math.abs(diff) < 1e-9 ? "tie" : diff > 0 ? "win" : "loss";
    statusLabel =
      outcome === "tie" ? "Tied" : `${outcome === "win" ? "Winning" : "Losing"} by ${Math.abs(diff).toFixed(1)}`;
  }

  // Projected fields always come from the regular matchup (more stable) when present.
  const yourProj = matchup?.your_team.projected_score ?? display.your_team.projected_score;
  const oppProj = matchup?.opponent_team.projected_score ?? display.opponent_team.projected_score;
  const projWinner = matchup?.projected_winner ?? display.projected_winner;
  const projMargin = Math.abs(matchup?.projected_margin ?? display.projected_margin);
  const projWinnerIsYou = projWinner === display.your_team.team_name;

  const yourProjLabel = isCategories ? `Proj: ${Math.round(yourProj)} cats` : `Proj: ${yourProj.toFixed(1)}`;
  const oppProjLabel = isCategories ? `Proj: ${Math.round(oppProj)} cats` : `Proj: ${oppProj.toFixed(1)}`;
  const projMarginLabel = isCategories
    ? `(${formatNetCategories(Math.round(projMargin), 0)})`
    : `(+${projMargin.toFixed(1)})`;

  const liveAdjusted = yourCats?.live_adjusted ?? "game_date" in display;
  const settingsSynced = display.settings_synced ?? matchup?.settings_synced ?? true;

  return {
    format,
    isCategories,
    you,
    opp,
    outcome,
    statusLabel,
    yourRecord,
    oppRecord,
    categoryCount,
    yourProj,
    oppProj,
    projWinner,
    projWinnerIsYou,
    projMargin,
    yourProjLabel,
    oppProjLabel,
    projMarginLabel,
    showProjectedBadge: isProjectionDecisive(projMargin, format),
    comparison,
    projectedComparison,
    categories,
    liveAdjusted,
    settingsSynced,
  };
}

// ---- Per-day helpers -------------------------------------------------------

export function dayRecord(day: DailyMatchupData | undefined | null): TeamRecord | null {
  const c = day?.category_comparison;
  return c ? recordFromComparison(c) : null;
}

/** Outcome of each completed day keyed by ISO date (category leagues only). */
export function dayOutcomes(days: DailyMatchupData[] | undefined): Record<string, Outcome> {
  const out: Record<string, Outcome> = {};
  for (const day of days ?? []) {
    if (day.day_type === "future") continue;
    const c = day.category_comparison;
    if (!c) continue;
    out[day.date] = recordOutcome(c.wins, c.losses);
  }
  return out;
}

/** Net categories (wins − losses) per completed day keyed by ISO date. */
export function dayNetCategories(days: DailyMatchupData[] | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const day of days ?? []) {
    if (day.day_type === "future") continue;
    const c = day.category_comparison;
    if (!c) continue;
    out[day.date] = c.wins - c.losses;
  }
  return out;
}

// ---- Chart series ----------------------------------------------------------

export interface CategoryChartPoint {
  date: string;
  day_of_matchup: number;
  /** Categories you lead (cumulative) or won (daily). */
  your_score: number;
  /** Categories the opponent leads / won. */
  opponent_score: number;
  ties: number;
}

/**
 * Cumulative "categories led" per day from history snapshots that carry
 * week-to-date category totals. Points without totals are skipped.
 */
export function historyToCategoryPoints(
  history: MatchupScoreHistory,
  categories: CategoryDef[]
): CategoryChartPoint[] {
  const defs = categories.length ? categories : DEFAULT_9CAT;
  const out: CategoryChartPoint[] = [];
  for (const p of history.history) {
    const you = p.your_categories;
    const opp = p.opponent_categories;
    if (!you || !opp) continue;
    let wins = 0;
    let losses = 0;
    let ties = 0;
    for (const d of defs) {
      const w = winnerFromValues(you[d.key], opp[d.key], d.higher_is_better);
      if (w === "you") wins += 1;
      else if (w === "opp") losses += 1;
      else ties += 1;
    }
    out.push({ date: p.date, day_of_matchup: p.day_of_matchup, your_score: wins, opponent_score: losses, ties });
  }
  return out;
}

/** Per-day "categories won" from the weekly days payload (non-cumulative). */
export function weeklyToCategoryPoints(days: DailyMatchupData[] | undefined): CategoryChartPoint[] {
  const out: CategoryChartPoint[] = [];
  for (const day of days ?? []) {
    if (day.day_type === "future") continue;
    const c = day.category_comparison;
    if (!c) continue;
    out.push({
      date: day.date,
      day_of_matchup: day.day_index,
      your_score: c.wins,
      opponent_score: c.losses,
      ties: c.ties,
    });
  }
  return out;
}
