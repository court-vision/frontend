/**
 * The Week tape's one open box (today's moves or the edge's race) and how it
 * was opened. Pure.
 */

/** How a tick's box is open: under the pointer, pinned by a click, or from the keyboard. */
export type TickOpen = "hover" | "pinned" | "keyboard" | null;

export type TapeTick = "moves" | "edge";

/** One open box in the tape at a time: which tick, and how it was opened. */
export type TapeBox = { tick: TapeTick; how: Exclude<TickOpen, null> } | null;

/**
 * The tape's box after a tick asks to open its own (how) or to close it
 * (null). A hover never takes over a box that was pinned or opened from the
 * keyboard, the other tick's or its own (a click inside the hover's rest):
 * that box stays until its key, Esc or a press elsewhere.
 */
export function openTick(box: TapeBox, tick: TapeTick, how: TickOpen): TapeBox {
  if (how === "hover" && box && box.how !== "hover") return box;
  return how ? { tick, how } : box?.tick === tick ? null : box;
}
