import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pillBox, samePillBox } from "../seg-pill";

const seg = (offsetLeft: number, offsetWidth: number, offsetTop = 2, offsetHeight = 28) => ({ offsetLeft, offsetTop, offsetWidth, offsetHeight });

describe("the sliding pill's box", () => {
  test("covers the checked segment's offset box", () => {
    expect(pillBox(seg(64, 52))).toEqual({ x: 64, y: 2, w: 52, h: 28 });
  });

  test("is gone when nothing is checked", () => {
    expect(pillBox(null)).toBeNull();
    expect(pillBox(undefined)).toBeNull();
  });

  test("is gone while the rail is hidden, so it reappears in place instead of sliding in from the corner", () => {
    expect(pillBox(seg(0, 0, 0, 0))).toBeNull();
    expect(pillBox(seg(12, 40, 0, 0))).toBeNull();
  });

  test("an unchanged box is the same box, so a resize that moves nothing doesn't re-render the rail", () => {
    expect(samePillBox(pillBox(seg(64, 52)), pillBox(seg(64, 52)))).toBe(true);
    expect(samePillBox(pillBox(seg(64, 52)), pillBox(seg(64, 60)))).toBe(false);
    expect(samePillBox(null, null)).toBe(true);
    expect(samePillBox(null, pillBox(seg(64, 52)))).toBe(false);
  });
});

// The sliding pill was the only thing these desks used motion for, and it
// cost each of them about 42 KB br of first-load JS. A pill copied back from
// the Week desk would quietly bring the whole library back.
describe("desks that slide pills with SegRail", () => {
  const components = join(import.meta.dir, "../../components");
  for (const desk of ["scout", "dev", "draft"]) {
    test(`${desk} doesn't import motion`, () => {
      const dir = join(components, desk);
      const offenders = readdirSync(dir)
        .filter((f) => /\.tsx?$/.test(f))
        .filter((f) => /from\s+["']motion(\/[^"']*)?["']|import\(\s*["']motion/.test(readFileSync(join(dir, f), "utf8")));
      expect(offenders).toEqual([]);
    });
  }
});
