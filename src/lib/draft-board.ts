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
import { polarityGlyph } from "@/lib/category-format";
import type {
  Availability,
  BoardSortKey,
  CategoryNeed,
  DraftBoardMeta,
  DraftBoardRow,
  PositionFilter,
  RankBasis,
  SortDirection,
} from "@/types/draft";
import type { CategoryDef } from "@/types/scoring";

/** Rank-like columns are better ascending; value-like columns descending. */
export const ASCENDING_BY_NATURE: BoardSortKey[] = [
  "board_rank",
  "cv_rank",
  "fit_rank",
  "market_rank",
  "adp",
  "name",
];

export function naturalDirection(key: BoardSortKey): SortDirection {
  return ASCENDING_BY_NATURE.includes(key) ? "asc" : "desc";
}

/**
 * Availability as a number, so it sorts. Descending puts `gone` first, which
 * is why the column is not in `ASCENDING_BY_NATURE`: it exists for the
 * on-the-clock scan, and the first click should answer "who am I about to
 * lose", not "who can I safely ignore".
 */
const AVAILABILITY_ORDER: Record<Availability, number> = { likely: 0, tossup: 1, gone: 2 };

/** The category key a `cat:<key>` sort column reads, or null for any other column. */
export function categorySortKey(key: BoardSortKey): string | null {
  return key.startsWith("cat:") ? key.slice(4) : null;
}

export interface BoardView {
  sortKey: BoardSortKey;
  sortDirection: SortDirection;
  positionFilter: PositionFilter;
  hideCapped: boolean;
  /** Only players the market says will not last until my next pick. */
  onlyLikelyGone: boolean;
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
    case "board_rank":
      return row.board_rank;
    case "cv_rank":
      return row.cv_rank;
    case "fit_rank":
      return row.fit_rank;
    case "market_rank":
      return row.market_rank;
    case "adp":
      return row.adp;
    case "value":
      return row.value;
    case "market_delta":
      return row.market_delta;
    case "availability":
      return row.availability === null ? null : AVAILABILITY_ORDER[row.availability];
    case "projected_gp":
      return row.projected_gp ?? row.last_season_gp;
    default: {
      // `cat:<key>`, the only remaining shape the union allows. A player the
      // pool cannot score has no categories at all, and sorts last like every
      // other missing value.
      const category = categorySortKey(key);
      return category === null ? null : (row.categories?.[category] ?? null);
    }
  }
}

export function matchesView(row: DraftBoardRow, view: BoardView): boolean {
  if (view.hideCapped && row.cap_blocked) return false;
  // A row with no market data has no availability, and "likely gone" is a
  // claim about the market — so it filters those out rather than keeping them
  // on the grounds that nothing said otherwise.
  if (view.onlyLikelyGone && row.availability !== "gone") return false;
  if (view.positionFilter !== "all" && row.primary_position !== view.positionFilter) return false;
  const needle = view.search.trim().toLowerCase();
  if (needle && !row.name.toLowerCase().includes(needle)) return false;
  return true;
}

/**
 * Filter then sort. Ties break on `cv_rank` so equal values keep a stable
 * order instead of shuffling between renders — on the board's own column that
 * is also the server's rule, so two players ESPN ranks the same, or the
 * unranked tail, read in the same order here as on the wire.
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
 * Keyboard movement over the visible rows. Callers pass the row that is
 * *visibly* active — which after a search is the fallback first row, not the
 * stale highlight — so the first keypress moves off what the user can see
 * rather than appearing to do nothing.
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

/**
 * Which columns the board shows, as data rather than markup.
 *
 * The set depends on the league: only a category league has a `Fit` column or
 * per-category z columns, and only rows with market data can carry
 * availability. Returning descriptors (rather than branching inside the table)
 * is what lets the header, the row cells and the sort share one definition —
 * they used to be three hand-synced lists.
 */
export interface BoardColumn {
  key: BoardSortKey;
  label: string;
  title?: string;
  /** Tailwind width/alignment, applied to the header and the body cells alike. */
  className: string;
  align: "left" | "right" | "center";
  sortable: boolean;
  /** Set on a category column this room has conceded; the renderer dims it. */
  punted?: boolean;
  /** The category this column reads, when it is one. */
  category?: CategoryDef;
}

/** The rank column that is *not* the gutter: the other opinion, beside the name. */
const OTHER_RANK: Record<RankBasis, BoardColumn> = {
  espn: { key: "cv_rank", label: "CV", className: "w-12", align: "right", sortable: true,
    title: "Court Vision's rank over the full pool — stable all draft long" },
  cv: { key: "market_rank", label: "ESPN", className: "w-12", align: "right", sortable: true,
    title: "ESPN's published draft rank for this league's format" },
};

const GUTTER_TITLE: Record<RankBasis, string> = {
  espn: "ESPN's published rank for this league's format — the board you are drafting off",
  cv: "CV rank over the full pool — stable all draft long",
};

/**
 * The columns every league has, in order. `Fit` slots in after `Value`.
 *
 * One rank sits in the gutter and the other beside the name, never the same
 * number twice: in an ESPN room the gutter is ESPN's published rank and the
 * column is CV's; in a room CV orders it is the other way round.
 */
function baseColumns(basis: RankBasis): BoardColumn[] {
  return [
    { key: "board_rank", label: "#", className: "w-10", align: "center", sortable: true,
      title: GUTTER_TITLE[basis] },
    { key: "name", label: "Player", className: "flex-[3] min-w-[180px]", align: "left", sortable: true },
    { key: "value", label: "Value", className: "w-16", align: "right", sortable: true,
      title: "Per-game value under this league's scoring" },
    OTHER_RANK[basis],
    { key: "adp", label: "ADP", className: "w-14", align: "right", sortable: true,
      title: "Average draft position across real ESPN drafts" },
    { key: "market_delta", label: "Δ", className: "w-12", align: "right", sortable: true,
      title: "ESPN rank − CV rank; positive means CV likes him more than ESPN does" },
    { key: "availability", label: "Avail", className: "w-16", align: "center", sortable: true,
      title: "Whether he lasts until your next pick, from ADP against that pick" },
    { key: "projected_gp", label: "GP", className: "w-12", align: "right", sortable: true,
      title: "Projected games this season" },
  ];
}

const FIT_COLUMN: BoardColumn = {
  key: "fit_rank",
  label: "Fit",
  className: "w-16",
  align: "right",
  sortable: true,
  title: "The same board re-scored for your roster, with punted categories at zero",
};

export function columnsFor(meta: DraftBoardMeta | null): BoardColumn[] {
  const base = baseColumns(meta?.rank_basis ?? "cv");
  if (meta?.value_kind !== "cat_value") return base;
  const punts = new Set(meta.punts ?? []);
  const categories: BoardColumn[] = (meta.categories ?? []).map((def) => ({
    key: `cat:${def.key}` as BoardSortKey,
    label: `${def.label}${polarityGlyph(def)}`,
    title: def.higher_is_better
      ? `${def.label} — higher is better`
      : `${def.label} — lower is better`,
    className: "w-[52px]",
    align: "right",
    sortable: true,
    punted: punts.has(def.key),
    category: def,
  }));
  const withFit = [...base];
  withFit.splice(base.findIndex((c) => c.key === "value") + 1, 0, FIT_COLUMN);
  return [...withFit, ...categories];
}

/**
 * What the board's order is, for the filter bar. The gutter number reads as
 * "the rank" whoever produced it, so the bar says whose, and — when it is not
 * ESPN's in a room that would normally take ESPN's — why not.
 */
export function basisNote(meta: DraftBoardMeta | null): { label: string; title: string } | null {
  if (!meta) return null;
  if (meta.rank_basis === "espn") {
    const board = meta.market_rank_type === "roto" ? "categories" : "points";
    const asOf = meta.market_as_of ? ` · as of ${meta.market_as_of}` : "";
    return {
      label: `ESPN ${board} board${asOf}`,
      title:
        "Rows are in ESPN's published draft order for this league's format; " +
        "Court Vision's rank is the column beside the name",
    };
  }
  switch (meta.rank_basis_reason) {
    case "no_market_snapshot":
      return {
        label: "CV board — no ESPN snapshot yet",
        title: "No ESPN draft snapshot has been taken for this season, so the rows are in Court Vision's order",
      };
    case "provider_not_espn":
      return {
        label: "CV board — not an ESPN league",
        title: "Only ESPN's rankings reach the platform, so a league elsewhere drafts off Court Vision's order",
      };
    default:
      return { label: "CV board", title: "Rows are in Court Vision's order" };
  }
}

/**
 * The sort key to actually use. The store persists the last column across
 * reloads, and across *rooms* — so a fit or category sort chosen in a category
 * league would otherwise strand a points league on a column it does not have,
 * sorting every row by a null.
 */
export function sortableKey(key: BoardSortKey, columns: BoardColumn[]): BoardSortKey {
  return columns.some((column) => column.key === key) ? key : "board_rank";
}

/**
 * One category-need bar: where the roster sits between two standard deviations
 * behind pace and two ahead.
 *
 * `need` is already clamped to ±2 by the backend, and is positive when the
 * roster is *behind*. `share` is the fraction of the bar filled on the side
 * `side` names, so 0 need renders as nothing on either side of the centre rule
 * rather than as half a bar of something.
 */
export function needBar(need: number): { side: "behind" | "ahead"; share: number } {
  const clamped = Math.max(-2, Math.min(2, need));
  return { side: clamped >= 0 ? "behind" : "ahead", share: Math.abs(clamped) / 2 };
}

/**
 * How the roster zone should describe where its pace came from.
 *
 * `seats` means the opposing rosters were read; `tier` means they were
 * estimated from the draftable pool because too few teams have picked. The
 * distinction is the point — `seats_drafted` explains an estimate rather than
 * letting it imply a precision it does not have.
 */
export function paceLabel(meta: DraftBoardMeta | null): string | null {
  if (!meta || meta.value_kind !== "cat_value" || meta.category_need.length === 0) return null;
  const seats = meta.category_need.find((need) => need.seats != null)?.seats ?? null;
  if (meta.pace_source === "seats" && seats !== null) {
    return `vs ${seats - 1} team${seats - 1 === 1 ? "" : "s"}`;
  }
  const drafted = meta.seats_drafted ?? 0;
  return drafted > 0
    ? `estimated · ${drafted} team${drafted === 1 ? "" : "s"} have picked`
    : "estimated · nobody has picked yet";
}

/** Categories in reading order: the ones a roster is furthest behind in, first. */
export function needsByUrgency(meta: DraftBoardMeta | null): CategoryNeed[] {
  const needs = meta?.category_need ?? [];
  return [...needs].sort((a, b) => {
    if (a.punted !== b.punted) return a.punted ? 1 : -1;
    return b.need - a.need;
  });
}

/** How many rows the market says will not last until the caller's next pick. */
export function countAtRisk(rows: DraftBoardRow[]): number {
  return rows.filter((row) => row.availability === "gone").length;
}
