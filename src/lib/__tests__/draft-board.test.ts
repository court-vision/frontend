import { describe, expect, test } from "bun:test";
import {
  basisNote,
  columnsFor,
  columnsThatFit,
  countCapped,
  espnSinceDetail,
  espnSinceText,
  marketNote,
  matchesView,
  moveDetail,
  moveSpan,
  naturalDirection,
  needBar,
  needsByUrgency,
  paceLabel,
  playoffDetail,
  playoffTone,
  playoffWeightLabel,
  sortableKey,
  sortValue,
  stepHighlight,
  targetRow,
  visibleRows,
  yieldsNeeded,
  type BoardView,
} from "../draft-board";
import type { BoardSortKey, CategoryNeed, DraftBoardMeta, DraftBoardRow, DraftLiveRanks, DraftPlayoffs } from "../../types/draft";
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
    board_rank: overrides.player_id,
    room_rank: overrides.player_id,
    room_score: 100,
    value: 50,
    value_source: "baseline",
    value_season: null,
    last_season_gp: 70,
    season_gp: null,
    season_fpts_avg: null,
    projected_gp: null,
    season_games: 65,
    playoff_games: null,
    playoff_light_games: null,
    playoff_games_by_week: null,
    fpts_avg: 50,
    market_rank: null,
    espn_rank_since: null,
    espn_rank_since_first_stored: false,
    move_1d: null,
    move_7d: null,
    rank_reason: null,
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

/** A rookie ESPN ranks that nothing can value yet; on ESPN's board his rank is his place. */
function marketOnly(player_id: number, market_rank: number): DraftBoardRow {
  return row({
    player_id,
    cv_rank: null,
    board_rank: market_rank,
    room_rank: null,
    room_score: null,
    value: null,
    fpts_avg: null,
    value_source: "market",
    last_season_gp: null,
    market_rank,
    team: null,
  });
}

const VIEW: BoardView = {
  sortKey: "board_rank",
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
    projection_source: null,
    market_as_of: null,
    rank_source: "cv",
    rank_source_requested: "cv",
    market_rank_type: "roto",
    rank_basis: "espn",
    rank_basis_reason: "espn_league",
    rank_basis_requested: "espn",
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
    congestion: null,
    playoffs: null,
    in_season: null,
    live_ranks: null,
    settings_synced: true,
    unsupported: [],
    ...overrides,
  };
}

/** ESPN's default playoff shape on the 2026-27 calendar: weeks 20-23, teams play 13 to 16. */
function playoffs(overrides: Partial<DraftPlayoffs> = {}): DraftPlayoffs {
  return {
    weeks: [20, 21, 22, 23],
    rounds: [[20, 21], [22, 23]],
    label: "weeks 20-23",
    source: "espn_default",
    weight: 2,
    weights: [1, 1.5, 2, 3, 4],
    games_min: 13,
    games_max: 16,
    games_mean: 14.3,
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
    expect(naturalDirection("board_rank")).toBe("asc");
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
      { sortKey: "board_rank", populated: [1, 2, 3, 9], missing: [] },
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

  test("on the board's own column a ranked rookie sits at his rank and the unranked trail", () => {
    const board = [
      row({ player_id: 3, cv_rank: 1, board_rank: 3 }),
      row({ player_id: 1, cv_rank: 2, board_rank: 1 }),
      row({ player_id: 8, cv_rank: 3, board_rank: null }),
      marketOnly(9, 2),
    ];
    expect(visibleRows(board, { ...VIEW, sortKey: "board_rank" }).map((r) => r.player_id))
      .toEqual([1, 9, 3, 8]);
    // Flipped, the unranked still trail: no number is never "the biggest number".
    expect(
      visibleRows(board, { ...VIEW, sortKey: "board_rank", sortDirection: "desc" }).map((r) => r.player_id)
    ).toEqual([3, 9, 1, 8]);
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
    expect(columnsFor(null).map((c) => c.key)).toContain("board_rank");
  });

  test("one rank in the gutter and the other beside the name, never the same number twice", () => {
    const espn = columnsFor(meta({ rank_basis: "espn" })).map((c) => c.key);
    expect(espn[0]).toBe("board_rank");
    expect(espn).toContain("cv_rank");
    expect(espn).not.toContain("market_rank");
    const cv = columnsFor(meta({ rank_basis: "cv", rank_basis_reason: "provider_not_espn" })).map((c) => c.key);
    expect(cv[0]).toBe("board_rank");
    expect(cv).toContain("market_rank");
    expect(cv).not.toContain("cv_rank");
  });

  test("on the my-team board the gutter is the roster's own order, with both opinions beside it", () => {
    const columns = columnsFor(meta({ rank_basis: "my_team", rank_basis_reason: "caller_chose_my_team" }));
    const keys = columns.map((c) => c.key);
    expect(keys[0]).toBe("board_rank");
    expect(keys.indexOf("cv_rank")).toBe(keys.indexOf("value") + 2);       // after Fit
    expect(keys.indexOf("market_rank")).toBe(keys.indexOf("cv_rank") + 1);
    expect(columns[0].title).toContain("for your roster");
    expect(columns[0].title).toContain("moves with every pick");
  });

  test("the playoff column is there when the league has playoff weeks, after games, and says which", () => {
    expect(columnsFor(meta()).map((c) => c.key)).not.toContain("playoff_games");      // roto, or no calendar

    const columns = columnsFor(meta({ value_kind: "fpts", categories: [], playoffs: playoffs() }));
    const keys = columns.map((c) => c.key);
    expect(keys.indexOf("playoff_games")).toBe(keys.indexOf("projected_gp") + 1);
    const column = columns.find((c) => c.key === "playoff_games")!;
    expect(column.label).toBe("PO");
    expect(column.title).toBe(
      "Games his team plays in your fantasy playoffs (weeks 20-23). Teams play 13–16; the average is 14.3"
    );
    // In a category league it still comes before the categories.
    const cats = columnsFor(meta({ playoffs: playoffs() })).map((c) => c.key);
    expect(cats.indexOf("playoff_games")).toBeLessThan(cats.findIndex((k) => k.startsWith("cat:")));
    expect(sortableKey("playoff_games", columns)).toBe("playoff_games");
    expect(sortableKey("playoff_games", columnsFor(meta()))).toBe("board_rank");
  });
});

describe("playoff games", () => {
  test("sort by them like any number, most first, unknown teams last", () => {
    expect(naturalDirection("playoff_games")).toBe("desc");
    const rows = [
      row({ player_id: 1, playoff_games: 13 }),
      row({ player_id: 2, playoff_games: null }),
      row({ player_id: 3, playoff_games: 16 }),
    ];
    const sorted = visibleRows(rows, { ...VIEW, sortKey: "playoff_games", sortDirection: "desc" });
    expect(sorted.map((r) => r.player_id)).toEqual([3, 1, 2]);
    expect(sortValue(rows[1], "playoff_games")).toBeNull();
  });

  test("only a schedule a game or more off the league's average is toned", () => {
    const league = playoffs();                           // mean 14.3
    expect(playoffTone(16, league)).toBe("high");
    expect(playoffTone(15, league)).toBeNull();          // 0.7 above: about the same
    expect(playoffTone(14, league)).toBeNull();
    expect(playoffTone(13, league)).toBe("low");
    expect(playoffTone(null, league)).toBeNull();
    expect(playoffTone(16, null)).toBeNull();
    // Every team playing the same number is no information, whatever the average says.
    expect(playoffTone(12, playoffs({ games_min: 12, games_max: 12, games_mean: 12 }))).toBeNull();
  });

  test("the tooltip gives the games week by week and how many fall on light nights", () => {
    const phx = row({ player_id: 1, team: "PHX", playoff_games: 16, playoff_light_games: 6, playoff_games_by_week: [4, 4, 4, 4] });
    expect(playoffDetail(phx, playoffs())).toBe(
      "PHX plays 16 in the fantasy playoffs: wk 20 · 4, wk 21 · 4, wk 22 · 4, wk 23 · 4. " +
        "6 on light nights. League average 14.3."
    );
    // A split that does not line up with the weeks is left out rather than mislabelled.
    const odd = row({ player_id: 2, team: null, playoff_games: 14, playoff_light_games: null, playoff_games_by_week: [7, 7] });
    expect(playoffDetail(odd, playoffs())).toBe("His team plays 14 in the fantasy playoffs. League average 14.3.");
    expect(playoffDetail(row({ player_id: 3 }), playoffs())).toBeNull();
    expect(playoffDetail(phx, null)).toBeNull();
  });

  test("a weight reads as a multiple", () => {
    expect([1, 1.5, 2, 3, 4].map(playoffWeightLabel)).toEqual(["1×", "1.5×", "2×", "3×", "4×"]);
  });
});

describe("basisNote", () => {
  test("an ESPN room names ESPN's board for the format and the snapshot date", () => {
    expect(basisNote(meta({ market_rank_type: "roto", market_as_of: "2026-09-16" }))?.label)
      .toBe("ESPN categories board · as of 2026-09-16");
    expect(basisNote(meta({ market_rank_type: "standard", market_as_of: null }))?.label)
      .toBe("ESPN points board");
  });

  test("a chosen Court Vision board is named as a choice, not a fallback", () => {
    expect(basisNote(meta({ rank_basis: "cv", rank_basis_reason: "caller_chose_cv", rank_basis_requested: "cv" }))?.label)
      .toBe("Court Vision board");
  });

  test("the my-team board says whose order it is and what moves it", () => {
    const note = basisNote(meta({
      rank_basis: "my_team", rank_basis_reason: "caller_chose_my_team", rank_basis_requested: "my_team",
    }));
    expect(note?.label).toBe("CV board for your team");
    expect(note?.title).toContain("your punts");
    expect(note?.title).toContain("the starts your lineup could not use");
  });

  test("a CV board says why it is not ESPN's", () => {
    expect(basisNote(meta({ rank_basis: "cv", rank_basis_reason: "no_market_snapshot" }))?.label)
      .toBe("CV board — no ESPN snapshot yet");
    expect(basisNote(meta({ rank_basis: "cv", rank_basis_reason: "provider_not_espn" }))?.label)
      .toBe("CV board — not an ESPN league");
    expect(basisNote(null)).toBeNull();
  });
});

/** A board read on Nov 23 with a week of stored boards behind it. */
function liveRanks(overrides: Partial<DraftLiveRanks> = {}): DraftLiveRanks {
  return {
    board: "points",
    as_of: "2026-11-23",
    day: "2026-11-22",
    week: "2026-11-16",
    espn_as_of: "2026-11-23",
    ...overrides,
  };
}

describe("a board read in season", () => {
  const points = (overrides: Partial<DraftBoardMeta> = {}) =>
    meta({ value_kind: "fpts", categories: [], ...overrides });

  test("before opening night the board has neither a move nor an ESPN age column", () => {
    const keys = columnsFor(points()).map((c) => c.key);
    expect(keys).not.toContain("move_7d");
    expect(keys).not.toContain("move_1d");
    expect(keys).not.toContain("espn_rank_since");
  });

  test("the move follows Court Vision's rank and ESPN's age follows ESPN's", () => {
    const live = liveRanks();
    const key = (m: DraftBoardMeta) => columnsFor(m).map((c) => c.key);
    // ESPN's rank is the gutter: its age keeps the place the rank would have had.
    expect(key(points({ rank_basis: "espn", live_ranks: live })).slice(2, 7))
      .toEqual(["value", "cv_rank", "move_7d", "espn_rank_since", "adp"]);
    // Court Vision's is: the move keeps its place.
    expect(key(points({ rank_basis: "cv", rank_basis_reason: "caller_chose_cv", live_ranks: live })).slice(2, 7))
      .toEqual(["value", "move_7d", "market_rank", "espn_rank_since", "adp"]);
    expect(key(points({ rank_basis: "my_team", rank_basis_reason: "caller_chose_my_team", live_ranks: live })).slice(2, 8))
      .toEqual(["value", "cv_rank", "move_7d", "market_rank", "espn_rank_since", "adp"]);
  });

  test("the move column reads a week once a board a week back is stored, and a day until then", () => {
    expect(moveSpan(liveRanks())).toBe("week");
    expect(moveSpan(liveRanks({ week: null }))).toBe("day");
    expect(moveSpan(liveRanks({ week: null, day: null }))).toBeNull();
    expect(moveSpan(liveRanks({ as_of: null }))).toBeNull();
    expect(moveSpan(null)).toBeNull();

    const week = columnsFor(points({ live_ranks: liveRanks() })).find((c) => c.key === "move_7d");
    expect(week?.label).toBe("7D");
    expect(week?.title).toContain("standard points board since Nov 16");
    const day = columnsFor(points({ live_ranks: liveRanks({ week: null }) })).find((c) => c.key === "move_1d");
    expect(day?.label).toBe("1D");
    expect(day?.title).toContain("since Nov 22, the previous stored morning");
    // Nothing to measure from yet: no column of dashes.
    const first = columnsFor(points({ live_ranks: liveRanks({ week: null, day: null }) })).map((c) => c.key);
    expect(first).not.toContain("move_7d");
    expect(first).not.toContain("move_1d");
  });

  test("a category room's move is named as the nine-category board's", () => {
    const column = columnsFor(meta({ live_ranks: liveRanks({ board: "categories" }) })).find((c) => c.key === "move_7d");
    expect(column?.title).toContain("standard nine-category board");
    expect(column?.title).toContain("scoring of its own");
  });

  test("ESPN's ranks stored without ours still date themselves, and ours without ESPN's still move", () => {
    const espnOnly = columnsFor(points({ live_ranks: liveRanks({ as_of: null, day: null, week: null }) })).map((c) => c.key);
    expect(espnOnly).toContain("espn_rank_since");
    expect(espnOnly).not.toContain("move_7d");
    const oursOnly = columnsFor(points({ live_ranks: liveRanks({ espn_as_of: null }) })).map((c) => c.key);
    expect(oursOnly).toContain("move_7d");
    expect(oursOnly).not.toContain("espn_rank_since");
  });

  test("ESPN's rank column says which morning it is from", () => {
    const m = points({ rank_basis: "cv", rank_basis_reason: "caller_chose_cv", live_ranks: liveRanks() });
    expect(columnsFor(m).find((c) => c.key === "market_rank")?.title).toContain("on Nov 23");
    const snapshot = points({ rank_basis: "cv", rank_basis_reason: "caller_chose_cv" });
    expect(columnsFor(snapshot).find((c) => c.key === "market_rank")?.title).toBe("ESPN's published draft rank for this league's format");
  });

  test("risers sort first, fallers last, and a player with no move after both", () => {
    const rows = [
      row({ player_id: 1, move_7d: -4 }),
      row({ player_id: 2, move_7d: null }),
      row({ player_id: 3, move_7d: 9 }),
      row({ player_id: 4, move_7d: 0 }),
    ];
    expect(naturalDirection("move_7d")).toBe("desc");
    const down = visibleRows(rows, { ...VIEW, sortKey: "move_7d", sortDirection: "desc" }).map((r) => r.player_id);
    expect(down).toEqual([3, 4, 1, 2]);
    const up = visibleRows(rows, { ...VIEW, sortKey: "move_7d", sortDirection: "asc" }).map((r) => r.player_id);
    expect(up).toEqual([1, 4, 3, 2]);
  });

  test("ESPN's newest ranks sort first, the same morning's stay in board order, the undated last", () => {
    const rows = [
      row({ player_id: 1, espn_rank_since: "2026-11-12", espn_rank_since_first_stored: true }),
      row({ player_id: 2, espn_rank_since: "2026-11-23" }),
      row({ player_id: 3, espn_rank_since: null }),
      row({ player_id: 4, espn_rank_since: "2026-11-23" }),
      row({ player_id: 5, espn_rank_since: "2026-11-19" }),
    ];
    expect(sortValue(rows[0], "espn_rank_since")).toBe(20261112);
    expect(sortValue(rows[2], "espn_rank_since")).toBeNull();
    const newest = visibleRows(rows, { ...VIEW, sortKey: "espn_rank_since", sortDirection: "desc" }).map((r) => r.player_id);
    expect(newest).toEqual([2, 4, 5, 1, 3]);
  });

  test("a row from a build without the fields sorts as one with nothing to say", () => {
    // The demo fixtures, and a backend a deploy behind, send no move at all.
    const bare = { ...row({ player_id: 1 }), move_7d: undefined, espn_rank_since: undefined } as unknown as DraftBoardRow;
    expect(sortValue(bare, "move_7d")).toBeNull();
    expect(sortValue(bare, "espn_rank_since")).toBeNull();
    expect(espnSinceText(bare)).toBeNull();
  });

  test("the move's tooltip gives both spans, the days they are from, and whose board", () => {
    expect(moveDetail({ move_7d: 6, move_1d: -2 }, liveRanks()))
      .toBe("On Court Vision's standard points board: up 6 since Nov 16, down 2 since Nov 22");
    expect(moveDetail({ move_7d: 0, move_1d: null }, liveRanks({ board: "categories" })))
      .toBe("On Court Vision's standard nine-category board: where he was on Nov 16, no rank to compare on Nov 22");
    expect(moveDetail({ move_7d: null, move_1d: 3 }, liveRanks({ week: null })))
      .toBe("On Court Vision's standard points board: up 3 since Nov 22");
    expect(moveDetail({ move_7d: 1, move_1d: 1 }, liveRanks({ as_of: null }))).toBeNull();
    expect(moveDetail({ move_7d: 1, move_1d: 1 }, null)).toBeNull();
  });

  test("ESPN's age prints the morning its rank became this, and marks one at least that old", () => {
    const fresh = row({ player_id: 1, market_rank: 14, espn_rank_since: "2026-11-19" });
    expect(espnSinceText(fresh)).toBe("Nov 19");
    expect(espnSinceDetail(fresh)).toBe("ESPN has ranked him 14 since Nov 19");
    const old = row({ player_id: 2, market_rank: 3, espn_rank_since: "2026-11-12", espn_rank_since_first_stored: true });
    expect(espnSinceText(old)).toBe("≤ Nov 12");
    expect(espnSinceDetail(old)).toBe("ESPN has ranked him 3 since at least Nov 12, the first morning its ranks were stored");
    // ESPN no longer ranks him: nothing to date.
    expect(espnSinceText(row({ player_id: 3 }))).toBeNull();
    expect(espnSinceDetail(row({ player_id: 3 }))).toBeNull();
  });

  test("the bar and the status line date ESPN's ranks by the morning they are from, and ADP by its snapshot", () => {
    const m = points({ market_rank_type: "standard", market_as_of: "2026-10-31", live_ranks: liveRanks() });
    expect(basisNote(m)?.label).toBe("ESPN points board · as of 2026-11-23");
    expect(marketNote(m)).toBe("ESPN ranks as of 2026-11-23 · ADP as of 2026-10-31");
    // No ESPN board near enough: the rows carry the snapshot's ranks, and say so.
    const stale = points({ market_rank_type: "standard", market_as_of: "2026-10-31", live_ranks: liveRanks({ espn_as_of: null }) });
    expect(basisNote(stale)?.label).toBe("ESPN points board · as of 2026-10-31");
    expect(marketNote(stale)).toBe("ESPN market as of 2026-10-31");
    expect(marketNote(points({ market_as_of: "2026-09-16" }))).toBe("ESPN market as of 2026-09-16");
    expect(marketNote(points())).toBeNull();
    expect(marketNote(null)).toBeNull();
  });

  test("a board with no width to spare gives up ESPN's age first, then the move, never a category", () => {
    const every = columnsFor(meta({ live_ranks: liveRanks() }));
    // Every column 50px wide but the two the season adds: 20 columns, then 40 and 84.
    const floor = (c: { key: string }) => (c.key === "move_7d" ? 40 : c.key === "espn_rank_since" ? 84 : 50);
    const rest = (every.length - 2) * 50;
    expect(yieldsNeeded(every, rest + 124, floor, "board_rank")).toBe(0);
    expect(yieldsNeeded(every, rest + 123, floor, "board_rank")).toBe(1);
    expect(yieldsNeeded(every, rest + 40, floor, "board_rank")).toBe(1);
    expect(yieldsNeeded(every, rest + 39, floor, "board_rank")).toBe(2);
    // Narrower still, nothing else can go: the board scrolls sideways as it always has.
    expect(yieldsNeeded(every, 300, floor, "board_rank")).toBe(2);

    expect(columnsThatFit(every, 0, "board_rank")).toBe(every);
    const one = columnsThatFit(every, 1, "board_rank").map((c) => c.key);
    expect(one).not.toContain("espn_rank_since");
    expect(one).toContain("move_7d");
    expect(one).toHaveLength(every.length - 1);
    const two = columnsThatFit(every, 2, "board_rank").map((c) => c.key);
    expect(two).not.toContain("move_7d");
    expect(two).toHaveLength(every.length - 2);
    expect(two.filter((k) => k.startsWith("cat:"))).toHaveLength(DEFAULT_9CAT.length);
  });

  test("a column the board is sorted by stays however narrow the board is", () => {
    const every = columnsFor(meta({ live_ranks: liveRanks() }));
    expect(columnsThatFit(every, 2, "espn_rank_since").map((c) => c.key)).toContain("espn_rank_since");
    expect(columnsThatFit(every, 2, "move_7d").map((c) => c.key)).toContain("move_7d");
  });

  test("the column sorted by is not width to win back, so the other one steps aside for it", () => {
    const every = columnsFor(meta({ live_ranks: liveRanks() }));
    const floor = (c: { key: string }) => (c.key === "move_7d" ? 40 : c.key === "espn_rank_since" ? 84 : 50);
    const rest = (every.length - 2) * 50;
    const drawn = (width: number, sortKey: BoardSortKey) =>
      columnsThatFit(every, yieldsNeeded(every, width, floor, sortKey), sortKey);
    const widthOf = (columns: { key: string }[]) => columns.reduce((sum, c) => sum + floor(c), 0);

    // Room for ESPN's age or the move but not both. Sorted by ESPN's age, the age stays
    // and the move goes; left in, the two together would push the board off its side.
    for (const width of [rest + 84, rest + 100, rest + 123]) {
      const keys = drawn(width, "espn_rank_since").map((c) => c.key);
      expect(keys).toContain("espn_rank_since");
      expect(keys).not.toContain("move_7d");
      expect(widthOf(drawn(width, "espn_rank_since"))).toBeLessThanOrEqual(width);
      // Sorted by anything else, the same board keeps the move and drops the age.
      expect(drawn(width, "board_rank").map((c) => c.key)).toContain("move_7d");
      expect(widthOf(drawn(width, "board_rank"))).toBeLessThanOrEqual(width);
    }
    // With room for both, a sort changes nothing.
    expect(drawn(rest + 124, "espn_rank_since")).toBe(every);
    // Sorted by the move on a board with room for only the move: the age goes, as before.
    expect(drawn(rest + 60, "move_7d").map((c) => c.key)).not.toContain("espn_rank_since");
    expect(widthOf(drawn(rest + 60, "move_7d"))).toBeLessThanOrEqual(rest + 60);
    // No room even for the one sorted by: it still stays, and only then does the board scroll.
    const tight = drawn(rest + 39, "espn_rank_since").map((c) => c.key);
    expect(tight).toContain("espn_rank_since");
    expect(tight).not.toContain("move_7d");
  });

  test("before opening night no column can step aside, and the board keeps the same columns", () => {
    const preseason = columnsFor(meta());
    expect(yieldsNeeded(preseason, 300, () => 50, "board_rank")).toBe(0);
    // The same array back, so no row re-renders.
    expect(columnsThatFit(preseason, 0, "board_rank")).toBe(preseason);
  });

  test("a move sort carried into a room before opening night falls back to the big board", () => {
    const preseason = columnsFor(points());
    expect(sortableKey("move_7d", preseason)).toBe("board_rank");
    expect(sortableKey("espn_rank_since", preseason)).toBe("board_rank");
    // A week of boards arrives: yesterday's one-day sort has no column any more.
    expect(sortableKey("move_1d", columnsFor(points({ live_ranks: liveRanks() })))).toBe("board_rank");
  });
});

describe("sortableKey", () => {
  test("a sort the current league has no column for falls back to the big board", () => {
    // The store persists the last column across reloads *and* across rooms, so
    // a fit sort chosen in a category league must not strand a points league
    // sorting every row by a null.
    const points = columnsFor(meta({ value_kind: "fpts", categories: [] }));
    expect(sortableKey("fit_rank", points)).toBe("board_rank");
    expect(sortableKey("cat:reb", points)).toBe("board_rank");
    expect(sortableKey("adp", points)).toBe("adp");
    // A CV-ordered room has no CV column beside the name (the gutter is it).
    const cv = columnsFor(meta({ rank_basis: "cv", rank_basis_reason: "provider_not_espn" }));
    expect(sortableKey("cv_rank", cv)).toBe("board_rank");
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
