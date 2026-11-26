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
import { monthDay } from "@/lib/scout";
import type {
  Availability,
  BoardSortKey,
  CategoryNeed,
  DraftBoardMeta,
  DraftBoardRow,
  DraftLiveRanks,
  DraftPlayoffs,
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

/**
 * A calendar day as a number that sorts, 20261119 for "2026-11-19". A number
 * rather than the string so that the many players ESPN moved on the same
 * morning tie, and fall back to board order like every other tie.
 */
function dayNumber(iso: string | null | undefined): number | null {
  const n = iso ? Number(iso.slice(0, 10).replaceAll("-", "")) : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

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
    case "move_7d":
      return row.move_7d ?? null;
    case "move_1d":
      return row.move_1d ?? null;
    case "espn_rank_since":
      return dayNumber(row.espn_rank_since);
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
    case "playoff_games":
      return row.playoff_games;
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
  /**
   * Set on a column the board shows only while there is room for it
   * (`columnsThatFit`): what it says is also a tooltip on the rank it is
   * about, so a narrow board gives it up before it pushes another column off
   * the screen. The column with the lowest number steps aside first.
   */
  yields?: number;
}

const CV_RANK: BoardColumn = {
  key: "cv_rank", label: "CV", className: "w-12", align: "right", sortable: true,
  title: "Court Vision's rank over the full pool — stable all draft long",
};
const ESPN_RANK: BoardColumn = {
  key: "market_rank", label: "ESPN", className: "w-14", align: "right", sortable: true,
  title: "ESPN's published draft rank for this league's format",
};

/**
 * The ranks that are *not* the gutter: the other opinions, beside the name.
 * `my_team`'s gutter is this roster's own order, so both pool-wide opinions sit
 * beside it.
 *
 * In season each opinion brings what the stored daily boards know about it:
 * the places he moved on Court Vision's board follow its rank, and the morning
 * ESPN's rank became what it is follows ESPN's. Where a rank is the gutter its
 * companion keeps the place the rank would have had.
 */
function rankColumns(basis: RankBasis, live: DraftLiveRanks | null): BoardColumn[] {
  const move = moveColumn(live);
  const since = espnSinceColumn(live);
  return [
    ...(basis === "cv" ? [] : [CV_RANK]),
    ...(move ? [move] : []),
    ...(basis === "espn" ? [] : [live?.espn_as_of ? espnRankToday(live.espn_as_of) : ESPN_RANK]),
    ...(since ? [since] : []),
  ];
}

/** ESPN's rank column once the board reads it from that morning's stored ranks. */
function espnRankToday(asOf: string): BoardColumn {
  return {
    ...ESPN_RANK,
    title: `ESPN's rank for this league's format on ${monthDay(asOf)}: the one its own room shows today`,
  };
}

/** "standard points board", "standard nine-category board": which stored board a move is on. */
function standardBoard(live: DraftLiveRanks): string {
  return live.board === "categories" ? "standard nine-category board" : "standard points board";
}

/**
 * Which span the move column reads: a week when a board about a week back is
 * stored, a day while only the previous morning's is, and none before either.
 */
export function moveSpan(live: DraftLiveRanks | null | undefined): "week" | "day" | null {
  if (!live?.as_of) return null;
  if (live.week) return "week";
  return live.day ? "day" : null;
}

function moveColumn(live: DraftLiveRanks | null): BoardColumn | null {
  const span = moveSpan(live);
  if (!live || !span) return null;
  const from = monthDay((span === "week" ? live.week : live.day) as string);
  return {
    key: span === "week" ? "move_7d" : "move_1d",
    label: span === "week" ? "7D" : "1D",
    className: "w-12",
    align: "right",
    sortable: true,
    // The last of the two to go: the same numbers are the tooltip on Court Vision's rank.
    yields: 2,
    title:
      `Places gained on Court Vision's ${standardBoard(live)} since ${from}` +
      (span === "day" ? ", the previous stored morning (a week of boards is not stored yet)" : "") +
      ". A league with scoring of its own ranks players a little differently: this is the standard board's move",
  };
}

function espnSinceColumn(live: DraftLiveRanks | null): BoardColumn | null {
  if (!live?.espn_as_of) return null;
  return {
    key: "espn_rank_since",
    label: "ESPN since",
    className: "w-20",
    align: "right",
    sortable: true,
    // The first to go: the same sentence is the tooltip on ESPN's rank, wherever that is.
    yields: 1,
    title:
      "The morning ESPN's rank for him became what it is today. " +
      "≤ marks a rank held since the first morning its ranks were stored: at least that old",
  };
}

/** "+6" in words, against one earlier board: "up 6 since Nov 16". */
function placesSince(move: number | null | undefined, day: string): string {
  const when = monthDay(day);
  if (move == null) return `no rank to compare on ${when}`;
  if (move === 0) return `where he was on ${when}`;
  return `${move > 0 ? "up" : "down"} ${Math.abs(move)} since ${when}`;
}

/**
 * The move cell's tooltip: both spans, each against the day it is measured
 * from, and whose board the places are on. Null when no board is stored to
 * measure against.
 */
export function moveDetail(
  row: Pick<DraftBoardRow, "move_1d" | "move_7d">,
  live: DraftLiveRanks | null | undefined
): string | null {
  if (!live?.as_of) return null;
  const parts: string[] = [];
  if (live.week) parts.push(placesSince(row.move_7d, live.week));
  if (live.day) parts.push(placesSince(row.move_1d, live.day));
  if (parts.length === 0) return null;
  return `On Court Vision's ${standardBoard(live)}: ${parts.join(", ")}`;
}

/**
 * The morning ESPN's rank became what it is, as the cell prints it: "Nov 19",
 * or "≤ Nov 12" when the rank has stood since the first morning its ranks were
 * stored and so may be older than that.
 */
export function espnSinceText(
  row: Pick<DraftBoardRow, "espn_rank_since" | "espn_rank_since_first_stored">
): string | null {
  if (!row.espn_rank_since) return null;
  return `${row.espn_rank_since_first_stored ? "≤ " : ""}${monthDay(row.espn_rank_since)}`;
}

/** The same in a sentence, with the rank it is about. */
export function espnSinceDetail(
  row: Pick<DraftBoardRow, "market_rank" | "espn_rank_since" | "espn_rank_since_first_stored">
): string | null {
  if (!row.espn_rank_since || row.market_rank == null) return null;
  const day = monthDay(row.espn_rank_since);
  return row.espn_rank_since_first_stored
    ? `ESPN has ranked him ${row.market_rank} since at least ${day}, the first morning its ranks were stored`
    : `ESPN has ranked him ${row.market_rank} since ${day}`;
}

const GUTTER_TITLE: Record<RankBasis, string> = {
  espn: "ESPN's published rank for this league's format — the board you are drafting off",
  cv: "CV rank over the full pool — stable all draft long",
  my_team:
    "Court Vision's rank for your roster: value over replacement under your punts, " +
    "less the starts your lineup could not use. It moves with every pick",
};

/**
 * The columns every league has, in order. `Fit` slots in after `Value`.
 *
 * One rank sits in the gutter and the others beside the name, never the same
 * number twice: in an ESPN room the gutter is ESPN's published rank and the
 * column is CV's; in a room CV orders it is the other way round; on the
 * `my_team` board the gutter is this roster's own order and both sit beside it.
 *
 * `PO` — his team's games in the league's fantasy-playoff weeks — is there
 * whenever the league has playoff weeks to count (a roto league has none).
 *
 * A board read in season adds two columns from the stored daily boards
 * (`rankColumns`): the places he moved, and how long ESPN's rank has stood.
 */
function baseColumns(
  basis: RankBasis,
  playoffs: DraftPlayoffs | null,
  live: DraftLiveRanks | null
): BoardColumn[] {
  const columns: BoardColumn[] = [
    { key: "board_rank", label: "#", className: "w-10", align: "center", sortable: true,
      title: GUTTER_TITLE[basis] },
    { key: "name", label: "Player", className: "flex-[3] min-w-[180px]", align: "left", sortable: true },
    { key: "value", label: "Value", className: "w-16", align: "right", sortable: true,
      title: "Per-game value under this league's scoring" },
    ...rankColumns(basis, live),
    { key: "adp", label: "ADP", className: "w-14", align: "right", sortable: true,
      title: "Average draft position across real ESPN drafts" },
    { key: "market_delta", label: "Δ", className: "w-12", align: "right", sortable: true,
      title: "ESPN rank − CV rank; positive means CV likes him more than ESPN does" },
    { key: "projected_gp", label: "GP", className: "w-12", align: "right", sortable: true,
      title: "Projected games this season" },
  ];
  if (playoffs) {
    columns.push({
      key: "playoff_games", label: "PO", className: "w-12", align: "right", sortable: true,
      title:
        `Games his team plays in your fantasy playoffs (${playoffs.label}). ` +
        `Teams play ${playoffs.games_min}–${playoffs.games_max}; the average is ${playoffs.games_mean}`,
    });
  }
  return columns;
}

/** "2×", "1.5×": a playoff weight as the control shows it. */
export function playoffWeightLabel(weight: number): string {
  return `${Number.isInteger(weight) ? weight : weight.toFixed(1)}×`;
}

/**
 * How a player's playoff schedule compares with the league's: a game or more
 * above the average team's is `high`, a game or more below is `low`. Null in
 * between, and whenever there is nothing to compare — a tint has to mean
 * something.
 */
export function playoffTone(
  games: number | null | undefined,
  playoffs: DraftPlayoffs | null | undefined
): "high" | "low" | null {
  if (games == null || !playoffs || playoffs.games_max === playoffs.games_min) return null;
  if (games >= playoffs.games_mean + 1) return "high";
  if (games <= playoffs.games_mean - 1) return "low";
  return null;
}

/**
 * The playoff cell's tooltip: the games week by week, and how many fall on
 * light nights — seven or fewer NBA games, when a daily-lineup manager can
 * nearly always start him.
 */
export function playoffDetail(
  row: Pick<DraftBoardRow, "team" | "playoff_games" | "playoff_light_games" | "playoff_games_by_week">,
  playoffs: DraftPlayoffs | null | undefined
): string | null {
  if (row.playoff_games == null || !playoffs) return null;
  const weeks = row.playoff_games_by_week ?? [];
  const byWeek =
    weeks.length === playoffs.weeks.length && weeks.length > 0
      ? `: ${playoffs.weeks.map((week, i) => `wk ${week} · ${weeks[i]}`).join(", ")}`
      : "";
  const light =
    row.playoff_light_games != null ? ` ${row.playoff_light_games} on light nights.` : "";
  return (
    `${row.team ?? "His team"} plays ${row.playoff_games} in the fantasy playoffs${byWeek}.` +
    `${light} League average ${playoffs.games_mean}.`
  );
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
  const base = baseColumns(meta?.rank_basis ?? "cv", meta?.playoffs ?? null, meta?.live_ranks ?? null);
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
 * How many of the columns that can step aside (`yields`) have to, for the rest
 * to fit `width` at their floors: 0 when everything fits, 1 when the first to
 * go must, and so on. A category board is twenty columns wide before the
 * season adds any, so on a laptop it has no width to spare, and a column the
 * season adds must not be what pushes a category off the screen.
 *
 * The column the board is sorted by never steps aside (`columnsThatFit` keeps
 * it), so its width is not width to be won back: sorted by ESPN's age, a board
 * with room for only one of the two gives up the move instead.
 */
export function yieldsNeeded(
  columns: BoardColumn[],
  width: number,
  floorOf: (column: BoardColumn) => number,
  sortKey: BoardSortKey
): number {
  const gives = (c: BoardColumn) => (c.yields && c.key !== sortKey ? c.yields : 0);
  const levels = [...new Set(columns.map(gives).filter((level) => level > 0))].sort((a, b) => a - b);
  let need = columns.reduce((sum, c) => sum + floorOf(c), 0);
  let level = 0;
  for (const next of levels) {
    if (need <= width) break;
    need -= columns.filter((c) => gives(c) === next).reduce((sum, c) => sum + floorOf(c), 0);
    level = next;
  }
  return level;
}

/**
 * The columns to draw once `level` of them have stepped aside. One the board
 * is sorted by stays, so a sort never loses its header.
 */
export function columnsThatFit(
  columns: BoardColumn[],
  level: number,
  sortKey: BoardSortKey
): BoardColumn[] {
  const kept = columns.filter((c) => !c.yields || c.yields > level || c.key === sortKey);
  return kept.length === columns.length ? columns : kept;
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
    // In season the ranks are that morning's stored ones, not the preseason snapshot's.
    const day = meta.live_ranks?.espn_as_of ?? meta.market_as_of;
    const asOf = day ? ` · as of ${day}` : "";
    return {
      label: `ESPN ${board} board${asOf}`,
      title:
        "Rows are in ESPN's published draft order for this league's format; " +
        "Court Vision's rank is the column beside the name",
    };
  }
  if (meta.rank_basis === "my_team") {
    return {
      label: "CV board for your team",
      title:
        "Court Vision's rankings re-ordered for your roster: value over replacement under your " +
        "punts, less the starts your lineup could not use. Its own and ESPN's ranks are beside the name",
    };
  }
  switch (meta.rank_basis_reason) {
    case "caller_chose_cv":
      return {
        label: "Court Vision board",
        title: "You chose Court Vision's rankings; ESPN's rank is the column beside the name",
      };
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
 * How fresh ESPN's numbers are, for the status bar. Before opening night one
 * snapshot dates both the ranks and ADP. In season the ranks are that
 * morning's while ADP stays the last preseason snapshot's, so the line dates
 * each.
 */
export function marketNote(meta: DraftBoardMeta | null): string | null {
  if (!meta) return null;
  const ranks = meta.live_ranks?.espn_as_of ?? null;
  if (ranks) {
    return `ESPN ranks as of ${ranks}` + (meta.market_as_of ? ` · ADP as of ${meta.market_as_of}` : "");
  }
  return meta.market_as_of ? `ESPN market as of ${meta.market_as_of}` : null;
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
