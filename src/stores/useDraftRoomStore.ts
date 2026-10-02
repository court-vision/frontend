import { create } from "zustand";
import { persist } from "zustand/middleware";
import { naturalDirection } from "@/lib/draft-board";
import type { BoardSortKey, BoardSource, PositionFilter, SortDirection } from "@/types/draft";

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
 * `boardSource` is whose rankings order the board: ESPN's published rank (the
 * default — the order an ESPN draft room shows) or Court Vision's, the opt-in.
 * It is sent to the API as `board` — it changes what comes back, not just how
 * it is displayed — and the sort opens on the gutter whichever is up. The
 * recommendation strip is not its business: that is always CV's picks, with
 * ESPN's rank on every card. `my_team` is Court Vision's board re-ordered for
 * the drafter's own roster.
 *
 * `playoffWeight` is how many regular-season games one fantasy-playoff game
 * counts as in Court Vision's value. Null leaves it to the server's default,
 * so a drafter who never touches the control follows that default if it moves.
 */
interface DraftRoomStore {
  boardSource: BoardSource;
  playoffWeight: number | null;
  sortKey: BoardSortKey;
  sortDirection: SortDirection;
  positionFilter: PositionFilter;
  hideCapped: boolean;
  onlyLikelyGone: boolean;
  search: string;
  /** The row keyboard actions apply to; null means "the first visible row". */
  highlightId: number | null;

  setBoardSource: (boardSource: BoardSource) => void;
  setPlayoffWeight: (playoffWeight: number | null) => void;
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
  boardSource: "espn" as BoardSource,
  playoffWeight: null as number | null,
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
  "boardSource" | "playoffWeight" | "sortKey" | "sortDirection" | "positionFilter" | "hideCapped"
>;

const PERSISTED_DEFAULTS: PersistedView = {
  boardSource: DEFAULT_VIEW.boardSource,
  playoffWeight: DEFAULT_VIEW.playoffWeight,
  sortKey: DEFAULT_VIEW.sortKey,
  sortDirection: DEFAULT_VIEW.sortDirection,
  positionFilter: DEFAULT_VIEW.positionFilter,
  hideCapped: DEFAULT_VIEW.hideCapped,
};

export const useDraftRoomStore = create<DraftRoomStore>()(
  persist(
    (set) => ({
      ...DEFAULT_VIEW,

      setBoardSource: (boardSource) => set({ boardSource }),
      setPlayoffWeight: (playoffWeight) => set({ playoffWeight }),
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
      // v1 moved the sort onto the board's own gutter; v2 replaced the strip's
      // `rankSource` with the board's `boardSource`. Either way an older state
      // lands on the defaults (ESPN's board, gutter sort) and every other
      // preference survives; the stale key is simply not carried over.
      version: 2,
      migrate: (persisted, version): PersistedView => {
        const { rankSource: _stale, ...rest } = ((persisted ?? {}) as Partial<PersistedView> & {
          rankSource?: unknown;
        });
        void _stale;
        const state: PersistedView = { ...PERSISTED_DEFAULTS, ...rest };
        if (version < 1) {
          return { ...state, sortKey: "board_rank", sortDirection: "asc", boardSource: "espn" };
        }
        if (version < 2) {
          return { ...state, boardSource: "espn" };
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
        boardSource: state.boardSource,
        playoffWeight: state.playoffWeight,
        sortKey: state.sortKey,
        sortDirection: state.sortDirection,
        positionFilter: state.positionFilter,
        hideCapped: state.hideCapped,
      }),
    }
  )
);
