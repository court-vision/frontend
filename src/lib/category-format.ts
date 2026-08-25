/**
 * Formatting + classification helpers for category-league UI.
 *
 * Pure functions only — safe to import from server and client components.
 * Rates are 0–1 fractions everywhere (mirrors backend `CategoryScoring`).
 */

import type {
  CategoryComparison,
  CategoryDef,
  CategoryWinner,
  ScoringType,
} from "@/types/scoring";
import type { FantasyProvider, LeagueSummary } from "@/types/team";

export type Outcome = "win" | "loss" | "tie";

/** Standard 9-cat, in the order leagues conventionally list them. */
export const DEFAULT_9CAT: CategoryDef[] = [
  { key: "fg_pct", label: "FG%", higher_is_better: true, is_rate: true },
  { key: "ft_pct", label: "FT%", higher_is_better: true, is_rate: true },
  { key: "fg3m", label: "3PM", higher_is_better: true, is_rate: false },
  { key: "pts", label: "PTS", higher_is_better: true, is_rate: false },
  { key: "reb", label: "REB", higher_is_better: true, is_rate: false },
  { key: "ast", label: "AST", higher_is_better: true, is_rate: false },
  { key: "stl", label: "STL", higher_is_better: true, is_rate: false },
  { key: "blk", label: "BLK", higher_is_better: true, is_rate: false },
  { key: "tov", label: "TO", higher_is_better: false, is_rate: false },
];

/** Display labels for raw stat keys (point weights, raw totals). */
export const STAT_LABELS: Record<string, string> = {
  pts: "PTS",
  reb: "REB",
  oreb: "OREB",
  dreb: "DREB",
  ast: "AST",
  stl: "STL",
  blk: "BLK",
  tov: "TO",
  fgm: "FGM",
  fga: "FGA",
  fg_pct: "FG%",
  ftm: "FTM",
  fta: "FTA",
  ft_pct: "FT%",
  fg3m: "3PM",
  fg3a: "3PA",
  fg3_pct: "3P%",
  min: "MIN",
  pf: "PF",
  dd: "DD",
  td: "TD",
  gp: "GP",
  ato: "A/TO",
  ejct: "EJ",
  tech: "TECH",
  flag: "FLAG",
};

export function statLabel(key: string): string {
  return STAT_LABELS[key] ?? key.toUpperCase();
}

/** Makes/attempts keys backing a rate category. */
export const RATE_INPUTS: Record<string, { makes: string; attempts: string }> = {
  fg_pct: { makes: "fgm", attempts: "fga" },
  ft_pct: { makes: "ftm", attempts: "fta" },
  fg3_pct: { makes: "fg3m", attempts: "fg3a" },
  ato: { makes: "ast", attempts: "tov" },
};

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Format a category value for display: rates as `48.7%`, counting stats as
 * integers when whole, otherwise one decimal. Null/NaN renders as an em dash.
 */
export function formatCategoryValue(
  value: number | null | undefined,
  def: Pick<CategoryDef, "is_rate">,
  opts: { decimals?: number } = {}
): string {
  if (!isFiniteNumber(value)) return "—";
  if (def.is_rate) return `${(value * 100).toFixed(1)}%`;
  const decimals = opts.decimals ?? 1;
  return Number.isInteger(value) ? String(value) : value.toFixed(decimals);
}

/** `12-25` style makes/attempts sublabel for a rate category, or null if unavailable. */
export function formatMakesAttempts(
  raw: Record<string, number> | null | undefined,
  key: string
): string | null {
  const inputs = RATE_INPUTS[key];
  if (!inputs || !raw) return null;
  const makes = raw[inputs.makes];
  const attempts = raw[inputs.attempts];
  if (!isFiniteNumber(makes) || !isFiniteNumber(attempts)) return null;
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  return `${fmt(makes)}-${fmt(attempts)}`;
}

export function formatRecord(wins: number, losses: number, ties = 0): string {
  return `${wins}-${losses}-${ties}`;
}

export function recordOutcome(wins: number, losses: number): Outcome {
  if (wins > losses) return "win";
  if (wins < losses) return "loss";
  return "tie";
}

/** Signed record delta, e.g. `+3 cats` / `-1 cat` / `even`. */
export function formatNetCategories(wins: number, losses: number): string {
  const net = wins - losses;
  if (net === 0) return "even";
  const abs = Math.abs(net);
  return `${net > 0 ? "+" : "-"}${abs} ${abs === 1 ? "cat" : "cats"}`;
}

const EPSILON = 1e-9;

/** Mirrors backend `CategoryScoring.compare` for a single category. */
export function winnerFromValues(
  you: number | null | undefined,
  opp: number | null | undefined,
  higherIsBetter: boolean
): CategoryWinner {
  const a = isFiniteNumber(you) ? you : 0;
  const b = isFiniteNumber(opp) ? opp : 0;
  if (Math.abs(a - b) < EPSILON) return "tie";
  const youAhead = higherIsBetter ? a > b : a < b;
  return youAhead ? "you" : "opp";
}

/**
 * Your share of a two-sided bar, 0–1. Equal (or both zero) → 0.5.
 * For lower-is-better categories the share is inverted so the "better" side
 * always reads as the larger segment.
 */
export function barShare(
  you: number | null | undefined,
  opp: number | null | undefined,
  higherIsBetter = true
): number {
  const a = Math.max(0, isFiniteNumber(you) ? you : 0);
  const b = Math.max(0, isFiniteNumber(opp) ? opp : 0);
  const total = a + b;
  if (total < EPSILON) return 0.5;
  const share = a / total;
  return higherIsBetter ? share : 1 - share;
}

/** Tailwind classes keyed by who is winning a category (uses --status-* tokens). */
export const WINNER_CLASSES: Record<
  CategoryWinner,
  { text: string; bg: string; border: string; bar: string }
> = {
  you: {
    text: "text-status-win",
    bg: "bg-status-win/15",
    border: "border-status-win/30",
    bar: "bg-status-win",
  },
  opp: {
    text: "text-status-loss",
    bg: "bg-status-loss/15",
    border: "border-status-loss/30",
    bar: "bg-status-loss",
  },
  tie: {
    text: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-border",
    bar: "bg-muted-foreground/40",
  },
};

export const OUTCOME_CLASSES: Record<Outcome, { text: string; bg: string; border: string }> = {
  win: WINNER_CLASSES.you,
  loss: WINNER_CLASSES.opp,
  tie: WINNER_CLASSES.tie,
};

export function outcomeToWinner(outcome: Outcome): CategoryWinner {
  return outcome === "win" ? "you" : outcome === "loss" ? "opp" : "tie";
}

/** Badge variant (see `ui/badge.tsx`) for an outcome. */
export function winnerBadgeVariant(outcome: Outcome): "win" | "loss" | "neutral" {
  return outcome === "win" ? "win" : outcome === "loss" ? "loss" : "neutral";
}

/** `↓` for lower-is-better categories (turnovers), empty otherwise. */
export function polarityGlyph(def: Pick<CategoryDef, "higher_is_better">): string {
  return def.higher_is_better ? "" : "↓";
}

export function categoryDefsFromComparison(
  comparison: CategoryComparison | null | undefined
): CategoryDef[] {
  if (!comparison?.items?.length) return [];
  return comparison.items.map((item) => ({
    key: item.key,
    label: item.label,
    higher_is_better: item.higher_is_better,
    is_rate: item.is_rate,
  }));
}

// ---- Provider scoring-type normalization ----

export interface NormalizedScoringType {
  type: ScoringType | "unknown";
  label: string;
}

const YAHOO_SCORING_TYPES: Record<string, NormalizedScoringType> = {
  head: { type: "categories", label: "H2H Categories" },
  headone: { type: "categories", label: "H2H One Win" },
  headpoint: { type: "points", label: "H2H Points" },
  point: { type: "points", label: "Points" },
  roto: { type: "roto", label: "Rotisserie" },
};

const GENERIC_SCORING_TYPES: Record<string, NormalizedScoringType> = {
  points: { type: "points", label: "H2H Points" },
  categories: { type: "categories", label: "H2H Categories" },
  roto: { type: "roto", label: "Rotisserie" },
};

/** Turn a provider's raw scoring-type string (Yahoo `head`, ESPN `points`) into a label. */
export function normalizeProviderScoringType(
  raw: string | null | undefined,
  provider: FantasyProvider = "espn"
): NormalizedScoringType {
  const key = (raw ?? "").trim().toLowerCase();
  if (!key) return { type: "unknown", label: "Unknown format" };
  const table = provider === "yahoo" ? YAHOO_SCORING_TYPES : GENERIC_SCORING_TYPES;
  return table[key] ?? GENERIC_SCORING_TYPES[key] ?? YAHOO_SCORING_TYPES[key] ?? { type: "unknown", label: raw ?? "Unknown format" };
}

/** Human label for a team's detected league format, e.g. `H2H 9-Cat` / `H2H Points`. */
export function scoringLabel(league: LeagueSummary | null | undefined): string {
  if (!league) return "Not synced";
  if (!league.settings_synced) return "Points (default)";
  switch (league.scoring_type) {
    case "categories": {
      const n = league.categories?.length ?? 0;
      return n > 0 ? `H2H ${n}-Cat` : "H2H Categories";
    }
    case "roto":
      return "Roto";
    default:
      return "H2H Points";
  }
}

/** Compact tag for tight spaces (team dropdown), e.g. `CATS` / `PTS` / `ROTO`. */
export function scoringShortLabel(league: LeagueSummary | null | undefined): string | null {
  if (!league?.settings_synced) return null;
  switch (league.scoring_type) {
    case "categories":
      return "CATS";
    case "roto":
      return "ROTO";
    default:
      return "PTS";
  }
}

export function winModeLabel(mode: LeagueSummary["category_win_mode"]): string | null {
  if (mode === "each_category") return "Each category counts";
  if (mode === "most_categories") return "Most categories wins";
  return null;
}
