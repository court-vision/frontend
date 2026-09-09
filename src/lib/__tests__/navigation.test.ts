import { describe, expect, test } from "bun:test";
import { DESKTOP_NAV, MOBILE_NAV, NAV_ITEMS, SIGNED_OUT_TAB_NAV, TAB_NAV } from "../navigation";

describe("phone navigation", () => {
  test("signed-in tab bar is Matchup, Streamers, Rankings, Teams", () => {
    expect(TAB_NAV.map((i) => i.href)).toEqual([
      "/matchup",
      "/streamers",
      "/rankings",
      "/your-teams",
    ]);
  });

  test("signed-out tab bar is Home, Rankings, Playoffs", () => {
    expect(SIGNED_OUT_TAB_NAV.map((i) => i.href)).toEqual(["/", "/rankings", "/playoffs"]);
  });

  test("desktop-only pages stay out of the phone sheet but keep their desktop tab", () => {
    const sheet = MOBILE_NAV.map((i) => i.href);
    expect(sheet).not.toContain("/terminal");
    expect(sheet).not.toContain("/query-builder");
    expect(sheet).toContain("/manage-teams");
    for (const href of ["/terminal", "/query-builder"]) {
      expect(NAV_ITEMS.find((i) => i.href === href)?.desktop).toBe(true);
    }
  });

  test("every tab destination is also reachable from the sheet", () => {
    for (const item of [...TAB_NAV, ...SIGNED_OUT_TAB_NAV]) {
      expect(MOBILE_NAV).toContain(item);
    }
  });
});

describe("desktop navigation", () => {
  test("tab bar is Home, Teams, Matchup, Streamers, Rankings, Draft, Terminal, SQL", () => {
    expect(DESKTOP_NAV.map((i) => i.href)).toEqual([
      "/",
      "/your-teams",
      "/matchup",
      "/streamers",
      "/rankings",
      "/draft",
      "/terminal",
      "/query-builder",
    ]);
  });

  test("playoffs keeps its route and off-tab entries but has no desktop tab", () => {
    const playoffs = NAV_ITEMS.find((i) => i.href === "/playoffs");
    expect(playoffs?.desktop).toBeUndefined();
    expect(MOBILE_NAV).toContain(playoffs as never);
    expect(playoffs?.palette).toBe(true);
  });

  // The header comment promises this; ⌥9/⌥0 are the two pages with no desktop tab.
  test("⌥1-8 mirror the desktop tab order", () => {
    expect(DESKTOP_NAV.map((i) => i.altDigit)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test("every ⌥ digit and ⌘ letter is unique", () => {
    const digits = NAV_ITEMS.map((i) => i.altDigit).filter((d) => d !== undefined);
    expect(new Set(digits).size).toBe(digits.length);
    const letters = NAV_ITEMS.map((i) => i.cmdKey).filter((k) => k !== undefined);
    expect(new Set(letters).size).toBe(letters.length);
  });
});
