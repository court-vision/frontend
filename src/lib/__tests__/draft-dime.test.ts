/**
 * Dime in a draft room: which note is about which pick, when the notes switch
 * asks on its own, and what makes the room read itself again.
 */
import { describe, expect, test } from "bun:test";
import {
  deskRoomLabel,
  failedLine,
  latestPlan,
  noteForPick,
  noteLabel,
  notePreview,
  pickFacts,
  pickToAsk,
  puntLine,
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
  ({ status: "active", my_next_pick: 10, picks_until_my_turn: 2, ...over }) as DraftSession;

describe("the notes switch", () => {
  test("asks for the coming pick once it is `lead` picks away", () => {
    expect(pickToAsk(room(), session())).toBe(10);
    expect(pickToAsk(room(), session({ picks_until_my_turn: 0 }))).toBe(10);
  });

  test("waits while the pick is further off", () => {
    expect(pickToAsk(room(), session({ picks_until_my_turn: 3 }))).toBeNull();
  });

  test("asks nothing with the switch off, Dime unavailable, or the draft over", () => {
    expect(pickToAsk(room({ notes_on: false }), session())).toBeNull();
    expect(pickToAsk(room({ available: false }), session())).toBeNull();
    expect(pickToAsk(room(), session({ status: "completed" }))).toBeNull();
    expect(pickToAsk(room(), session({ my_next_pick: null, picks_until_my_turn: null }))).toBeNull();
  });

  test("asks once per pick: a note there, even a failed one, holds it", () => {
    expect(pickToAsk(room({ notes: [note({ for_pick: 10 })] }), session())).toBeNull();
    expect(pickToAsk(room({ notes: [note({ for_pick: 10, state: "failed" })] }), session())).toBeNull();
    // The note about the last pick doesn't
    expect(pickToAsk(room({ notes: [note({ for_pick: 3 })] }), session())).toBe(10);
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

describe("the room's notes", () => {
  test("the plan is the newest one that set a plan", () => {
    const running = note({ kind: "plan", for_pick: null, state: "running", plan: null });
    const set = note({ kind: "plan", for_pick: null, plan: "Punt FT%, build on bigs", punts: ["ftp"] });
    const old = note({ kind: "plan", for_pick: null, plan: "Best available" });
    expect(latestPlan([running, set, old])).toBe(set);
    expect(latestPlan([note({})])).toBeNull();
  });

  test("the seat's picks read oldest first, done ones with a pick only", () => {
    const a = note({ seat: true, for_pick: 3, took: { name: "A" } });
    const b = note({ seat: true, for_pick: 6, took: { name: "B" } });
    const failed = note({ seat: true, for_pick: 11, state: "failed" });
    expect(seatPicks([failed, b, a, note({})]).map((n) => n.for_pick)).toEqual([3, 6]);
  });

  test("labels", () => {
    expect(noteLabel(note({ kind: "plan", for_pick: null }))).toBe("Plan");
    expect(noteLabel(note({ for_pick: 10 }))).toBe("Pick 10");
    expect(noteLabel(note({ for_pick: 10, seat: true }))).toBe("Took pick 10");
    expect(noteLabel(note({ kind: "recap", for_pick: null }))).toBe("Recap");
  });

  test("why a note failed", () => {
    expect(failedLine(note({}))).toBeNull();
    expect(failedLine(note({ state: "failed", reason: "stale" }))).toContain("stopped");
    expect(failedLine(note({ state: "failed", reason: "AI_MONTHLY_BUDGET_REACHED" }))).toContain("budget");
    expect(failedLine(note({ state: "failed", reason: "INTERNAL_ERROR" }))).toBe("It couldn't be written");
  });

  test("punts with the room's labels", () => {
    expect(puntLine([])).toBe("no punts");
    expect(puntLine(null)).toBe("no punts");
    expect(puntLine(["ftp", "tov"], { ftp: "FT%" })).toBe("punt FT%, TOV");
  });
});

describe("facts", () => {
  test("a pick note's, read defensively", () => {
    const f = pickFacts(
      note({
        facts: {
          pick: 10,
          picks_until: 2,
          on_clock: false,
          gone_before: 10,
          top: [{ player_id: 1, name: "Mock 001", position: "PG", score: 412.3, availability: "likely", reason: "best" }, "junk"],
          gone: [{ name: "Mock 009", adp: 8.2 }],
          punts: ["ftp", 3],
          needs: [{ category: "reb", label: "REB", need: 1.2 }],
        },
      })
    );
    expect(f.pick).toBe(10);
    expect(f.onClock).toBe(false);
    expect(f.top).toHaveLength(1);
    expect(f.top[0].name).toBe("Mock 001");
    expect(f.gone[0].name).toBe("Mock 009");
    expect(f.punts).toEqual(["ftp"]);
    expect(f.needs).toEqual([{ label: "REB", need: 1.2 }]);
  });

  test("an empty dict reads as nothing", () => {
    const f = pickFacts(note({ facts: {} }));
    expect(f.top).toEqual([]);
    expect(f.pick).toBeNull();
    expect(f.onClock).toBe(false);
  });

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

describe("the AI desk's Draft notes", () => {
  test("a room is named by the user's label, or by its kind", () => {
    expect(deskRoomLabel({ name: "Atlas mock", kind: "mock", room_id: 4 })).toBe("Atlas mock");
    expect(deskRoomLabel({ name: "  ", kind: "mock", room_id: 4 })).toBe("Mock draft 4");
    expect(deskRoomLabel({ name: null, kind: "live", room_id: 9 })).toBe("Draft 9");
  });

  test("a note's line is its first paragraph, plain and cut", () => {
    expect(notePreview(null)).toBeNull();
    expect(notePreview("**Take Mock 001.** He fits the punt.\n\nRunner-up: Mock 004.")).toBe("Take Mock 001. He fits the punt.");
    expect(notePreview("- First bullet\n- Second")).toBe("First bullet");
    const long = notePreview("x".repeat(300), 20);
    expect(long).toHaveLength(20);
    expect(long?.endsWith("…")).toBe(true);
  });
});
