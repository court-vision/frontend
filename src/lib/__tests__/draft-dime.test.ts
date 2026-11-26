/**
 * Dime in a draft room: which note is about which pick, when the room asks for
 * Dime's pick on its own (and once more when its player goes first), and what
 * makes the room read itself again.
 */
import { describe, expect, test } from "bun:test";
import {
  dimePickFor,
  draftedIds,
  failedLine,
  noteForPick,
  noteLabel,
  notePreview,
  pickOf,
  pickToAsk,
  recapFacts,
  roomSignature,
  seatBusy,
  seatPicks,
  seatReason,
  shouldPoll,
} from "../draft-dime";
import type { DimeDraftNote, DimeDraftRoom, DraftSession } from "../../types/draft";

let nextId = 1;
const note = (over: Partial<DimeDraftNote>): DimeDraftNote => ({
  id: nextId++,
  kind: "pick",
  for_pick: 3,
  seat: false,
  state: "done",
  reason: null,
  facts: {},
  text: "Take him.",
  plan: null,
  punts: null,
  punts_before: null,
  took: null,
  pick: null,
  conversation_id: 7,
  cost_usd: 0.01,
  created_at: "2026-11-05T12:00:00Z",
  finished_at: null,
  ...over,
});

const room = (over: Partial<DimeDraftRoom> = {}): DimeDraftRoom => ({
  enabled: true,
  available: true,
  switched_off: false,
  lead: 2,
  notes_on: true,
  seat: { state: "off", reason: null, live: false },
  can_seat: true,
  seat_blocker: null,
  running: null,
  notes: [],
  ...over,
});

const session = (over: Partial<DraftSession> = {}) =>
  ({ status: "active", my_next_pick: 10, picks_until_my_turn: 2, picks: [], ...over }) as DraftSession;

/** A pick drafted in the room, by whichever seat. */
const drafted = (...ids: number[]) => ids.map((player_id, i) => ({ overall_pick: i + 1, player_id })) as unknown as DraftSession["picks"];

/** Dime's pick for #10: Mock 001. */
const chose = (over: Partial<DimeDraftNote> = {}) =>
  note({ for_pick: 10, pick: { player_id: 1, name: "Mock 001", position: "PG", team: "BOS", reason: "No guard yet" }, ...over });

describe("asking for Dime's pick", () => {
  test("asks for the coming pick once it is `lead` picks away, the pick on the clock included", () => {
    expect(pickToAsk(room(), session())).toBe(10);
    expect(pickToAsk(room(), session({ picks_until_my_turn: 0 }))).toBe(10);
  });

  test("waits while the pick is further off", () => {
    expect(pickToAsk(room(), session({ picks_until_my_turn: 3 }))).toBeNull();
  });

  test("no switch: the old notes switch off still asks", () => {
    expect(pickToAsk(room({ notes_on: false }), session())).toBe(10);
  });

  test("asks nothing with Dime unavailable or the draft over", () => {
    expect(pickToAsk(room({ available: false }), session())).toBeNull();
    expect(pickToAsk(room(), session({ status: "completed" }))).toBeNull();
    expect(pickToAsk(room(), session({ my_next_pick: null, picks_until_my_turn: null }))).toBeNull();
  });

  test("asks once per pick: a note there, even a failed one, holds it", () => {
    expect(pickToAsk(room({ notes: [chose()] }), session())).toBeNull();
    expect(pickToAsk(room({ notes: [note({ for_pick: 10, state: "failed" })] }), session())).toBeNull();
    expect(pickToAsk(room({ notes: [chose({ state: "running", pick: null })] }), session())).toBeNull();
    // ...except a finished note from before Dime chose players, which the server replaces
    expect(pickToAsk(room({ notes: [note({ for_pick: 10 })] }), session())).toBe(10);
    // The note about the last pick doesn't
    expect(pickToAsk(room({ notes: [note({ for_pick: 3 })] }), session())).toBe(10);
  });

  test("asks once more when another seat drafts Dime's player first", () => {
    const gone = session({ picks: drafted(1) });
    expect(pickToAsk(room({ notes: [chose()] }), gone)).toBe(10);
    // Somebody else going doesn't
    expect(pickToAsk(room({ notes: [chose()] }), session({ picks: drafted(2) }))).toBeNull();
    // After one retake the second choice stands, drafted or not
    const retaken = [chose({ pick: { player_id: 2, name: "Mock 002" } }), chose({ state: "failed", reason: "taken" })];
    expect(pickToAsk(room({ notes: retaken }), session({ picks: drafted(1, 2) }))).toBeNull();
  });

  test("a pick Dime made from the seat isn't the pick's note", () => {
    expect(noteForPick([note({ for_pick: 10, seat: true })], 10)).toBeNull();
    expect(pickToAsk(room({ notes: [note({ for_pick: 10, seat: true })] }), session())).toBe(10);
  });

  test("holds while another note runs or Dime drafts the seat", () => {
    expect(pickToAsk(room({ running: 4 }), session())).toBeNull();
    expect(pickToAsk(room({ seat: { state: "drafting", reason: null, live: true } }), session())).toBeNull();
    // A seat whose loop died doesn't hold it
    expect(pickToAsk(room({ seat: { state: "drafting", reason: null, live: false } }), session())).toBe(10);
  });
});

describe("Dime's pick", () => {
  test("is the newest pick note's player, while he is still on the board", () => {
    const pick = dimePickFor(room({ notes: [chose()] }), session());
    expect(pick).toMatchObject({ forPick: 10, playerId: 1, name: "Mock 001", reason: "No guard yet", conversationId: 7 });
    expect(dimePickFor(room({ notes: [chose()] }), session({ picks: drafted(1) }))).toBeNull();
  });

  test("nothing while Dime is choosing, failed, holds the seat, or the draft is over", () => {
    expect(dimePickFor(room({ notes: [chose({ state: "running" })] }), session())).toBeNull();
    expect(dimePickFor(room({ notes: [chose({ state: "failed" })] }), session())).toBeNull();
    expect(dimePickFor(room({ notes: [chose()], seat: { state: "drafting", reason: null, live: true } }), session())).toBeNull();
    expect(dimePickFor(room({ notes: [chose()] }), session({ status: "completed" }))).toBeNull();
    // A pick for another of the user's picks isn't this one's
    expect(dimePickFor(room({ notes: [chose({ for_pick: 3 })] }), session())).toBeNull();
  });

  test("a note with no player, or one written before Dime chose one, reads as none", () => {
    expect(pickOf(note({ for_pick: 10 }))).toBeNull();
    expect(pickOf(note({ for_pick: 10, pick: { player_id: "1" } }))).toBeNull();
    expect(pickOf(chose({ seat: true }))).toBeNull();
  });

  test("drafted ids skip picks with no player", () => {
    expect([...draftedIds({ picks: [{ player_id: 4 }, { player_id: null }] as unknown as DraftSession["picks"] })]).toEqual([4]);
  });
});

describe("the room's notes", () => {
  test("the seat's picks read oldest first, done ones with a pick only", () => {
    const a = note({ seat: true, for_pick: 3, took: { name: "A" } });
    const b = note({ seat: true, for_pick: 6, took: { name: "B" } });
    const failed = note({ seat: true, for_pick: 11, state: "failed" });
    expect(seatPicks([failed, b, a, note({})]).map((n) => n.for_pick)).toEqual([3, 6]);
  });

  test("labels", () => {
    expect(noteLabel(note({ kind: "plan", for_pick: null }))).toBe("Plan");
    expect(noteLabel(note({ for_pick: 10 }))).toBe("Pick 10");
    expect(noteLabel(chose())).toBe("Pick 10 · Mock 001");
    expect(noteLabel(note({ for_pick: 10, seat: true }))).toBe("Took pick 10");
    expect(noteLabel(note({ kind: "recap", for_pick: null }))).toBe("Recap");
  });

  test("why a note failed", () => {
    expect(failedLine(note({}))).toBeNull();
    expect(failedLine(note({ state: "failed", reason: "stale" }))).toContain("stopped");
    expect(failedLine(note({ state: "failed", reason: "taken" }))).toContain("picked again");
    expect(failedLine(note({ state: "failed", reason: "AI_MONTHLY_BUDGET_REACHED" }))).toContain("budget");
    expect(failedLine(note({ state: "failed", reason: "INTERNAL_ERROR" }))).toBe("It couldn't be written");
  });
});

describe("facts", () => {
  test("a recap note's", () => {
    expect(recapFacts(note({ kind: "recap", facts: { grade: "B+", place: 2, seats: 10, value_over_slot: 31.5, by_dime: 13 } }))).toEqual({
      grade: "B+",
      place: 2,
      seats: 10,
      valueOverSlot: 31.5,
      byDime: 13,
    });
  });
});

describe("the seat", () => {
  test("busy while its loop runs", () => {
    expect(seatBusy(room())).toBe(false);
    expect(seatBusy(room({ seat: { state: "drafting", reason: null, live: true } }))).toBe(true);
    expect(seatBusy(room({ seat: { state: "stopping", reason: null, live: true } }))).toBe(true);
    expect(seatBusy(room({ seat: { state: "drafting", reason: null, live: false } }))).toBe(false);
    expect(seatBusy(null)).toBe(false);
  });

  test("why it came back", () => {
    expect(seatReason({ state: "off", reason: "done", live: false })).toContain("to the end");
    expect(seatReason({ state: "off", reason: "switched_off", live: false })).toContain("switched off");
    expect(seatReason({ state: "off", reason: "AI_MONTHLY_BUDGET_REACHED", live: false })).toContain("ai monthly budget reached");
    expect(seatReason({ state: "drafting", reason: "done", live: true })).toBeNull();
    expect(seatReason({ state: "off", reason: null, live: false })).toBeNull();
  });
});

describe("reading again", () => {
  test("polls while a note runs or Dime holds the seat", () => {
    expect(shouldPoll(room())).toBe(false);
    expect(shouldPoll(room({ running: 3 }))).toBe(true);
    expect(shouldPoll(room({ seat: { state: "drafting", reason: null, live: true } }))).toBe(true);
    expect(shouldPoll(room({ available: false, running: 3 }))).toBe(false);
    expect(shouldPoll(undefined)).toBe(false);
  });

  test("the signature moves when a note finishes or the seat changes hands", () => {
    const running = room({ running: 5, notes: [note({ state: "running" })] });
    const done = room({ notes: [note({})] });
    expect(roomSignature(running)).not.toBe(roomSignature(done));
    expect(roomSignature(done)).toBe(roomSignature(room({ notes: [note({})] })));
    expect(roomSignature(done)).not.toBe(roomSignature(room({ notes: [note({})], seat: { state: "drafting", reason: null, live: true } })));
    expect(roomSignature(null)).toBe("");
  });
});

describe("Dime's notes on a room's recap", () => {
  test("a note's line is its first paragraph, plain and cut", () => {
    expect(notePreview(null)).toBeNull();
    expect(notePreview("**Take Mock 001.** He fits the punt.\n\nRunner-up: Mock 004.")).toBe("Take Mock 001. He fits the punt.");
    expect(notePreview("- First bullet\n- Second")).toBe("First bullet");
    const long = notePreview("x".repeat(300), 20);
    expect(long).toHaveLength(20);
    expect(long?.endsWith("…")).toBe(true);
  });
});
