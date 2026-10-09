import { describe, expect, test } from "bun:test";
import { isDeskDemo, isDeskPath } from "@/components/desk/routes";

/** What the proxy asks of a request URL. */
function opensSignedOut(url: string): boolean {
  const u = new URL(url, "https://www.courtvision.dev");
  return isDeskDemo(u.pathname, u.searchParams);
}

describe("isDeskDemo", () => {
  test("a desk's own demo opens signed out", () => {
    for (const url of [
      "/week?demo",
      "/week?view=players&demo",
      "/lab?demo",
      "/lab?demo=1",
      "/lab/demo-3",
      "/lab/demo-3/",
      "/lab/demo-3/recap",
      "/scout?demo",
      "/dev?demo",
    ]) {
      expect(opensSignedOut(url)).toBe(true);
    }
  });

  test("?demo on any route that needed sign-in before the desks changes nothing", () => {
    // Every route src/proxy.ts protected before the desks. At the cutover the
    // Draft desk moves to /draft and its demo URLs there join the list above.
    for (const url of [
      "/your-teams?demo",
      "/lineup-generation?demo",
      "/manage-lineups?demo",
      "/manage-teams?demo",
      "/manage-teams/connect?demo",
      "/draft?demo",
      "/draft/12?demo",
      "/draft/demo-3",
      "/matchup?demo",
      "/streamers?demo",
      "/query-builder/manage-tables?demo",
    ]) {
      expect(opensSignedOut(url)).toBe(false);
    }
  });

  test("a live room, or anything else under the Draft desk, still needs sign-in", () => {
    for (const url of [
      "/lab",
      "/lab/12",
      "/lab/12?demo",
      "/lab/12/recap?demo",
      "/lab/demo-3/settings",
      "/lab/demo-x",
      "/lab/demo-",
      "/lab-demo-3",
      "/laboratory?demo",
      "/week",
      "/week/players?demo",
      "/weekly?demo",
      "/scout/203999?demo",
      "/scouting?demo",
      "/developer?demo",
      "/dev/keys?demo",
    ]) {
      expect(opensSignedOut(url)).toBe(false);
    }
  });
});

describe("isDeskPath", () => {
  test("the desks and everything under them", () => {
    for (const path of ["/week", "/week/", "/lab", "/lab/12", "/lab/demo-3/recap", "/scout", "/scout/", "/dev", "/dev/"]) {
      expect(isDeskPath(path)).toBe(true);
    }
  });

  test("never a route that only starts with a desk's name", () => {
    for (const path of ["/", "/weekly", "/weekend", "/labs", "/laboratory", "/draft", "/rankings", "/terminal", "/scouting", null, undefined, "/developer", "/devices"]) {
      expect(isDeskPath(path)).toBe(false);
    }
  });
});
