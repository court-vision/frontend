import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DESK_THEMES, type DeskThemeId } from "@/components/desk/themes";
import { LANDING_DESKS, LANDING_SHOT_THEMES, landingShot } from "../landing";

const PUBLIC = join(import.meta.dir, "..", "..", "..", "public");

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

  test("a theme without pictures shows the default theme on its side", () => {
    expect(landingShot("week", "chalk")).toBe("/landing/week-chalk.webp");
    // As if a theme had been added after the pictures were taken
    expect(landingShot("week", "dusk" as DeskThemeId)).toBe("/landing/week-noon.webp");
  });
});
