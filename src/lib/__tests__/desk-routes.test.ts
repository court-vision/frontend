import { describe, expect, test } from "bun:test";
import { isDeskDemo, isDeskPath, withFlagValues } from "@/components/desk/routes";

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
      "/draft?demo",
      "/draft?demo=1",
      "/draft/demo-3",
      "/draft/demo-3/",
      "/draft/demo-3/recap",
      "/scout?demo",
      "/developer?demo",
      "/account?demo",
      "/account?t=3&demo",
    ]) {
      expect(opensSignedOut(url)).toBe(true);
    }
  });

  test("?demo outside the desks changes nothing", () => {
    for (const url of ["/?demo", "/sign-in?demo", "/sign-up?demo", "/rankings?demo", "/drafts?demo"]) {
      expect(opensSignedOut(url)).toBe(false);
    }
  });

  test("a live room, or anything else under the Draft desk, still needs sign-in", () => {
    for (const url of [
      "/draft",
      "/draft/12",
      "/draft/12?demo",
      "/draft/12/recap?demo",
      "/draft/demo-3/settings",
      "/draft/demo-x",
      "/draft/demo-",
      "/draft-demo-3",
      "/drafting?demo",
      "/week",
      "/week/players?demo",
      "/weekly?demo",
      "/scout/203999?demo",
      "/scouting?demo",
      "/developers?demo",
      "/developer/keys?demo",
      "/account",
      "/account/teams?demo",
      "/accounts?demo",
    ]) {
      expect(opensSignedOut(url)).toBe(false);
    }
  });
});

describe("isDeskPath", () => {
  test("the desks and everything under them", () => {
    for (const path of [
      "/week",
      "/week/",
      "/draft",
      "/draft/12",
      "/draft/demo-3/recap",
      "/scout",
      "/scout/",
      "/developer",
      "/developer/",
      "/account",
      "/account/",
    ]) {
      expect(isDeskPath(path)).toBe(true);
    }
  });

  test("never a route that only starts with a desk's name", () => {
    for (const path of ["/", "/weekly", "/weekend", "/drafts", "/drafting", "/rankings", "/scouting", null, undefined, "/developers", "/devices", "/accounts", "/sign-in"]) {
      expect(isDeskPath(path)).toBe(false);
    }
  });
});

describe("withFlagValues", () => {
  /** The query the page is rewritten to, or null for no rewrite. */
  function rewritten(search: string): string | null {
    return withFlagValues(new URLSearchParams(search))?.toString() ?? null;
  }

  test("a bare flag gets a value, the rest of the query as it was", () => {
    expect(rewritten("demo")).toBe("demo=1");
    expect(rewritten("demo=")).toBe("demo=1");
    expect(rewritten("view=players&demo")).toBe("view=players&demo=1");
    expect(rewritten("demo&market")).toBe("demo=1&market=1");
    expect(rewritten("t=3&add")).toBe("t=3&add=1");
  });

  test("a flag with a value, or no flag, needs no rewrite", () => {
    for (const search of ["", "demo=1", "market=day", "view=players", "q=", "op=&g=", "demo=0"]) {
      expect(rewritten(search)).toBeNull();
    }
  });

  test("the rewritten query keeps the flag the page reads", () => {
    const params = Object.fromEntries(withFlagValues(new URLSearchParams("market&demo"))!);
    expect("demo" in params).toBe(true);
    expect(params.market).toBe("1");
  });
});
