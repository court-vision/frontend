import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DESK_THEMES, type DeskThemeId } from "@/components/desk/themes";
import { LANDING_DESKS, LANDING_SHOT_SIZE, LANDING_SHOT_THEMES, landingShot } from "../landing";

const PUBLIC = join(import.meta.dir, "..", "..", "..", "public");

/** A WebP file's width and height, read from its first chunk (lossless, extended or lossy). */
function webpSize(file: string): { width: number; height: number } | null {
  const b = readFileSync(file);
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") return null;
  const chunk = b.toString("ascii", 12, 16);
  if (chunk === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
  if (chunk === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  return null;
}

describe("the landing page's desk pictures", () => {
  test("are taken in every desk theme", () => {
    // A new theme needs its pictures: node scripts/landing-shots.mjs, then list it in LANDING_SHOT_THEMES
    expect([...LANDING_SHOT_THEMES].sort()).toEqual(DESK_THEMES.map((t) => t.id).sort());
  });

  test("exist for every desk in every theme they were taken in", () => {
    const missing = LANDING_DESKS.flatMap((d) =>
      LANDING_SHOT_THEMES.map((t) => landingShot(d.id, t)).filter((src) => !existsSync(join(PUBLIC, src)))
    );
    expect(missing).toEqual([]);
  });

  test("are taken at twice the pixels, so they stay sharp on high-density screens", () => {
    // node scripts/landing-shots.mjs takes them at this size
    const wrong = LANDING_DESKS.flatMap((d) => LANDING_SHOT_THEMES.map((t) => landingShot(d.id, t)))
      .filter((src) => existsSync(join(PUBLIC, src)))
      .filter((src) => {
        const size = webpSize(join(PUBLIC, src));
        return size?.width !== LANDING_SHOT_SIZE.width || size?.height !== LANDING_SHOT_SIZE.height;
      });
    expect(wrong).toEqual([]);
  });

  test("a theme without pictures shows the default theme on its side", () => {
    expect(landingShot("week", "chalk")).toBe("/landing/week-chalk.webp");
    // As if a theme had been added after the pictures were taken
    expect(landingShot("week", "dusk" as DeskThemeId)).toBe("/landing/week-noon.webp");
  });
});
