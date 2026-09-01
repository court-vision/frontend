/**
 * Pure view logic for the draft board: which rows are visible, and in what
 * order. Kept out of the component so the rules a draft is won or lost on are
 * testable without a DOM.
 *
 * The nullable columns are the whole subtlety here. A *market-only* row — a
 * player ESPN ranks that neither a projection nor last season's baseline can
 * value — has `value`, `cv_rank` and `fpts_avg` all null, and must sort last on
 * every column rather than first (which is where a naive `?? 0` would put him).
 */
import type { BoardSortKey, DraftBoardRow, PositionFilter, SortDirection } from "@/types/draft";

/** Rank-like columns are better ascending; value-like columns descending. */
export const ASCENDING_BY_NATURE: BoardSortKey[] = ["cv_rank", "market_rank", "adp", "name"];

export function naturalDirection(key: BoardSortKey): SortDirection {
  return ASCENDING_BY_NATURE.includes(key) ? "asc" : "desc";
}

export interface BoardView {
  sortKey: BoardSortKey;
  sortDirection: SortDirection;
  positionFilter: PositionFilter;
  hideCapped: boolean;
  search: string;
}

/**
 * The sort value for a column, with missing data pushed to the losing end so it
 * lands last whichever way the column is sorted.
 */
export function sortValue(row: DraftBoardRow, key: BoardSortKey): number | string {
  const LAST_ASC = Number.POSITIVE_INFINITY;
  const LAST_DESC = Number.NEGATIVE_INFINITY;
  switch (key) {
    case "name":
      return row.name.toLowerCase();
    case "cv_rank":
      return row.cv_rank ?? LAST_ASC;
    case "market_rank":
      return row.market_rank ?? LAST_ASC;
    case "adp":
      return row.adp ?? LAST_ASC;
    case "value":
      return row.value ?? LAST_DESC;
    case "market_delta":
      return row.market_delta ?? LAST_DESC;
    case "projected_gp":
      return row.projected_gp ?? row.last_season_gp ?? LAST_DESC;
  }
}

export function matchesView(row: DraftBoardRow, view: BoardView): boolean {
  if (view.hideCapped && row.cap_blocked) return false;
  if (view.positionFilter !== "all" && row.primary_position !== view.positionFilter) return false;
  const needle = view.search.trim().toLowerCase();
  if (needle && !row.name.toLowerCase().includes(needle)) return false;
  return true;
}

/**
 * Filter then sort. Ties break on `cv_rank` so equal values keep the big
 * board's own order instead of shuffling between renders.
 */
export function visibleRows(rows: DraftBoardRow[], view: BoardView): DraftBoardRow[] {
  const direction = view.sortDirection === "asc" ? 1 : -1;
  return rows.filter((row) => matchesView(row, view)).sort((a, b) => {
    const av = sortValue(a, view.sortKey);
    const bv = sortValue(b, view.sortKey);
    if (typeof av === "string" || typeof bv === "string") {
      return String(av).localeCompare(String(bv)) * direction;
    }
    if (av === bv) {
      return (a.cv_rank ?? Number.POSITIVE_INFINITY) - (b.cv_rank ?? Number.POSITIVE_INFINITY);
    }
    // Infinities cancel to NaN when subtracted from themselves; the equality
    // check above has already handled that case.
    return av < bv ? -direction : direction;
  });
}

export function countCapped(rows: DraftBoardRow[]): number {
  return rows.filter((row) => row.cap_blocked).length;
}
