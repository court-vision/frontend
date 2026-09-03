import { create } from "zustand";
import { persist } from "zustand/middleware";
import { naturalDirection } from "@/lib/draft-board";
import type { BoardSortKey, PositionFilter, SortDirection } from "@/types/draft";

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
 */
interface DraftRoomStore {
  sortKey: BoardSortKey;
  sortDirection: SortDirection;
  positionFilter: PositionFilter;
  hideCapped: boolean;
  search: string;
  /** The row keyboard actions apply to; null means "the first visible row". */
  highlightId: number | null;

  /** Sorting the current column flips it; a new column starts on its natural side. */
  toggleSort: (key: BoardSortKey) => void;
  setPositionFilter: (position: PositionFilter) => void;
  setHideCapped: (hide: boolean) => void;
  setSearch: (search: string) => void;
  setHighlight: (highlightId: number | null) => void;
  resetView: () => void;
}

const DEFAULT_VIEW = {
  sortKey: "cv_rank" as BoardSortKey,
  sortDirection: "asc" as SortDirection,
  positionFilter: "all" as PositionFilter,
  hideCapped: false,
  search: "",
  highlightId: null as number | null,
};

export const useDraftRoomStore = create<DraftRoomStore>()(
  persist(
    (set) => ({
      ...DEFAULT_VIEW,

      toggleSort: (key) =>
        set((state) =>
          state.sortKey === key
            ? { sortDirection: state.sortDirection === "asc" ? "desc" : "asc" }
            : { sortKey: key, sortDirection: naturalDirection(key) }
        ),
      setPositionFilter: (positionFilter) => set({ positionFilter }),
      setHideCapped: (hideCapped) => set({ hideCapped }),
      setSearch: (search) => set({ search }),
      setHighlight: (highlightId) => set({ highlightId }),
      resetView: () => set({ ...DEFAULT_VIEW }),
    }),
    {
      name: "draft-room-store",
      // `search` and `highlightId` are deliberately not persisted: a stale
      // filter on reload would look like an empty board, and a stale highlight
      // would aim a keystroke at a player who may have left it.
      partialize: (state) => ({
        sortKey: state.sortKey,
        sortDirection: state.sortDirection,
        positionFilter: state.positionFilter,
        hideCapped: state.hideCapped,
      }),
    }
  )
);
