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
 * `rankSource` picks whose board the room is drafting off: ESPN's ranking for
 * the league's format (the default) or Court Vision's own value. It is sent to
 * the API — it changes what comes back, not just how it is displayed — and
 * moves the sort to that source's column, because a board ordered by one
 * opinion while recommending from the other is the confusing half of both.
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

  /** Switching source re-sorts the board onto that source's own rank column. */
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

/** The column each source ranks by, and so the one its board opens on. */
const SORT_KEY_FOR: Record<RankSource, BoardSortKey> = {
  espn: "market_rank",
  cv: "cv_rank",
};

const DEFAULT_VIEW = {
  rankSource: "espn" as RankSource,
  sortKey: SORT_KEY_FOR.espn,
  sortDirection: "asc" as SortDirection,
  positionFilter: "all" as PositionFilter,
  hideCapped: false,
  onlyLikelyGone: false,
  search: "",
  highlightId: null as number | null,
};

export const useDraftRoomStore = create<DraftRoomStore>()(
  persist(
    (set) => ({
      ...DEFAULT_VIEW,

      setRankSource: (rankSource) =>
        set({
          rankSource,
          sortKey: SORT_KEY_FOR[rankSource],
          sortDirection: naturalDirection(SORT_KEY_FOR[rankSource]),
        }),
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
