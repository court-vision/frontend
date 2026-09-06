import { describe, expect, test } from "bun:test";
import {
  columnsFor,
  countCapped,
  matchesView,
  naturalDirection,
  needBar,
  needsByUrgency,
  paceLabel,
  sortableKey,
  sortValue,
  stepHighlight,
  targetRow,
  visibleRows,
  type BoardView,
} from "../draft-board";
import type { CategoryNeed, DraftBoardMeta, DraftBoardRow } from "../../types/draft";
import { DEFAULT_9CAT } from "../category-format";

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
    availability: null,
    fit_value: null,
    fit_rank: null,
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
  onlyLikelyGone: false,
  search: "",
};

/** A category league's board meta, with only what the column set reads. */
function meta(overrides: Partial<DraftBoardMeta> = {}): DraftBoardMeta {
  return {
    season: "2026-27",
    format: "categories",
    value_kind: "cat_value",
    pool_size: 100,
    available: 100,
    projection_count: 0,
    baseline_count: 100,
    market_only_count: 0,
    projections_as_of: null,
    market_as_of: null,
    session_id: 1,
    league_size: 12,
    roster_slots: {},
    position_source: "espn",
    position_limits: {},
    categories: DEFAULT_9CAT,
    punts: [],
    category_need: [],
    pace_source: null,
    seats_drafted: 0,
    settings_synced: true,
    unsupported: [],
    ...overrides,
  };
}

/** One category's standing, as the roster zone reads it. */
function need(overrides: Partial<CategoryNeed> & { key: string }): CategoryNeed {
  return {
    label: overrides.key.toUpperCase(),
    mine: 0,
    pace: 0,
    need: 0,
    weight: 1,
    punted: false,
    my_rank: null,
    seats: null,
    ...overrides,
  };
}

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
  test("preserves missing values for direction-independent placement", () => {
    expect(sortValue(marketOnly(9, 25), "cv_rank")).toBeNull();
    expect(sortValue(marketOnly(9, 25), "value")).toBeNull();
  });

  test("projected games falls back to last season before giving up", () => {
    expect(sortValue(row({ player_id: 1, projected_gp: 78 }), "projected_gp")).toBe(78);
    expect(sortValue(row({ player_id: 1, projected_gp: null }), "projected_gp")).toBe(70);
    expect(
      sortValue(row({ player_id: 1, projected_gp: null, last_season_gp: null }), "projected_gp")
    ).toBeNull();
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

  test("missing values land last in either sort direction", () => {
    const cases = [
      { sortKey: "cv_rank", populated: [1, 2, 3], missing: [9] },
      { sortKey: "market_rank", populated: [1, 2, 9], missing: [3] },
      { sortKey: "adp", populated: [1, 2], missing: [3, 9] },
      { sortKey: "value", populated: [1, 2, 3], missing: [9] },
      { sortKey: "market_delta", populated: [1, 2], missing: [3, 9] },
      { sortKey: "projected_gp", populated: [1, 2, 3], missing: [9] },
    ] as const;

    for (const { sortKey, populated, missing } of cases) {
      for (const sortDirection of ["asc", "desc"] as const) {
        const sorted = visibleRows(rows, { ...VIEW, sortKey, sortDirection });
        const ids = sorted.map((r) => r.player_id);
        expect(ids.slice(0, populated.length).sort()).toEqual([...populated].sort());
        expect(ids.slice(populated.length).sort()).toEqual([...missing].sort());
      }
    }
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

describe("keyboard highlight", () => {
  test("steps within the visible rows and clamps at the ends", () => {
    expect(stepHighlight([3, 1, 2], 3, 1)).toBe(1);
    expect(stepHighlight([3, 1, 2], 2, 1)).toBe(2);
    expect(stepHighlight([3, 1, 2], 3, -1)).toBe(3);
  });

  test("no highlight, or one that left the view, starts from the edge the key points away from", () => {
    expect(stepHighlight([3, 1, 2], null, 1)).toBe(3);
    expect(stepHighlight([3, 1, 2], null, -1)).toBe(2);
    expect(stepHighlight([3, 1, 2], 99, 1)).toBe(3);
    expect(stepHighlight([], 1, 1)).toBeNull();
  });

  test("a keystroke lands on the highlighted row while visible, else the top match", () => {
    const rows = [row({ player_id: 1 }), row({ player_id: 2 })];
    expect(targetRow(rows, 2)?.player_id).toBe(2);
    expect(targetRow(rows, 99)?.player_id).toBe(1);
    expect(targetRow([], 1)).toBeNull();
  });
});

describe("fit and availability columns", () => {
  test("fit sorts by rank, so a points league's all-null fit column lands last either way", () => {
    const rows = [
      row({ player_id: 1, fit_rank: 3 }),
      row({ player_id: 2, fit_rank: null }),
      row({ player_id: 3, fit_rank: 1 }),
    ];
    const view = { ...VIEW, sortKey: "fit_rank" as const };
    expect(visibleRows(rows, view).map((r) => r.player_id)).toEqual([3, 1, 2]);
    expect(
      visibleRows(rows, { ...view, sortDirection: "desc" }).map((r) => r.player_id)
    ).toEqual([1, 3, 2]);
  });

  test("availability orders likely before tossup before gone, with an unknown bucket last either way", () => {
    const rows = [
      row({ player_id: 1, availability: "gone" }),
      row({ player_id: 2, availability: null }),
      row({ player_id: 3, availability: "likely" }),
      row({ player_id: 4, availability: "tossup" }),
    ];
    const view = { ...VIEW, sortKey: "availability" as const };
    expect(visibleRows(rows, { ...view, sortDirection: "asc" }).map((r) => r.player_id))
      .toEqual([3, 4, 1, 2]);
    expect(visibleRows(rows, { ...view, sortDirection: "desc" }).map((r) => r.player_id))
      .toEqual([1, 4, 3, 2]);
  });

  test("the first click on availability shows who is going, not who will keep", () => {
    expect(naturalDirection("availability")).toBe("desc");
    expect(naturalDirection("fit_rank")).toBe("asc");
  });

  test("the likely-gone filter drops rows with no availability, not just the safe ones", () => {
    const rows = [
      row({ player_id: 1, availability: "gone" }),
      row({ player_id: 2, availability: "tossup" }),
      row({ player_id: 3, availability: null }),
    ];
    // "Gone" is a claim about the market; a row with no market data supports
    // no claim, so it is excluded rather than kept on the benefit of the doubt.
    expect(visibleRows(rows, { ...VIEW, onlyLikelyGone: true }).map((r) => r.player_id))
      .toEqual([1]);
  });

  test("a category column reads that category, and a player without one sorts last", () => {
    const rows = [
      row({ player_id: 1, categories: { reb: 8.5 } }),
      row({ player_id: 2, categories: null }),
      row({ player_id: 3, categories: { reb: 11.2 } }),
    ];
    const view = { ...VIEW, sortKey: "cat:reb" as const, sortDirection: "desc" as const };
    expect(visibleRows(rows, view).map((r) => r.player_id)).toEqual([3, 1, 2]);
  });
});

describe("columnsFor", () => {
  test("a points league gets no fit column and no categories", () => {
    const keys = columnsFor(meta({ value_kind: "fpts", categories: [] })).map((c) => c.key);
    expect(keys).not.toContain("fit_rank");
    expect(keys.some((k) => k.startsWith("cat:"))).toBe(false);
  });

  test("a category league gets fit beside value, then one column per category", () => {
    const columns = columnsFor(meta());
    const keys = columns.map((c) => c.key);
    expect(keys.indexOf("fit_rank")).toBe(keys.indexOf("value") + 1);
    expect(keys.filter((k) => k.startsWith("cat:"))).toHaveLength(DEFAULT_9CAT.length);
    expect(keys.at(-1)).toBe("cat:tov");
  });

  test("a punted category is flagged so the renderer can dim it, and nothing else is", () => {
    const columns = columnsFor(meta({ punts: ["ft_pct", "tov"] }));
    const punted = columns.filter((c) => c.punted).map((c) => c.key);
    expect(punted).toEqual(["cat:ft_pct", "cat:tov"]);
  });

  test("a lower-is-better category carries its polarity in the label", () => {
    const tov = columnsFor(meta()).find((c) => c.key === "cat:tov");
    expect(tov?.label).toBe("TO↓");
  });

  test("no meta at all still yields a usable board", () => {
    expect(columnsFor(null).map((c) => c.key)).toContain("cv_rank");
  });
});

describe("sortableKey", () => {
  test("a sort the current league has no column for falls back to the big board", () => {
    // The store persists the last column across reloads *and* across rooms, so
    // a fit sort chosen in a category league must not strand a points league
    // sorting every row by a null.
    const points = columnsFor(meta({ value_kind: "fpts", categories: [] }));
    expect(sortableKey("fit_rank", points)).toBe("cv_rank");
    expect(sortableKey("cat:reb", points)).toBe("cv_rank");
    expect(sortableKey("adp", points)).toBe("adp");
  });

  test("a category sort survives in a league that still scores that category", () => {
    expect(sortableKey("cat:reb", columnsFor(meta()))).toBe("cat:reb");
  });
});

describe("needBar", () => {
  test("on pace draws nothing on either side of the centre", () => {
    expect(needBar(0)).toEqual({ side: "behind", share: 0 });
  });

  test("behind and ahead fill opposite sides in proportion", () => {
    expect(needBar(1)).toEqual({ side: "behind", share: 0.5 });
    expect(needBar(-1)).toEqual({ side: "ahead", share: 0.5 });
  });

  test("a need past two sigma is clamped, so the bar cannot leave the rail", () => {
    expect(needBar(7).share).toBe(1);
    expect(needBar(-7)).toEqual({ side: "ahead", share: 1 });
  });
});

describe("paceLabel", () => {
  test("reading the real seats says how many teams it read", () => {
    expect(
      paceLabel(meta({ pace_source: "seats", category_need: [need({ key: "reb", seats: 12 })] }))
    ).toBe("vs 11 teams");
  });

  test("an estimate says so, and says why rather than showing a bare zero", () => {
    expect(
      paceLabel(meta({ pace_source: "tier", seats_drafted: 2, category_need: [need({ key: "reb" })] }))
    ).toBe("estimated · 2 teams have picked");
    expect(
      paceLabel(meta({ pace_source: "tier", seats_drafted: 0, category_need: [need({ key: "reb" })] }))
    ).toBe("estimated · nobody has picked yet");
  });

  test("a points league has no pace to report", () => {
    expect(paceLabel(meta({ value_kind: "fpts", category_need: [] }))).toBeNull();
  });
});

describe("needsByUrgency", () => {
  test("the biggest hole comes first, and punted categories sink to the bottom", () => {
    const ordered = needsByUrgency(
      meta({
        category_need: [
          need({ key: "reb", need: 0.2 }),
          need({ key: "tov", need: 1.9, punted: true }),
          need({ key: "blk", need: 1.4 }),
        ],
      })
    );
    expect(ordered.map((n) => n.key)).toEqual(["blk", "reb", "tov"]);
  });
});
