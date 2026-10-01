import { describe, expect, test } from "bun:test";
import { lastGames, windowGames, windowLabel } from "../statWindow";

describe("windowGames", () => {
  test("any last-N window the :window command accepts", () => {
    expect(windowGames("l5")).toBe(5);
    expect(windowGames("l15")).toBe(15);
    expect(windowGames("L30")).toBe(30);
    expect(windowGames("l1")).toBe(1);
    expect(windowGames("l82")).toBe(82);
  });

  test("the season, and anything unreadable, cover every game", () => {
    for (const w of ["season", "l0", "l83", "lx", "15", ""]) expect(windowGames(w)).toBeNull();
  });
});

describe("windowLabel", () => {
  test("labels any window, not just the ones with a hard-coded entry", () => {
    expect(windowLabel("l15")).toBe("L15");
    expect(windowLabel("l5")).toBe("L5");
    expect(windowLabel("season")).toBe("Season");
  });
});

describe("lastGames", () => {
  const logs = Array.from({ length: 40 }, (_, i) => i + 1); // oldest first

  test("the last N games of a date-ordered list", () => {
    expect(lastGames(logs, "l15")).toEqual(logs.slice(25));
    expect(lastGames(logs, "l15")).toHaveLength(15);
  });

  test("a window longer than the log is every game", () => {
    expect(lastGames(logs, "l60")).toEqual(logs);
  });

  test("the season is every game, as a copy the caller can sort", () => {
    const all = lastGames(logs, "season");
    expect(all).toEqual(logs);
    expect(all).not.toBe(logs);
  });
});
