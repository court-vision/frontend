/**
 * The Week tape's one open box (today's moves or the edge's race), how it
 * was opened, and the keys the desk leaves to it. Pure.
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

/** The desk's keys for the tape's boxes: D today's moves, E the edge's race. */
const TAPE_KEYS = ["d", "e"];

/** Where a key belongs to what it was typed in: a field, a menu, a dialog, the market or the tray. */
const KEY_OWNERS = "input, textarea, select, [contenteditable='true'], [cmdk-root], [role='dialog'], [data-market], [data-tray]";

/**
 * Whether the Week desk leaves a key to the element it was pressed in. Inside
 * a tape box the box keeps Esc, its own key and the arrows (and stops them)
 * and the desk's other keys do nothing, but the tape's keys still reach the
 * desk: the other box's key switches to it even with focus inside this one.
 */
export function keyStaysIn(target: { closest(selector: string): unknown } | null, key: string): boolean {
  if (target?.closest(KEY_OWNERS)) return true;
  return target?.closest("[data-tickbox]") != null && !TAPE_KEYS.includes(key);
}
