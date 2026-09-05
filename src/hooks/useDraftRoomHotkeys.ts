"use client";

import { useEffect } from "react";

/**
 * Draft-room keys, terminal-style: `/` to the pick input, `j`/`k` (or the
 * arrows) over the board, `o` and `m` to mark the highlighted player out or
 * mine, `f` to sort by roster fit, `s` to run a mock up to your next pick,
 * ⌘Z to undo the last pick. Typing contexts are left alone — the pick
 * input has its own handler — and an open dialog owns the keyboard.
 */
export interface DraftRoomHotkeys {
  enabled: boolean;
  focusInput: () => void;
  moveHighlight: (delta: 1 | -1) => void;
  markHighlighted: (byMe: boolean) => void;
  undoLast: () => void;
  /** Absent in a points league, where there is no fit to sort by. */
  sortByFit?: () => void;
  /**
   * Absent unless this room is a mock the autopicker will play. Bound to "sim
   * to my pick" only — "sim to end" hands the autopicker your own seat, and a
   * key that can do that should not be one character away.
   */
  simulateToMyPick?: () => void;
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function useDraftRoomHotkeys({
  enabled,
  focusInput,
  moveHighlight,
  markHighlighted,
  undoLast,
  sortByFit,
  simulateToMyPick,
}: DraftRoomHotkeys) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      const withMeta = e.metaKey || e.ctrlKey;
      if (withMeta && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "z") {
        // In an input, ⌘Z is the browser's text undo; the pick input decides.
        if (isTyping(e.target)) return;
        e.preventDefault();
        undoLast();
        return;
      }
      if (withMeta || e.altKey || isTyping(e.target)) return;

      switch (e.key) {
        case "/":
          e.preventDefault();
          focusInput();
          break;
        case "j":
        case "ArrowDown":
          e.preventDefault();
          moveHighlight(1);
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          moveHighlight(-1);
          break;
        case "o":
          e.preventDefault();
          markHighlighted(false);
          break;
        case "m":
          e.preventDefault();
          markHighlighted(true);
          break;
        case "f":
          if (!sortByFit) break;
          e.preventDefault();
          sortByFit();
          break;
        case "s":
          if (!simulateToMyPick) break;
          e.preventDefault();
          simulateToMyPick();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, focusInput, moveHighlight, markHighlighted, undoLast, sortByFit, simulateToMyPick]);
}
