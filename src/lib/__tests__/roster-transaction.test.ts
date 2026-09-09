import { describe, expect, test } from "bun:test";
import {
  STALE_POOL_REASONS,
  addBlockedReason,
  canAddWithoutDrop,
  dropCandidates,
  rosterCapacity,
  streamerCaption,
  transactionBody,
  transactionError,
  transactionOutcomeCopy,
  waiversClearsSuffix,
} from "../roster-transaction";
import { ApiError } from "../api-error";
import { MOCK_LINEUP_STATE } from "../../__fixtures__/lineupState";
import type { LineupState } from "../../types/lineup-editor";
import type { StreamerData, StreamerPlayer } from "../../types/streamer";

const BE = 12, IR = 13;

function streamer(overrides: Partial<StreamerPlayer> = {}): StreamerPlayer {
  return {
    player_id: 4396993,
    nba_player_id: 1630595,
    name: "Cam Thomas",
    team: "BKN",
    valid_positions: ["SG"],
    avg_points_last_n: 31.2,
    avg_points_season: 29.8,
    avg_source: "rolling",
    games_remaining: 3,
    has_b2b: true,
    b2b_game_count: 1,
    game_days: [1, 2, 4],
    streamer_score: 88.4,
    injured: false,
    injury_status: null,
    acquisition_status: "free_agent",
    waivers_until: null,
    ...overrides,
  };
}

function search(overrides: Partial<StreamerData> = {}): StreamerData {
  return {
    matchup_number: 3,
    current_day_index: 2,
    game_span: 7,
    start_date: "2026-11-02",
    end_date: "2026-11-08",
    upcoming: false,
    avg_days: 7,
    mode: "daily",
    target_day: null,
    teams_with_b2b: [],
    streamers: [],
    value_kind: "fpts",
    ...overrides,
  };
}

function invalid(reason: string, message: string, playerId: number | null = 4396993): ApiError {
  const body = {
    status: "validation_error",
    message,
    error_code: "ROSTER_TRANSACTION_INVALID",
    data: { reason, player_id: playerId },
  };
  return ApiError.fromResponse(new Response(JSON.stringify(body), { status: 422 }), body);
}

describe("capacity", () => {
  test("sums slot_counts (IR included) and reads the fixture's open bench seat", () => {
    // PG SG SF PF C G F (7) + 3 UT + 3 BE + 1 IR = 14 seats, 13 players.
    expect(rosterCapacity(MOCK_LINEUP_STATE)).toBe(14);
    expect(MOCK_LINEUP_STATE.players).toHaveLength(13);
    expect(canAddWithoutDrop(MOCK_LINEUP_STATE)).toBe(true);
  });

  test("a full board needs a drop", () => {
    const full: LineupState = {
      ...MOCK_LINEUP_STATE,
      slot_counts: { ...MOCK_LINEUP_STATE.slot_counts, "12": 2 },
    };
    expect(rosterCapacity(full)).toBe(13);
    expect(canAddWithoutDrop(full)).toBe(false);
  });

  test("falls back to the slot definitions when slot_counts is empty", () => {
    const bare: LineupState = { ...MOCK_LINEUP_STATE, slot_counts: {} };
    expect(rosterCapacity(bare)).toBe(14);
  });
});

describe("dropCandidates", () => {
  test("lists everyone in SLOT_ORDER — starters, then bench, then IR — and flags the locked", () => {
    const rows = dropCandidates(MOCK_LINEUP_STATE);
    expect(rows).toHaveLength(13);
    const slots = rows.map((r) => r.player.lineup_slot_id);
    // Non-decreasing by SLOT_ORDER position: 0..11 first, then 12, then 13.
    for (let i = 1; i < slots.length; i++) expect(slots[i]).toBeGreaterThanOrEqual(slots[i - 1]);
    expect(rows.at(-1)?.player.lineup_slot_id).toBe(IR);
    expect(rows.filter((r) => r.player.lineup_slot_id === BE)).toHaveLength(2);
    // Desmond Bane's game has started.
    const bane = rows.find((r) => r.player.player_id === 4432173);
    expect(bane?.locked).toBe(true);
    expect(rows.filter((r) => r.locked)).toHaveLength(1);
  });

  test("keeps board order within a slot and sinks unknown slots to the end", () => {
    const stray: LineupState = {
      ...MOCK_LINEUP_STATE,
      players: [
        { ...MOCK_LINEUP_STATE.players[0], player_id: 1, lineup_slot_id: 14 },
        ...MOCK_LINEUP_STATE.players,
      ],
    };
    const rows = dropCandidates(stray);
    expect(rows.at(-1)?.player.player_id).toBe(1);
    const ut = rows.filter((r) => r.player.lineup_slot_id === 11).map((r) => r.player.name);
    expect(ut).toEqual(["Alperen Şengün", "Kawhi Leonard", "Scoot Henderson"]);
  });
});

describe("addBlockedReason", () => {
  test("only ESPN teams can add", () => {
    expect(addBlockedReason({ player: streamer(), state: MOCK_LINEUP_STATE, provider: "yahoo" })).toBe(
      "Adding players is available for ESPN teams"
    );
    expect(addBlockedReason({ player: streamer(), state: MOCK_LINEUP_STATE, provider: null })).toBe(
      "Adding players is available for ESPN teams"
    );
  });

  test("a waiver claim is refused, with the clearing date when known", () => {
    expect(
      addBlockedReason({
        player: streamer({ acquisition_status: "waivers", waivers_until: null }),
        state: MOCK_LINEUP_STATE,
        provider: "espn",
      })
    ).toBe("On waivers — claim him on ESPN");
    expect(
      addBlockedReason({
        player: streamer({ acquisition_status: "waivers", waivers_until: "2026-10-22" }),
        state: MOCK_LINEUP_STATE,
        provider: "espn",
      })
    ).toBe("On waivers — claim him on ESPN · clears Thu, Oct 22");
  });

  test("a read-only board uses the lineup editor's copy; a missing board is not a reason", () => {
    const readOnly: LineupState = {
      ...MOCK_LINEUP_STATE,
      can_write: false,
      write_blocked_reason: "no_credentials",
    };
    expect(addBlockedReason({ player: streamer(), state: readOnly, provider: "espn" })).toBe(
      "Add your ESPN cookies in Manage Teams to edit your lineup here."
    );
    expect(addBlockedReason({ player: streamer(), state: null, provider: "espn" })).toBeNull();
    expect(addBlockedReason({ player: streamer(), state: undefined, provider: "espn" })).toBeNull();
  });

  test("a free agent on a writable ESPN board may be added", () => {
    expect(addBlockedReason({ player: streamer(), state: MOCK_LINEUP_STATE, provider: "espn" })).toBeNull();
    // Yahoo-style "provider did not say" is not a waiver.
    expect(
      addBlockedReason({
        player: streamer({ acquisition_status: null }),
        state: MOCK_LINEUP_STATE,
        provider: "espn",
      })
    ).toBeNull();
  });
});

describe("waiversClearsSuffix", () => {
  test("formats the date, or nothing", () => {
    expect(waiversClearsSuffix("2026-10-22")).toBe(" · clears Thu, Oct 22");
    expect(waiversClearsSuffix(null)).toBe("");
    expect(waiversClearsSuffix(undefined)).toBe("");
  });
});

describe("transactionBody", () => {
  test("pins the add (and optional drop) to the board the user saw", () => {
    expect(transactionBody({ player: streamer(), dropId: 4066261, state: MOCK_LINEUP_STATE })).toEqual({
      add_player_id: 4396993,
      drop_player_id: 4066261,
      expected_scoring_period_id: 1,
      roster_version: "mock-1",
    });
    expect(transactionBody({ player: streamer(), dropId: null, state: MOCK_LINEUP_STATE })).toEqual({
      add_player_id: 4396993,
      drop_player_id: null,
      expected_scoring_period_id: 1,
      roster_version: "mock-1",
    });
  });

  test("a board with no scoring period has nothing to pin to", () => {
    const noPeriod: LineupState = { ...MOCK_LINEUP_STATE, scoring_period_id: null };
    expect(transactionBody({ player: streamer(), dropId: null, state: noPeriod })).toBeNull();
  });
});

describe("transactionOutcomeCopy", () => {
  const cam = { player_id: 4396993, name: "Cam Thomas", team: "BKN" };
  const monk = { player_id: 4066261, name: "Malik Monk", team: "SAC" };

  test("names both sides, or the one that happened", () => {
    expect(transactionOutcomeCopy({ added: cam, dropped: monk, verified: true })).toEqual({
      tone: "success",
      message: "Added Cam Thomas · dropped Malik Monk on ESPN",
    });
    expect(transactionOutcomeCopy({ added: cam, dropped: null, verified: true })).toEqual({
      tone: "success",
      message: "Added Cam Thomas on ESPN",
    });
    expect(transactionOutcomeCopy({ added: null, dropped: monk, verified: true })).toEqual({
      tone: "success",
      message: "Dropped Malik Monk on ESPN",
    });
  });

  test("an unconfirmed write is a warning", () => {
    expect(transactionOutcomeCopy({ added: cam, dropped: monk, verified: false })).toEqual({
      tone: "warning",
      message: "Sent to ESPN — not confirmed yet, check your roster",
    });
  });
});

describe("transactionError", () => {
  test("a 422 carries the server's reason, player and sentence", () => {
    expect(transactionError(invalid("drop_locked", "Malik Monk is locked — his game has started", 4066261))).toEqual({
      reason: "drop_locked",
      playerId: 4066261,
      message: "Malik Monk is locked — his game has started",
    });
  });

  test("a 409 ESPN rejection is ESPN's own sentence, with no reason", () => {
    const body = {
      status: "conflict",
      message: JSON.stringify({
        messages: ["Roster limit exceeded."],
        details: [{ shortMessage: "Too many players.", type: "TRAN_ROSTER_LIMIT" }],
      }),
      error_code: "ROSTER_WRITE_REJECTED",
      data: { espn_status: 409, espn_error_code: "TRAN_ROSTER_LIMIT" },
    };
    const err = ApiError.fromResponse(new Response(JSON.stringify(body), { status: 409 }), body);
    expect(transactionError(err)).toEqual({ reason: null, playerId: null, message: "Too many players." });
  });

  test("everything else is null", () => {
    expect(transactionError(null)).toBeNull();
    expect(transactionError(undefined)).toBeNull();
    expect(transactionError(new Error("boom"))).toBeNull();
    const body = { status: "conflict", message: "stale", error_code: "ROSTER_STALE", data: { lineup: MOCK_LINEUP_STATE } };
    expect(transactionError(ApiError.fromResponse(new Response(JSON.stringify(body), { status: 409 }), body))).toBeNull();
  });

  test("the pool-is-stale reasons are the three about the added player's availability", () => {
    expect([...STALE_POOL_REASONS].sort()).toEqual(["add_not_available", "add_not_found", "add_on_waivers"]);
    expect(STALE_POOL_REASONS.has("drop_locked")).toBe(false);
  });
});

describe("streamerCaption", () => {
  test("in season: the pickup day, or the day of the week", () => {
    expect(streamerCaption(search(), "daily")).toBe("Matchup 3 · Day 3 Pickup");
    expect(streamerCaption(search({ target_day: 5 }), "daily")).toBe("Matchup 3 · Day 6 Pickup");
    expect(streamerCaption(search(), "week")).toBe("Matchup 3 · Day 3 of 7");
  });

  test("before opening night: when the week starts, never a day", () => {
    const upcoming = search({ upcoming: true, matchup_number: 1, current_day_index: 0, start_date: "2026-10-20" });
    expect(streamerCaption(upcoming, "daily")).toBe("Matchup 1 · starts Tue, Oct 20");
    expect(streamerCaption(upcoming, "week")).toBe("Matchup 1 · starts Tue, Oct 20 · full week");
  });
});
