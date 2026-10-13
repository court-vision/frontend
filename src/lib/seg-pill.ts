/**
 * Where a segmented rail's sliding pill sits: over the checked segment, in
 * the rail's padding box. The rail is the segments' offset parent, so the
 * segment's offset box is exactly the pill's box.
 */
export interface PillBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

type SegmentBox = Pick<HTMLElement, "offsetLeft" | "offsetTop" | "offsetWidth" | "offsetHeight">;

/**
 * The pill's box for the checked segment, or null when there is none to
 * cover: no segment is checked, or the rail is hidden and has no layout. A
 * null box removes the pill, so when the rail shows again the pill appears
 * in place instead of sliding in from the corner.
 */
export function pillBox(seg: SegmentBox | null | undefined): PillBox | null {
  if (!seg || seg.offsetWidth <= 0 || seg.offsetHeight <= 0) return null;
  return { x: seg.offsetLeft, y: seg.offsetTop, w: seg.offsetWidth, h: seg.offsetHeight };
}

export function samePillBox(a: PillBox | null, b: PillBox | null): boolean {
  if (a === null || b === null) return a === b;
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}
