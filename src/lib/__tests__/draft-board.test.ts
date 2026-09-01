import { describe, expect, test } from "bun:test";
import {
  countCapped,
  matchesView,
  naturalDirection,
  sortValue,
  visibleRows,
  type BoardView,
} from "../draft-board";
import type { DraftBoardRow } from "../../types/draft";

function row(overrides: Partial<DraftBoardRow> & { player_id: number }): DraftBoardRow {
  return {
    espn_id: null,
    name: `Player ${overrides.player_id}`,
    team: "DEN",
    position: "C",
    primary_position: "C",
    positions: ["C", "UT"],
    injury_status: null,
    cv_rank: overrides.player_id,
    value: 50,
    value_source: "baseline",
    last_season_gp: 70,
    projected_gp: null,
    fpts_avg: 50,
    market_rank: null,
    adp: null,
    auction_value: null,
    market_delta: null,
    cap_blocked: false,
    categories: null,
    category_z: null,
    score: null,
    ...overrides,
  };
}

/** A rookie ESPN ranks that nothing can value yet. */
function marketOnly(player_id: number, market_rank: number): DraftBoardRow {
  return row({
    player_id,
    cv_rank: null,
    value: null,
    fpts_avg: null,
    value_source: "market",
    last_season_gp: null,
    market_rank,
    team: null,
  });
}

const VIEW: BoardView = {
  sortKey: "cv_rank",
  sortDirection: "asc",
  positionFilter: "all",
  hideCapped: false,
  search: "",
};

describe("naturalDirection", () => {
  test("rank-like columns open ascending, value-like descending", () => {
    expect(naturalDirection("cv_rank")).toBe("asc");
    expect(naturalDirection("market_rank")).toBe("asc");
    expect(naturalDirection("adp")).toBe("asc");
    expect(naturalDirection("name")).toBe("asc");
    expect(naturalDirection("value")).toBe("desc");
    expect(naturalDirection("market_delta")).toBe("desc");
    expect(naturalDirection("projected_gp")).toBe("desc");
  });
});

describe("sortValue", () => {
  test("missing rank sorts to the far end, not to zero", () => {
    expect(sortValue(marketOnly(9, 25), "cv_rank")).toBe(Number.POSITIVE_INFINITY);
    expect(sortValue(marketOnly(9, 25), "value")).toBe(Number.NEGATIVE_INFINITY);
  });

  test("projected games falls back to last season before giving up", () => {
    expect(sortValue(row({ player_id: 1, projected_gp: 78 }), "projected_gp")).toBe(78);
    expect(sortValue(row({ player_id: 1, projected_gp: null }), "projected_gp")).toBe(70);
    expect(
      sortValue(row({ player_id: 1, projected_gp: null, last_season_gp: null }), "projected_gp")
    ).toBe(Number.NEGATIVE_INFINITY);
  });

  test("names sort case-insensitively", () => {
    expect(sortValue(row({ player_id: 1, name: "Nikola Jokić" }), "name")).toBe("nikola jokić");
  });
});

describe("matchesView", () => {
  const capped = row({ player_id: 1, cap_blocked: true });

  test("a capped player is visible by default and hidden only on request", () => {
    // The board's contract: greyed with a CAP badge so the user sees *why*.
    expect(matchesView(capped, VIEW)).toBe(true);
    expect(matchesView(capped, { ...VIEW, hideCapped: true })).toBe(false);
  });

  test("the position filter reads the ESPN primary position", () => {
    const guard = row({ player_id: 2, primary_position: "PG", position: "G" });
    expect(matchesView(guard, { ...VIEW, positionFilter: "PG" })).toBe(true);
    expect(matchesView(guard, { ...VIEW, positionFilter: "C" })).toBe(false);
    expect(matchesView(guard, { ...VIEW, positionFilter: "all" })).toBe(true);
  });

  test("a player the market snapshot has no position for is filtered out, not in", () => {
    const unknown = row({ player_id: 3, primary_position: null });
    expect(matchesView(unknown, { ...VIEW, positionFilter: "C" })).toBe(false);
    expect(matchesView(unknown, VIEW)).toBe(true);
  });

  test("search is case-insensitive, substring, and ignores surrounding space", () => {
    const jokic = row({ player_id: 4, name: "Nikola Jokić" });
    expect(matchesView(jokic, { ...VIEW, search: "  joki  " })).toBe(true);
    expect(matchesView(jokic, { ...VIEW, search: "NIKOLA" })).toBe(true);
    expect(matchesView(jokic, { ...VIEW, search: "curry" })).toBe(false);
  });
});

describe("visibleRows", () => {
  const rows = [
    row({ player_id: 1, cv_rank: 1, value: 62, market_rank: 3, adp: 2.5, market_delta: 2 }),
    row({ player_id: 2, cv_rank: 2, value: 55, market_rank: 1, adp: 1.1, market_delta: -1 }),
    row({ player_id: 3, cv_rank: 3, value: 40, market_rank: null, adp: null, market_delta: null }),
    marketOnly(9, 25),
  ];

  test("market-only rows land last ascending AND descending", () => {
    const asc = visibleRows(rows, { ...VIEW, sortKey: "cv_rank", sortDirection: "asc" });
    expect(asc.map((r) => r.player_id)).toEqual([1, 2, 3, 9]);

    const desc = visibleRows(rows, { ...VIEW, sortKey: "value", sortDirection: "desc" });
    expect(desc.map((r) => r.player_id)).toEqual([1, 2, 3, 9]);
  });

  test("sorting by value descending outranks the big board's own order", () => {
    const byValue = visibleRows(
      [
        row({ player_id: 1, cv_rank: 1, value: 10 }),
        row({ player_id: 2, cv_rank: 2, value: 90 }),
      ],
      { ...VIEW, sortKey: "value", sortDirection: "desc" }
    );
    expect(byValue.map((r) => r.player_id)).toEqual([2, 1]);
  });

  test("ties keep the big board order rather than shuffling", () => {
    const tied = visibleRows(
      [
        row({ player_id: 7, cv_rank: 7, value: 50 }),
        row({ player_id: 2, cv_rank: 2, value: 50 }),
        row({ player_id: 5, cv_rank: 5, value: 50 }),
      ],
      { ...VIEW, sortKey: "value", sortDirection: "desc" }
    );
    expect(tied.map((r) => r.player_id)).toEqual([2, 5, 7]);
  });

  test("filters apply before the sort", () => {
    const mixed = [
      row({ player_id: 1, cv_rank: 1, cap_blocked: true }),
      row({ player_id: 2, cv_rank: 2 }),
      row({ player_id: 3, cv_rank: 3, cap_blocked: true }),
    ];
    const shown = visibleRows(mixed, { ...VIEW, hideCapped: true });
    expect(shown.map((r) => r.player_id)).toEqual([2]);
    expect(countCapped(mixed)).toBe(2);
  });

  test("the input array is not mutated", () => {
    const original = [...rows];
    visibleRows(rows, { ...VIEW, sortKey: "value", sortDirection: "desc" });
    expect(rows.map((r) => r.player_id)).toEqual(original.map((r) => r.player_id));
  });

  test("an empty board stays empty rather than throwing", () => {
    expect(visibleRows([], VIEW)).toEqual([]);
  });
});
