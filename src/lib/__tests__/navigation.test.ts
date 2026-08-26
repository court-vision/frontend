import { describe, expect, test } from "bun:test";
import { MOBILE_NAV, NAV_ITEMS, SIGNED_OUT_TAB_NAV, TAB_NAV } from "../navigation";

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
