"use client";

import { useMemo } from "react";

import { columnsFor, sortableKey, visibleRows, type BoardView } from "@/lib/draft-board";
import { useDraftRoomStore } from "@/stores/useDraftRoomStore";
import type { DraftBoardMeta, DraftBoardRow } from "@/types/draft";

/**
 * The one place a `BoardView` is assembled.
 *
 * Two components render the same rows — the room, to know what a keystroke
 * acts on, and the table, to know what to draw — and they used to build the
 * view object independently. A predicate added to one and not the other aims
 * `o`/`m` at a row the user cannot see, and picks the wrong player without
 * saying anything. One hook, one object, no way to diverge.
 */
export function useBoardView(meta: DraftBoardMeta | null = null): BoardView {
  const { sortKey, sortDirection, positionFilter, hideCapped, onlyLikelyGone, search } =
    useDraftRoomStore();
  // The store remembers the last sort across reloads *and* across rooms, so a
  // fit or category column chosen in a category league has to be sent back to
  // the big board when the next room is scored by points.
  const key = useMemo(() => sortableKey(sortKey, columnsFor(meta)), [sortKey, meta]);
  return useMemo(
    () => ({ sortKey: key, sortDirection, positionFilter, hideCapped, onlyLikelyGone, search }),
    [key, sortDirection, positionFilter, hideCapped, onlyLikelyGone, search]
  );
}

/** The rows the board shows, filtered and sorted by the shared view. */
export function useVisibleRows(
  rows: DraftBoardRow[],
  meta: DraftBoardMeta | null = null
): DraftBoardRow[] {
  const view = useBoardView(meta);
  return useMemo(() => visibleRows(rows, view), [rows, view]);
}
