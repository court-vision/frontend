/**
 * Mock-mode rules. The refusals mirror the server's, so these tests are as much
 * a record of that contract as a check on the copy — if the backend's order of
 * refusals changes, this is where it should be noticed.
 */
import { describe, expect, test } from "bun:test";
import {
  mockAdvanceToast,
  mockBlocker,
  mockMyTurnBlocker,
  needsSeatConfirm,
} from "../draft-mock";
import type { DraftSession, MockAdvance } from "../../types/draft";

function session(overrides: Partial<DraftSession> = {}): DraftSession {
  return {
    id: 1,
    team_id: null,
    league_id: null,
    kind: "mock",
    status: "active",
    name: null,
    espn_league_id: null,
    draft_type: "snake",
    pick_order: [1, 2, 3, 4],
    my_slot: 3,
    rounds: 13,
    keepers: [],
    punts: [],
    league_size: 4,
    keeper_count: null,
    total_picks: 52,
    pick_count: 0,
    next_overall_pick: 1,
    my_next_pick: 3,
    picks_until_my_turn: 2,
    picks: [],
    started_at: null,
    completed_at: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

function advance(overrides: Partial<MockAdvance> = {}): MockAdvance {
  return {
    session: session(),
    picks_made: 7,
    until: "my_turn",
    from_pick: 1,
    stopped_at: 8,
    stopped_reason: "my_turn",
    completed: false,
    fallback: false,
    market_as_of: "2026-09-01",
    ...overrides,
  };
}

describe("mockBlocker", () => {
  test("a mock room following nothing is simulatable", () => {
    expect(mockBlocker(session())).toBeNull();
  });

  test("a room tracking a real draft is refused, and named as what it is", () => {
    expect(mockBlocker(session({ kind: "manual" }))).toContain("manual room");
    expect(mockBlocker(session({ kind: "live" }))).toContain("live room");
  });

  test("a mock room already following an ESPN draft is refused with that draft named", () => {
    // Simulating into it would write picks the next INIT collides with on
    // every number — the same refusal the server makes.
    expect(mockBlocker(session({ espn_league_id: 552315826 }))).toContain("552315826");
  });

  test("a finished room has nothing to simulate", () => {
    expect(mockBlocker(session({ status: "completed" }))).toBe("This draft is completed");
  });

  test("an auction room is refused, because the autopicker has no bidding model", () => {
    expect(mockBlocker(session({ draft_type: "auction" }))).toContain("bidding model");
  });

  test("a room with no pick order has no seats to play and no end to run to", () => {
    expect(mockBlocker(session({ total_picks: null }))).toContain("nothing to run to");
  });
});

describe("mockMyTurnBlocker", () => {
  test("stopping at my turn needs a turn to stop at", () => {
    expect(mockMyTurnBlocker(session({ my_slot: null }))).toContain("no seat of yours");
  });

  test("anything that blocks the room blocks this too, with the room's own reason", () => {
    expect(mockMyTurnBlocker(session({ kind: "manual", my_slot: null }))).toContain("manual room");
  });

  test("a room with a seat can stop at it", () => {
    expect(mockMyTurnBlocker(session())).toBeNull();
  });
});

describe("needsSeatConfirm", () => {
  test("running to the end asks first while a pick of mine is still to come", () => {
    expect(needsSeatConfirm(session())).toBe(true);
  });

  test("nothing of mine is at stake without a slot, or once my turns are behind me", () => {
    expect(needsSeatConfirm(session({ my_slot: null }))).toBe(false);
    expect(needsSeatConfirm(session({ my_next_pick: null }))).toBe(false);
  });
});

describe("mockAdvanceToast", () => {
  test("a run that stopped at my turn says where the clock is", () => {
    const { title, description } = mockAdvanceToast(advance());
    expect(title).toBe("7 picks simulated");
    expect(description).toContain("on the clock at pick 8");
  });

  test("one pick is not one picks", () => {
    expect(mockAdvanceToast(advance({ picks_made: 1 })).title).toBe("1 pick simulated");
  });

  test("a run that made no picks does not announce zero", () => {
    const { title, description } = mockAdvanceToast(
      advance({ picks_made: 0, stopped_at: 3 })
    );
    expect(title).toBe("Already on the clock");
    expect(description).toBe("Pick 3 is yours.");
  });

  test("finishing the draft says so", () => {
    expect(
      mockAdvanceToast(advance({ stopped_reason: "end", completed: true, stopped_at: null }))
        .description
    ).toContain("The mock is finished");
  });

  test("a cap stop names the seat's caps rather than blaming the board", () => {
    expect(
      mockAdvanceToast(advance({ stopped_reason: "cap_blocked", stopped_at: 39 })).description
    ).toContain("position caps");
  });

  test("an exhausted pool says the board ran out", () => {
    expect(
      mockAdvanceToast(advance({ stopped_reason: "pool_exhausted", stopped_at: 39 })).description
    ).toContain("nothing draftable is left");
  });

  test("a fallback run says the seats drafted by CV value, not by ADP", () => {
    // Every run on a database with no market snapshot; a statement of method,
    // never phrased as something going wrong.
    const { description } = mockAdvanceToast(advance({ fallback: true, market_as_of: null }));
    expect(description).toContain("CV value");
    expect(description).not.toContain("ADP");
  });

  test("a market-backed run dates the ADP it drafted from", () => {
    expect(mockAdvanceToast(advance()).description).toContain("ADP as of 2026-09-01");
  });
});
