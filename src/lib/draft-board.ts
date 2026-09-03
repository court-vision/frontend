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
 * The sort value for a column. Missing data stays null so the comparator can
 * place it last independently of the active sort direction.
 */
export function sortValue(row: DraftBoardRow, key: BoardSortKey): number | string | null {
  switch (key) {
    case "name":
      return row.name.toLowerCase();
    case "cv_rank":
      return row.cv_rank;
    case "market_rank":
      return row.market_rank;
    case "adp":
      return row.adp;
    case "value":
      return row.value;
    case "market_delta":
      return row.market_delta;
    case "projected_gp":
      return row.projected_gp ?? row.last_season_gp;
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
    if (av === null || bv === null) {
      if (av === null && bv === null) {
        return (a.cv_rank ?? Number.POSITIVE_INFINITY) -
          (b.cv_rank ?? Number.POSITIVE_INFINITY);
      }
      return av === null ? 1 : -1;
    }
    if (typeof av === "string" || typeof bv === "string") {
      return String(av).localeCompare(String(bv)) * direction;
    }
    if (av === bv) {
      return (a.cv_rank ?? Number.POSITIVE_INFINITY) - (b.cv_rank ?? Number.POSITIVE_INFINITY);
    }
    return av < bv ? -direction : direction;
  });
}

export function countCapped(rows: DraftBoardRow[]): number {
  return rows.filter((row) => row.cap_blocked).length;
}

/**
 * Keyboard movement over the visible rows. No current row (or one that has
 * since left the view) starts from the edge the key points away from, rather
 * than jumping somewhere the user did not see.
 */
export function stepHighlight(
  visibleIds: number[],
  current: number | null,
  delta: 1 | -1
): number | null {
  if (visibleIds.length === 0) return null;
  const index = current === null ? -1 : visibleIds.indexOf(current);
  if (index === -1) return delta > 0 ? visibleIds[0] : visibleIds[visibleIds.length - 1];
  return visibleIds[Math.min(Math.max(index + delta, 0), visibleIds.length - 1)];
}

/**
 * The row a keystroke applies to: the highlighted one while it is visible,
 * else the first visible row — so typing a name and pressing Enter takes the
 * top match without an arrow key first.
 */
export function targetRow(visible: DraftBoardRow[], highlightId: number | null): DraftBoardRow | null {
  return visible.find((row) => row.player_id === highlightId) ?? visible[0] ?? null;
}
