"use client";

import { useEffect } from "react";

/**
 * Draft-room keys, terminal-style: `/` to the pick input, `j`/`k` (or the
 * arrows) over the board, `o` and `m` to mark the highlighted player out or
 * mine, `d` to send the highlighted player to ESPN as your pick (only wired
 * when the Draft Tap can write), ⌘Z to undo the last pick. Typing contexts are
 * left alone — the pick input has its own handler — and an open dialog owns
 * the keyboard.
 */
export interface DraftRoomHotkeys {
  enabled: boolean;
  focusInput: () => void;
  moveHighlight: (delta: 1 | -1) => void;
  markHighlighted: (byMe: boolean) => void;
  undoLast: () => void;
  /** Absent when the room cannot draft on ESPN; `d` then does nothing. */
  draftHighlighted?: () => void;
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
  draftHighlighted,
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
        case "d":
          if (!draftHighlighted) break;
          e.preventDefault();
          draftHighlighted();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, focusInput, moveHighlight, markHighlighted, undoLast, draftHighlighted]);
}
