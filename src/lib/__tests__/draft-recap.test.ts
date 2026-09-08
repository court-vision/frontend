import { describe, expect, test } from "bun:test";
import {
  asOfLabel,
  formatGradedTotal,
  gradeTone,
  gradedLabel,
  gradedTotal,
  h2hCell,
  h2hOutcome,
  ordinal,
  pickColumnsFor,
  pickLabel,
  pickNaturalDirection,
  pickSourceGlyph,
  positionLabel,
  rankTone,
  recapCaveats,
  resolvePick,
  seatLabel,
  seatTitle,
  signed,
  slotLabel,
  sortPicks,
  sortSeats,
  sortStandings,
  standingsMode,
} from "../draft-recap";
import type {
  RecapCategoryLine,
  RecapMeta,
  RecapPick,
  RecapSeat,
  RecapStanding,
} from "../../types/draft";

// Factories list every wire field, so a schema change trips here before it
// reaches a component.

function pick(overrides: Partial<RecapPick> & { overall_pick: number }): RecapPick {
  return {
    round: null,
    slot: null,
    by_me: false,
    source: "manual",
    player_id: null,
    espn_player_id: null,
    player_name: `Pick ${overrides.overall_pick}`,
    team: null,
    value: null,
    cv_rank: null,
    market_rank: null,
    adp: null,
    surplus_cv: null,
    surplus_market: null,
    value_over_slot: null,
    bid: null,
    ...overrides,
  };
}

function seat(overrides: Partial<RecapSeat> & { slot: number }): RecapSeat {
  return {
    espn_team_id: null,
    is_me: false,
    picks: 13,
    unscored: 0,
    total_value: 0,
    value_over_slot: null,
    grade: null,
    position: null,
    best_pick: null,
    worst_pick: null,
    ...overrides,
  };
}

function line(overrides: Partial<RecapCategoryLine> & { key: string }): RecapCategoryLine {
  return { label: overrides.key.toUpperCase(), z_sum: 0, rank: 1, roto_points: 0, ...overrides };
}

function standing(overrides: Partial<RecapStanding> & { slot: number }): RecapStanding {
  return {
    categories: [],
    roto_points: null,
    roto_rank: null,
    season_value: null,
    value_rank: null,
    expected_wins: null,
    h2h: [],
    ...overrides,
  };
}

function meta(overrides: Partial<RecapMeta> = {}): RecapMeta {
  return {
    format: "points",
    value_kind: "fpts",
    graded_by: "value_over_slot",
    standings_basis: "season_value",
    session_id: 1,
    status: "completed",
    complete: true,
    picks_made: 52,
    total_picks: 52,
    unscored: 0,
    unattributed: 0,
    league_size: 4,
    rounds: 13,
    my_slot: 3,
    draft_type: "snake",
    categories: [],
    projections_as_of: null,
    market_as_of: null,
    ...overrides,
  };
}

const NINE_CAT = ["pts", "reb", "ast"].map((key) => ({
  key,
  label: key.toUpperCase(),
  higher_is_better: true,
  is_rate: false,
}));

describe("pickNaturalDirection", () => {
  test("rank-like columns open ascending, value-like descending", () => {
    expect(pickNaturalDirection("overall_pick")).toBe("asc");
    expect(pickNaturalDirection("cv_rank")).toBe("asc");
    expect(pickNaturalDirection("adp")).toBe("asc");
    expect(pickNaturalDirection("player_name")).toBe("asc");
    expect(pickNaturalDirection("value")).toBe("desc");
    expect(pickNaturalDirection("value_over_slot")).toBe("desc");
    expect(pickNaturalDirection("surplus_cv")).toBe("desc");
  });
});

describe("sortPicks", () => {
  const picks = [
    pick({ overall_pick: 1, value: 30, cv_rank: 2, player_name: "Zed" }),
    pick({ overall_pick: 2, value: null, cv_rank: null, player_name: "amy" }),
    pick({ overall_pick: 3, value: 40, cv_rank: 1, player_name: "Bob" }),
  ];
  const order = (list: RecapPick[]) => list.map((p) => p.overall_pick);

  test("a pick nothing could value sorts last in either direction", () => {
    expect(order(sortPicks(picks, "value", "desc"))).toEqual([3, 1, 2]);
    expect(order(sortPicks(picks, "value", "asc"))).toEqual([1, 3, 2]);
  });

  test("ranks ascend and names compare case-insensitively", () => {
    expect(order(sortPicks(picks, "cv_rank", "asc"))).toEqual([3, 1, 2]);
    expect(order(sortPicks(picks, "player_name", "asc"))).toEqual([2, 3, 1]);
    expect(order(sortPicks(picks, "player_name", "desc"))).toEqual([1, 3, 2]);
  });

  test("ties keep draft order and the input is left alone", () => {
    const tied = [
      pick({ overall_pick: 5, value: 20 }),
      pick({ overall_pick: 4, value: 20 }),
      pick({ overall_pick: 6, value: 20 }),
    ];
    expect(order(sortPicks(tied, "value", "desc"))).toEqual([4, 5, 6]);
    expect(order(tied)).toEqual([5, 4, 6]);
  });
});

describe("pickColumnsFor", () => {
  test("a snake ends in value over slot, an auction in the bid", () => {
    const snake = pickColumnsFor(meta()).map((c) => c.key);
    expect(snake[0]).toBe("overall_pick");
    expect(snake[snake.length - 1]).toBe("value_over_slot");
    expect(snake).not.toContain("bid");
    const auction = pickColumnsFor(meta({ draft_type: "auction" })).map((c) => c.key);
    expect(auction[auction.length - 1]).toBe("bid");
    expect(auction).not.toContain("value_over_slot");
    expect(pickColumnsFor(null).map((c) => c.key)).toContain("value_over_slot");
  });
});

describe("seat labels", () => {
  test("a seat is its slot, and you when it is yours", () => {
    expect(seatLabel(seat({ slot: 3 }))).toBe("Seat 3");
    expect(seatLabel(seat({ slot: 3, is_me: true }))).toBe("Seat 3 · you");
    expect(seatTitle(seat({ slot: 1, espn_team_id: 7 }))).toBe("ESPN team 7");
    expect(seatTitle(seat({ slot: 1 }))).toBeUndefined();
  });

  test("the pick table's seat cell marks mine and dashes the unattributed", () => {
    const seats = [seat({ slot: 1 }), seat({ slot: 3, is_me: true })];
    expect(slotLabel(null, seats)).toBe("—");
    expect(slotLabel(3, seats)).toBe("3 · you");
    expect(slotLabel(1, seats)).toBe("1");
    expect(slotLabel(5, seats)).toBe("5");
  });
});

describe("resolvePick and pickLabel", () => {
  const picks = [
    pick({ overall_pick: 1, player_name: "N. Jokić", value_over_slot: 8.4 }),
    pick({ overall_pick: 2, player_name: null, value_over_slot: null }),
  ];

  test("resolves a best or worst pick number to its row", () => {
    expect(resolvePick(picks, 1)?.player_name).toBe("N. Jokić");
    expect(resolvePick(picks, 9)).toBeNull();
    expect(resolvePick(picks, null)).toBeNull();
  });

  test("labels the player, the pick and its surplus", () => {
    expect(pickLabel(resolvePick(picks, 1))).toBe("N. Jokić (#1, +8.4)");
    expect(pickLabel(resolvePick(picks, 2))).toBe("Pick 2 (#2)");
    expect(pickLabel(null)).toBe("—");
  });
});

describe("ordinal and positionLabel", () => {
  test("ordinals, teens included", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st",
    ]);
  });

  test("a tie is read off the peers, since three tied seats average to a whole number", () => {
    expect(positionLabel(3, [1, 2, 3, 4])).toBe("3rd");
    expect(positionLabel(2.5, [1, 2.5, 2.5, 4])).toBe("T-2nd");
    expect(positionLabel(3, [1, 3, 3, 3])).toBe("T-2nd");
    expect(positionLabel(1.5, [1.5, 1.5, 3])).toBe("T-1st");
    expect(positionLabel(null, [1, 2])).toBe("—");
  });
});

describe("grades", () => {
  test("each letter has a tone, anything else none", () => {
    expect(["A", "B", "C", "D", "F"].map(gradeTone)).toEqual(["win", "good", "mid", "poor", "loss"]);
    expect(gradeTone("a")).toBe("win");
    expect(gradeTone(null)).toBe("none");
    expect(gradeTone("?")).toBe("none");
  });

  test("the headline is value over slot, or total value in an auction", () => {
    const s = seat({ slot: 1, total_value: 812.4, value_over_slot: 33.2 });
    expect(gradedTotal(s, "value_over_slot")).toBe(33.2);
    expect(gradedTotal(s, "value")).toBe(812.4);
    expect(gradedTotal(seat({ slot: 1, value_over_slot: null }), "value_over_slot")).toBeNull();
    expect(gradedLabel("value").short).toBe("Σ value");
    expect(gradedLabel("value_over_slot").short).toBe("Σ VOS");
    expect(gradedLabel(null).short).toBe("Σ VOS");
  });

  test("the headline is signed for a surplus and plain for a total", () => {
    expect(formatGradedTotal(33.2, "value_over_slot")).toBe("+33.2");
    expect(formatGradedTotal(-4, "value_over_slot")).toBe("-4.0");
    expect(formatGradedTotal(812.4, "value")).toBe("812");
    expect(formatGradedTotal(null, "value")).toBe("—");
  });
});

describe("rankTone", () => {
  test("tertiles of the field, so a tint means the same in any room size", () => {
    expect([1, 4, 5, 8, 9, 12].map((r) => rankTone(r, 12))).toEqual([
      "high", "high", "mid", "mid", "low", "low",
    ]);
    expect([1, 2, 3, 4].map((r) => rankTone(r, 4))).toEqual(["high", "high", "low", "low"]);
    expect([1, 2].map((r) => rankTone(r, 2))).toEqual(["high", "low"]);
    expect(rankTone(1, 1)).toBe("mid");
    expect(rankTone(2.5, 4)).toBe("mid");
    expect(rankTone(null, 12)).toBeNull();
  });
});

describe("standings", () => {
  test("the mode follows the basis, and nothing when there are none", () => {
    expect(standingsMode(meta(), [])).toBe("none");
    expect(standingsMode(meta(), [standing({ slot: 1 })])).toBe("points");
    expect(
      standingsMode(meta({ standings_basis: "z_sum", categories: NINE_CAT }), [standing({ slot: 1 })])
    ).toBe("categories");
    // A z-sum basis with no categories to show has nothing to tabulate by.
    expect(standingsMode(meta({ standings_basis: "z_sum" }), [standing({ slot: 1 })])).toBe("points");
    expect(standingsMode(null, [standing({ slot: 1 })])).toBe("points");
  });

  test("seats and standings order best first, unranked last", () => {
    const seats = [
      seat({ slot: 1, position: 3 }),
      seat({ slot: 2, position: null }),
      seat({ slot: 3, position: 1 }),
      seat({ slot: 4, position: 2 }),
    ];
    expect(sortSeats(seats).map((s) => s.slot)).toEqual([3, 4, 1, 2]);
    const table = [
      standing({ slot: 1, roto_rank: 2, value_rank: 1 }),
      standing({ slot: 2, roto_rank: 1, value_rank: 2 }),
      standing({ slot: 3, roto_rank: null, value_rank: null }),
    ];
    expect(sortStandings(table, "categories").map((s) => s.slot)).toEqual([2, 1, 3]);
    expect(sortStandings(table, "points").map((s) => s.slot)).toEqual([1, 2, 3]);
  });

  test("a head-to-head cell is found by opponent and read as a record", () => {
    const row = standing({
      slot: 1,
      h2h: [
        { opponent_slot: 2, won: 5, lost: 3, tied: 1 },
        { opponent_slot: 3, won: 2, lost: 6, tied: 1 },
        { opponent_slot: 4, won: 4, lost: 4, tied: 1 },
      ],
    });
    expect(h2hOutcome(h2hCell(row, 2)!)).toBe("win");
    expect(h2hOutcome(h2hCell(row, 3)!)).toBe("loss");
    expect(h2hOutcome(h2hCell(row, 4)!)).toBe("tie");
    expect(h2hCell(row, 9)).toBeNull();
  });
});

describe("recapCaveats", () => {
  test("a finished, fully valued snake says only whom it graded against", () => {
    const out = recapCaveats(meta(), 4);
    expect(out.map((c) => c.key)).toEqual(["graded"]);
    expect(out[0].text).toContain("4 seats in this room");
    expect(out[0].tone).toBe("info");
  });

  test("every other caveat has a trigger", () => {
    const out = recapCaveats(
      meta({
        graded_by: "value",
        draft_type: "auction",
        complete: false,
        status: "active",
        picks_made: 30,
        total_picks: 52,
        unscored: 1,
        unattributed: 2,
      }),
      4
    );
    expect(out.map((c) => c.key)).toEqual([
      "graded", "auction", "incomplete", "unscored", "unattributed",
    ]);
    expect(out.find((c) => c.key === "incomplete")?.text).toBe(
      "30 of 52 picks recorded — the draft is still going; grades cover what was drafted"
    );
    expect(out.find((c) => c.key === "unscored")?.text).toContain("1 pick nothing could value");
    expect(out.find((c) => c.key === "unattributed")?.text).toContain("2 picks with no seat");
    expect(out.filter((c) => c.tone === "warn").map((c) => c.key)).toEqual([
      "incomplete", "unscored", "unattributed",
    ]);
  });

  test("a room that stopped early, a room with no seats, no meta", () => {
    const stopped = recapCaveats(
      meta({ complete: false, status: "completed", picks_made: 51, total_picks: null }),
      0
    );
    expect(stopped.map((c) => c.key)).toEqual(["incomplete"]);
    expect(stopped[0].text).toContain("51 of ? picks recorded — the draft stopped early");
    expect(recapCaveats(null, 4)).toEqual([]);
  });
});

describe("asOfLabel", () => {
  test("names the snapshots that were dated", () => {
    expect(asOfLabel(meta({ projections_as_of: "2026-09-01", market_as_of: "2026-09-05" }))).toBe(
      "projections 2026-09-01 · market 2026-09-05"
    );
    expect(asOfLabel(meta({ market_as_of: "2026-09-05" }))).toBe("market 2026-09-05");
    expect(asOfLabel(meta())).toBeNull();
    expect(asOfLabel(null)).toBeNull();
  });
});

describe("pickSourceGlyph and signed", () => {
  test("a provenance mark for everything but the keyboard", () => {
    expect(pickSourceGlyph("keeper")?.glyph).toBe("K");
    expect(pickSourceGlyph("import")?.glyph).toBe("I");
    expect(pickSourceGlyph("mock")?.glyph).toBe("M");
    expect(pickSourceGlyph("espn_sync")?.glyph).toBe("E");
    expect(pickSourceGlyph("manual")).toBeNull();
  });

  test("signed numbers", () => {
    expect(signed(3.25)).toBe("+3.3");
    expect(signed(-1)).toBe("-1.0");
    expect(signed(0)).toBe("0.0");
    expect(signed(7, 0)).toBe("+7");
    expect(signed(null)).toBe("—");
  });
});
