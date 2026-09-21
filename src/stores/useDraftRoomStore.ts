import { create } from "zustand";
import { persist } from "zustand/middleware";
import { naturalDirection } from "@/lib/draft-board";
import type { BoardSortKey, PositionFilter, RankSource, SortDirection } from "@/types/draft";

/**
 * How the room's board is being looked at — sort, position filter, and the
 * ESPN-style "hide capped" toggle. Per-viewer preferences that should survive a
 * reload mid-draft, not shareable state, so they live here rather than in the
 * URL (the `useRankingsParams` split).
 *
 * `hideCapped` defaults OFF on purpose: the board's contract is that a
 * cap-blocked player is shown greyed with a CAP badge so the user can see *why*
 * he is unpickable. ESPN's own draft room hides them, so the toggle exists —
 * but transparency is the default.
 *
 * `rankSource` picks what orders the recommendation strip: Court Vision's
 * room-aware picks (the default) or the best still available on ESPN's board.
 * It is sent to the API — it changes what comes back, not just how it is
 * displayed. The board's own order is not its business: the server decides
 * whose rank fills the gutter (`meta.rank_basis`), and the sort opens on that
 * column whichever opinion the strip is showing.
 */
interface DraftRoomStore {
  rankSource: RankSource;
  sortKey: BoardSortKey;
  sortDirection: SortDirection;
  positionFilter: PositionFilter;
  hideCapped: boolean;
  onlyLikelyGone: boolean;
  search: string;
  /** The row keyboard actions apply to; null means "the first visible row". */
  highlightId: number | null;

  setRankSource: (rankSource: RankSource) => void;
  /** Sorting the current column flips it; a new column starts on its natural side. */
  toggleSort: (key: BoardSortKey) => void;
  setPositionFilter: (position: PositionFilter) => void;
  setHideCapped: (hide: boolean) => void;
  setOnlyLikelyGone: (only: boolean) => void;
  setSearch: (search: string) => void;
  setHighlight: (highlightId: number | null) => void;
  resetView: () => void;
}

const DEFAULT_VIEW = {
  rankSource: "cv" as RankSource,
  sortKey: "board_rank" as BoardSortKey,
  sortDirection: "asc" as SortDirection,
  positionFilter: "all" as PositionFilter,
  hideCapped: false,
  onlyLikelyGone: false,
  search: "",
  highlightId: null as number | null,
};

/** What survives a reload: the view preferences, never the transient state. */
type PersistedView = Pick<
  DraftRoomStore,
  "rankSource" | "sortKey" | "sortDirection" | "positionFilter" | "hideCapped"
>;

const PERSISTED_DEFAULTS: PersistedView = {
  rankSource: DEFAULT_VIEW.rankSource,
  sortKey: DEFAULT_VIEW.sortKey,
  sortDirection: DEFAULT_VIEW.sortDirection,
  positionFilter: DEFAULT_VIEW.positionFilter,
  hideCapped: DEFAULT_VIEW.hideCapped,
};

export const useDraftRoomStore = create<DraftRoomStore>()(
  persist(
    (set) => ({
      ...DEFAULT_VIEW,

      setRankSource: (rankSource) => set({ rankSource }),
      toggleSort: (key) =>
        set((state) =>
          state.sortKey === key
            ? { sortDirection: state.sortDirection === "asc" ? "desc" : "asc" }
            : { sortKey: key, sortDirection: naturalDirection(key) }
        ),
      setPositionFilter: (positionFilter) => set({ positionFilter }),
      setHideCapped: (hideCapped) => set({ hideCapped }),
      setOnlyLikelyGone: (onlyLikelyGone) => set({ onlyLikelyGone }),
      setSearch: (search) => set({ search }),
      setHighlight: (highlightId) => set({ highlightId }),
      resetView: () => set({ ...DEFAULT_VIEW }),
    }),
    {
      name: "draft-room-store",
      // v1: the strip opens on CV's picks and the sort on the board's own
      // gutter. Anyone who persisted the earlier ESPN-toggle state (source
      // `espn`, sort `market_rank`) lands on the new defaults; every other
      // preference survives.
      version: 1,
      migrate: (persisted, version): PersistedView => {
        const state: PersistedView = { ...PERSISTED_DEFAULTS, ...((persisted ?? {}) as Partial<PersistedView>) };
        if (version < 1) {
          return { ...state, rankSource: "cv", sortKey: "board_rank", sortDirection: "asc" };
        }
        return state;
      },
      // `search`, `highlightId` and `onlyLikelyGone` are deliberately not
      // persisted: a stale filter on reload would look like an empty board,
      // and a stale highlight would aim a keystroke at a player who may have
      // left it. "Likely gone" is the sharpest case of the first — a board
      // with no market data has no `gone` rows at all, so a remembered filter
      // would open an empty room.
      partialize: (state) => ({
        rankSource: state.rankSource,
        sortKey: state.sortKey,
        sortDirection: state.sortDirection,
        positionFilter: state.positionFilter,
        hideCapped: state.hideCapped,
      }),
    }
  )
);
