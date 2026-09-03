import { describe, expect, test } from "bun:test";
import {
  canonicalSlot,
  capStatuses,
  fillLineup,
  keeperStatuses,
  lastPick,
  myRoster,
  openStartingSlots,
  startableSlots,
  teamStacks,
  type RosterPlayer,
} from "../draft-roster";
import type { DraftKeeperOut, DraftPick, DraftRosterEntry } from "../../types/draft";

const ESPN_SLOTS = { PG: 1, SG: 1, SF: 1, PF: 1, C: 1, G: 1, F: 1, UT: 3, BE: 3, IR: 1 };

function player(overrides: Partial<RosterPlayer> & { player_id: number }): RosterPlayer {
  return {
    name: `P${overrides.player_id}`,
    primary_position: null,
    positions: null,
    team: null,
    overall_pick: null,
    keeper: false,
    ...overrides,
  };
}

function pick(overrides: Partial<DraftPick> & { overall_pick: number }): DraftPick {
  return {
    round: null,
    slot: null,
    player_id: null,
    espn_player_id: null,
    player_name: null,
    by_me: false,
    source: "manual",
    bid: null,
    created_at: null,
    ...overrides,
  };
}

function keeper(overrides: Partial<DraftKeeperOut>): DraftKeeperOut {
  return { player_id: null, espn_player_id: null, name: null, round: null, overall_pick: null, ...overrides };
}

describe("startableSlots", () => {
  test("ESPN's eligibility wins, bench and IR dropped", () => {
    expect(startableSlots({ primary_position: "C", positions: ["C", "UT", "BE", "IR"] })).toEqual(["C", "UT"]);
  });

  test("falls back to what the primary position implies, then to UT alone", () => {
    expect(startableSlots({ primary_position: "PG", positions: null })).toEqual(["PG", "G", "G/F", "UT"]);
    expect(startableSlots({ primary_position: null, positions: [] })).toEqual(["UT"]);
  });
});

describe("fillLineup", () => {
  test("a pure centre takes C before the PF/C does, and the rest fall to UT and the bench", () => {
    const pfc = player({ player_id: 1, positions: ["PF", "C", "F", "UT"], primary_position: "PF" });
    const c = player({ player_id: 2, positions: ["C", "UT"], primary_position: "C" });
    const lineup = fillLineup(ESPN_SLOTS, [pfc, c]);
    const at = (slot: string) => lineup.slots.find((s) => s.slot === slot)?.player?.player_id ?? null;
    expect(at("C")).toBe(2);
    expect(at("PF")).toBe(1);
    expect(lineup.overflow).toEqual([]);
  });

  test("an unplaceable player is overflow, not dropped", () => {
    const centres = [1, 2, 3, 4, 5, 6, 7, 8].map((id) =>
      player({ player_id: id, positions: ["C", "UT"], primary_position: "C" })
    );
    // 1 C + 3 UT + 3 BE = 7 seats for eight centres.
    const lineup = fillLineup(ESPN_SLOTS, centres);
    expect(lineup.slots.filter((s) => s.player !== null)).toHaveLength(7);
    expect(lineup.overflow).toHaveLength(1);
  });

  test("slots the league does not have are not invented", () => {
    const lineup = fillLineup({ C: 2, BE: 1 }, [player({ player_id: 1, primary_position: "PG" })]);
    expect(lineup.slots.map((s) => s.slot)).toEqual(["C", "C", "BE"]);
    expect(lineup.slots[2].player?.player_id).toBe(1);   // a guard can only sit
  });

  test("open starting slots count what is empty, bench excluded", () => {
    const lineup = fillLineup(ESPN_SLOTS, [player({ player_id: 1, primary_position: "C", positions: ["C", "UT"] })]);
    expect(openStartingSlots(lineup)).toEqual([
      { slot: "PG", open: 1 }, { slot: "SG", open: 1 }, { slot: "SF", open: 1 }, { slot: "PF", open: 1 },
      { slot: "G", open: 1 }, { slot: "F", open: 1 }, { slot: "UT", open: 3 },
    ]);
  });
});

describe("capStatuses and teamStacks", () => {
  test("caps count primary positions only, in position order", () => {
    const players = [
      player({ player_id: 1, primary_position: "C" }),
      player({ player_id: 2, primary_position: "C" }),
      player({ player_id: 3, primary_position: "PF", positions: ["PF", "C", "UT"] }),   // C-eligible, not a C
    ];
    expect(capStatuses(players, { C: 4, PG: 2 })).toEqual([
      { position: "PG", count: 0, limit: 2 },
      { position: "C", count: 2, limit: 4 },
    ]);
  });

  test("stacks start at two, biggest first", () => {
    const players = [
      player({ player_id: 1, team: "DEN" }), player({ player_id: 2, team: "DEN" }),
      player({ player_id: 3, team: "DEN" }), player({ player_id: 4, team: "LAL" }),
      player({ player_id: 5, team: "LAL" }), player({ player_id: 6, team: "BOS" }),
      player({ player_id: 7, team: null }),
    ];
    expect(teamStacks(players)).toEqual([{ team: "DEN", count: 3 }, { team: "LAL", count: 2 }]);
  });
});

describe("keeperStatuses", () => {
  test("recorded when a pick holds the player, by the strongest shared identity", () => {
    const picks = [
      pick({ overall_pick: 18, player_id: 9, source: "keeper", by_me: true }),
      pick({ overall_pick: 3, espn_player_id: 555, player_name: "Lagging Guy" }),
    ];
    const statuses = keeperStatuses(
      [
        keeper({ player_id: 9, name: "Kept", round: 2, overall_pick: 18 }),
        keeper({ name: " lagging guy ", round: 3, overall_pick: 23 }),
        keeper({ player_id: 11, name: "Pending", round: 4, overall_pick: 38 }),
      ],
      picks
    );
    expect(statuses.map((s) => [s.recorded, s.blocker])).toEqual([
      [true, null], [true, null], [false, null],
    ]);
  });

  test("a keeper with no round, or no slot to price it, is blocked and says why", () => {
    const statuses = keeperStatuses(
      [keeper({ player_id: 1, name: "A" }), keeper({ player_id: 2, name: "B", round: 2 }), keeper({})],
      []
    );
    expect(statuses.map((s) => s.blocker)).toEqual(["no round", "set your slot", "no player"]);
  });
});

describe("myRoster and lastPick", () => {
  const entry = (player_id: number, extra: Partial<DraftRosterEntry> = {}): DraftRosterEntry => ({
    player_id, name: `P${player_id}`, team: "DEN", primary_position: "C", positions: ["C", "UT"],
    value: 40, value_source: "baseline", injury_status: null, ...extra,
  });

  test("my picks in order, joined to the board's roster entries; an unplaced pick still shows", () => {
    const picks = [
      pick({ overall_pick: 18, player_id: 2, by_me: true, source: "keeper" }),
      pick({ overall_pick: 3, player_id: 1, by_me: true }),
      pick({ overall_pick: 4, player_id: 7 }),                                  // someone else's
      pick({ overall_pick: 23, player_name: "Not Synced Yet", by_me: true }),   // player_id null
    ];
    const roster = myRoster([entry(1), entry(2)], picks);
    expect(roster.map((p) => [p.player_id, p.overall_pick, p.keeper, p.primary_position])).toEqual([
      [1, 3, false, "C"], [2, 18, true, "C"], [-23, 23, false, null],
    ]);
    expect(roster[2].name).toBe("Not Synced Yet");
  });

  test("roster entries with no pick behind them still count (the stateless board's `mine`)", () => {
    expect(myRoster([entry(5)], []).map((p) => [p.player_id, p.overall_pick])).toEqual([[5, null]]);
  });

  test("undo last targets the latest pick made on the clock, never a keeper unless nothing else", () => {
    const keeperAt18 = pick({ overall_pick: 18, source: "keeper" });
    expect(lastPick([keeperAt18, pick({ overall_pick: 4 }), pick({ overall_pick: 2 })])?.overall_pick).toBe(4);
    expect(lastPick([keeperAt18])?.overall_pick).toBe(18);
    expect(lastPick([])).toBeNull();
  });
});

describe("provider slot labels", () => {
  test("UTIL, BN and IL normalize onto the labels the fill understands", () => {
    expect(canonicalSlot("UTIL")).toBe("UT");
    expect(canonicalSlot("util")).toBe("UT");
    expect(canonicalSlot("BN")).toBe("BE");
    expect(canonicalSlot("IL")).toBe("IR");
    expect(canonicalSlot("PG")).toBe("PG");
    expect(canonicalSlot(" C ")).toBe("C");
  });

  test("a league spelling its slots UTIL still gets those seats", () => {
    const lineup = fillLineup({ C: 1, UTIL: 2, BN: 1 }, [
      player({ player_id: 1, primary_position: "C", positions: ["C", "UTIL"] }),
      player({ player_id: 2, primary_position: "PG", positions: ["PG", "UTIL"] }),
      player({ player_id: 3, primary_position: "SF", positions: ["SF", "UTIL"] }),
    ]);
    expect(lineup.slots.map((s) => s.slot)).toEqual(["C", "UT", "UT", "BE"]);
    expect(lineup.overflow).toEqual([]);
    // ...and the UT seats really were filled, not merely present.
    expect(lineup.slots.filter((s) => s.player !== null)).toHaveLength(3);
  });

  test("duplicate spellings of one slot add up rather than overwrite", () => {
    const lineup = fillLineup({ UT: 1, UTIL: 1 }, []);
    expect(lineup.slots.map((s) => s.slot)).toEqual(["UT", "UT"]);
  });
});
