/**
 * Draft Lab types.
 *
 * Wire types are generated from the backend's OpenAPI schema (shim over
 * `src/types/generated/api.ts`; regenerate with `bun run generate:api`).
 *
 * Note the nullable value columns on a board row: a player ESPN ranks that
 * neither a projection nor last season's baseline can value (a rookie, before
 * projections are published) is on the board as a *market-only* row, with
 * `value`, `cv_rank` and `fpts_avg` all null and `value_source: "market"`.
 */
import type { components } from "./generated/api";

type S = components["schemas"];

export type DraftSession = S["DraftSessionResp"];
export type DraftPick = S["DraftPickResp"];
export type DraftBoardRow = S["DraftBoardRow"];
export type DraftBoardMeta = S["DraftBoardMeta"];
export type DraftRecommendation = S["DraftRecommendation"];
export type RecommendationComponent = S["RecommendationComponent"];
/** A player the caller has drafted, with what the roster zone needs to place him. */
export type DraftRosterEntry = S["DraftRosterEntry"];
/** A keeper as the session reports it: identity, round, and the pick that round costs. */
export type DraftKeeperOut = S["DraftKeeper-Output"];
export type PickSource = DraftPick["source"];

/** Where the caller's roster stands in one category, and what fit does about it. */
export type CategoryNeed = S["CategoryNeedResp"];
/** Whether a player is likely to survive to the caller's next pick. */
export type Availability = NonNullable<DraftBoardRow["availability"]>;

/** The result of reconciling a session with an ESPN INIT snapshot. */
export type DraftInitSync = S["DraftInitSyncResp"];
export type DraftInitSyncRequest = S["DraftInitSyncRequest"];
export type DraftSyncConflict = S["DraftSyncConflict"];

/** What the mock autopicker did, and the room it left behind. */
export type MockAdvance = S["MockAdvanceResp"];
/** How far to play a mock forward. `end` drafts your own seat too. */
export type MockUntil = S["MockAdvanceRequest"]["until"];
export type MockStopReason = MockAdvance["stopped_reason"];

/** Request bodies. The `-Input` variant is the one a client sends. */
export type DraftSessionCreate = S["DraftSessionCreate"];
export type DraftSessionUpdate = S["DraftSessionUpdate"];
export type DraftPickCreate = S["DraftPickCreate"];
export type DraftKeeper = S["DraftKeeper-Input"];

export type DraftKind = DraftSession["kind"];
export type DraftStatus = DraftSession["status"];
export type DraftType = DraftSession["draft_type"];
export type ValueSource = DraftBoardRow["value_source"];

/**
 * The board endpoint carries `meta` and `recommendations` as siblings of
 * `data`, so it cannot be plainly unwrapped — mirrors `RankingsResult`.
 */
export interface DraftBoardResult {
  rows: DraftBoardRow[];
  recommendations: DraftRecommendation[];
  /** The caller's drafted players — lineup slots, caps and stacking are computed from these. */
  roster: DraftRosterEntry[];
  meta: DraftBoardMeta | null;
  /** Backend message; explains an empty board (e.g. before any season data). */
  message: string;
}

/**
 * Board sort columns. `cv_rank` is the default: the big board's own order.
 *
 * `cat:<key>` sorts by one of the league's own categories, so the set is only
 * known once `meta.categories` arrives — hence the template literal rather
 * than an enumeration. `fit_rank` and the category keys exist only in a
 * category league; `columnsFor` is what decides, and `sortableKey` sends a
 * persisted key that this league has no column for back to `cv_rank`.
 */
export type BoardSortKey =
  | "cv_rank"
  | "name"
  | "value"
  | "fit_rank"
  | "market_rank"
  | "adp"
  | "market_delta"
  | "availability"
  | "projected_gp"
  | `cat:${string}`;

export type SortDirection = "asc" | "desc";

/** Position filter over a row's ESPN primary position; `all` disables it. */
export type PositionFilter = "all" | "PG" | "SG" | "SF" | "PF" | "C";

export const POSITION_FILTERS: PositionFilter[] = ["all", "PG", "SG", "SF", "PF", "C"];
