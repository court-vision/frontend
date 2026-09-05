"use client";

import { useMemo } from "react";

import { visibleRows, type BoardView } from "@/lib/draft-board";
import { useDraftRoomStore } from "@/stores/useDraftRoomStore";
import type { DraftBoardRow } from "@/types/draft";

/**
 * The one place a `BoardView` is assembled.
 *
 * Two components render the same rows — the room, to know what a keystroke
 * acts on, and the table, to know what to draw — and they used to build the
 * view object independently. A predicate added to one and not the other aims
 * `o`/`m` at a row the user cannot see, and picks the wrong player without
 * saying anything. One hook, one object, no way to diverge.
 */
export function useBoardView(): BoardView {
  const { sortKey, sortDirection, positionFilter, hideCapped, onlyLikelyGone, search } =
    useDraftRoomStore();
  return useMemo(
    () => ({ sortKey, sortDirection, positionFilter, hideCapped, onlyLikelyGone, search }),
    [sortKey, sortDirection, positionFilter, hideCapped, onlyLikelyGone, search]
  );
}

/** The rows the board shows, filtered and sorted by the shared view. */
export function useVisibleRows(rows: DraftBoardRow[]): DraftBoardRow[] {
  const view = useBoardView();
  return useMemo(() => visibleRows(rows, view), [rows, view]);
}
