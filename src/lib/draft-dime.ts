/**
 * Dime in a draft room (the Dime autopilot plan, step 7; backend
 * services/ai/draft.py): what the room's Dime section reads off the notes and
 * the seat, and when the room asks for Dime's pick on its own.
 *
 * Dime's pick (James, 2026-11-26) is one player for the user's next pick, the
 * one on the clock included, with one line on why for this roster: the board
 * highlights him with that line under his row. The room asks for it once the
 * pick is `lead` picks away, and once more if another seat drafts him first.
 * Nothing here decides for the user: the user makes the pick.
 *
 * The room's chat (step 2) is one AI desk conversation per room. Ask Dime on a
 * board row, and Ask why on Dime's pick, put a question in its box and send
 * nothing: each message the user sends is a turn on the AI desk's budget.
 */
import { prose } from "@/lib/ai-prose";
import type { DimeDraftNote, DimeDraftRoom, DraftSession } from "@/types/draft";

/** What a recap note read of the user's seat. */
export interface DimeRecapFacts {
  grade: string | null;
  place: number | null;
  seats: number | null;
  valueOverSlot: number | null;
  byDime: number;
}

/** Dime's pick for one of the user's picks: the player the board highlights, and why. */
export interface DimePick {
  noteId: number;
  forPick: number;
  playerId: number;
  name: string;
  position: string | null;
  team: string | null;
  reason: string | null;
  conversationId: number | null;
}

/** How many times the server lets Dime pick again for one pick after its player went first (backend RETAKES). */
export const RETAKES = 1;

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const numOr = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function recapFacts(note: Pick<DimeDraftNote, "facts">): DimeRecapFacts {
  const f = note.facts ?? {};
  return {
    grade: str(f.grade),
    place: numOr(f.place),
    seats: numOr(f.seats),
    valueOverSlot: numOr(f.value_over_slot),
    byDime: numOr(f.by_dime) ?? 0,
  };
}

/** The player a finished pick note chose, read defensively (the server's dict is untyped on the wire). */
export function pickOf(note: Pick<DimeDraftNote, "id" | "kind" | "seat" | "state" | "for_pick" | "pick" | "conversation_id">): DimePick | null {
  if (note.kind !== "pick" || note.seat || note.state !== "done" || note.for_pick == null) return null;
  const p = note.pick ?? {};
  const playerId = numOr(p.player_id);
  if (playerId == null) return null;
  return {
    noteId: note.id,
    forPick: note.for_pick,
    playerId,
    name: str(p.name) ?? "—",
    position: str(p.position),
    team: str(p.team),
    reason: str(p.reason),
    conversationId: note.conversation_id,
  };
}

/** Dime's newest note about one of the user's picks (not one it made from the seat), failed or not. */
export function noteForPick(notes: readonly DimeDraftNote[], pick: number | null | undefined): DimeDraftNote | null {
  if (pick == null) return null;
  return notes.find((n) => n.kind === "pick" && !n.seat && n.for_pick === pick) ?? null;
}

/** The picks Dime made holding the seat, oldest first. */
export function seatPicks(notes: readonly DimeDraftNote[]): DimeDraftNote[] {
  return notes.filter((n) => n.kind === "pick" && n.seat && n.state === "done" && n.took).reverse();
}

export function latestRecap(notes: readonly DimeDraftNote[]): DimeDraftNote | null {
  return notes.find((n) => n.kind === "recap") ?? null;
}

/** Whether Dime is drafting the seat now (asked to stop counts until its pick is in). */
export function seatBusy(room: Pick<DimeDraftRoom, "seat"> | null | undefined): boolean {
  return !!room && room.seat.state !== "off" && room.seat.live;
}

type PickSession = Pick<DraftSession, "status" | "my_next_pick" | "picks_until_my_turn" | "picks">;

/** The players drafted in the room so far, keepers included. */
export function draftedIds(session: Pick<DraftSession, "picks">): Set<number> {
  return new Set(session.picks.map((p) => p.player_id).filter((id): id is number => id != null));
}

/**
 * Dime's pick for the user's next pick, while it still stands: chosen, and its
 * player not drafted since. Null while Dime holds the seat (it makes the pick
 * itself then) and once the draft is over.
 */
export function dimePickFor(room: DimeDraftRoom | null | undefined, session: PickSession | null | undefined, drafted?: ReadonlySet<number>): DimePick | null {
  if (!room || !session || !room.available || session.status !== "active" || seatBusy(room)) return null;
  const note = noteForPick(room.notes, session.my_next_pick);
  const pick = note ? pickOf(note) : null;
  if (!pick || (drafted ?? draftedIds(session)).has(pick.playerId)) return null;
  return pick;
}

/** How many times Dime picked again for `pick` because its player went first. */
export function retakesFor(notes: readonly DimeDraftNote[], pick: number): number {
  return notes.filter((n) => n.kind === "pick" && !n.seat && n.for_pick === pick && n.state === "failed" && n.reason === "taken").length;
}

/**
 * The pick the room should ask Dime about now, or null. It asks once the
 * user's pick is `lead` picks away or nearer (the pick on the clock included),
 * once per pick: a note already there (even a failed one; the user asks again
 * by hand) or one running anywhere in the room holds it, and so does Dime
 * drafting the seat. The one exception is the player Dime chose being drafted
 * by another seat first: then it asks once more (the server retires the old
 * pick and Dime picks again, `RETAKES` times at most). A pick note from before
 * Dime chose players (done, with no player) gives way too.
 */
export function pickToAsk(room: DimeDraftRoom | null | undefined, session: PickSession | null | undefined, drafted?: ReadonlySet<number>): number | null {
  if (!room || !session || !room.available) return null;
  if (session.status !== "active" || session.my_next_pick == null || session.picks_until_my_turn == null) return null;
  if (session.picks_until_my_turn > room.lead) return null;
  if (room.running != null || seatBusy(room)) return null;
  const held = noteForPick(room.notes, session.my_next_pick);
  if (!held) return session.my_next_pick;
  const pick = pickOf(held);
  // A note written before Dime chose players (finished, nobody in it): the server replaces it
  if (held.state === "done" && !pick) return session.my_next_pick;
  if (pick && (drafted ?? draftedIds(session)).has(pick.playerId) && retakesFor(room.notes, session.my_next_pick) < RETAKES) {
    return session.my_next_pick;
  }
  return null;
}

/**
 * What changes the room under the user when it moves: a note finishing (a seat
 * pick adds a pick) or the seat changing hands. The room reads its session and
 * board again when this does.
 */
export function roomSignature(room: DimeDraftRoom | null | undefined): string {
  if (!room) return "";
  const done = room.notes.filter((n) => n.state !== "running").length;
  return `${done}:${room.running ?? "-"}:${room.seat.state}:${room.seat.live}`;
}

/** Whether the view should be read again soon: a note is being written, or Dime holds the seat. */
export function shouldPoll(room: DimeDraftRoom | null | undefined): boolean {
  return !!room && room.available && (room.running != null || room.seat.state !== "off");
}

const SEAT_REASON: Record<string, string> = {
  done: "Dime drafted your seat to the end",
  stopped: "You took your seat back",
  pick_failed: "Dime couldn't make a pick, so the seat is yours again",
  cap_blocked: "Every player left would break a position cap, so the seat is yours again",
  pool_exhausted: "Nobody is left to draft",
  blocked: "The room can't be drafted from the seat any more",
  switched_off: "Dime in draft rooms was switched off, so the seat is yours again",
};

/** Why the seat last came back to the user, in a line; null when nothing worth saying. */
export function seatReason(seat: DimeDraftRoom["seat"]): string | null {
  if (seat.state !== "off" || !seat.reason) return null;
  return SEAT_REASON[seat.reason] ?? `The seat stopped (${seat.reason.toLowerCase().replace(/_/g, " ")})`;
}

/** What a note is, as its card's head says it. */
export function noteLabel(note: Pick<DimeDraftNote, "kind" | "for_pick" | "seat"> & Partial<Pick<DimeDraftNote, "pick">>): string {
  if (note.kind === "plan") return "Plan";
  if (note.kind === "recap") return "Recap";
  if (note.seat) return `Took pick ${note.for_pick}`;
  const name = str(note.pick?.name);
  return name ? `Pick ${note.for_pick} · ${name}` : `Pick ${note.for_pick}`;
}

const FAILED_REASON: Record<string, string> = {
  stale: "It stopped before it finished",
  no_pick: "Dime didn't make a pick",
  taken: "He was drafted before your pick, so Dime picked again",
  superseded: "Written before Dime chose players; replaced by its pick",
  AI_TIMEOUT: "Dime took too long",
};

/** Why a note failed, in a line. */
export function failedLine(note: Pick<DimeDraftNote, "state" | "reason">): string | null {
  if (note.state !== "failed") return null;
  if (note.reason && FAILED_REASON[note.reason]) return FAILED_REASON[note.reason];
  if (note.reason && /BUDGET|QUOTA/.test(note.reason)) return "The assistant's budget is used up";
  return "It couldn't be written";
}

/** A note's first paragraph (or first bullet) as plain text, cut to `max`: its line on a room's recap. */
export function notePreview(text: string | null | undefined, max = 240): string | null {
  if (!text) return null;
  const first = prose(text)[0];
  if (!first) return null;
  const line = (first.kind === "p" ? first.spans : (first.items[0] ?? [])).map((sp) => sp.text).join("").trim();
  if (!line) return null;
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

type ChatSession = Pick<DraftSession, "status" | "my_next_pick" | "scoring_format">;

/** The question Ask Dime puts in the room's chat box about one player on the board. */
export function askAbout(name: string, session: Pick<DraftSession, "status" | "my_next_pick">): string {
  if (session.status !== "completed" && session.my_next_pick != null) return `How does ${name} fit my team at pick #${session.my_next_pick}?`;
  return `How does ${name} fit my team?`;
}

/** The question Ask why puts in the box about Dime's own pick. */
export function askWhy(pick: Pick<DimePick, "name" | "forPick">): string {
  return `Why ${pick.name} for pick #${pick.forPick}?`;
}

/** What an empty chat offers to start with: each fills the box (nothing is sent until the user sends it). */
export function chatStarters(session: ChatSession): string[] {
  if (session.status === "completed") return ["How did my draft go?", "Which of my picks should I worry about?"];
  const next = session.my_next_pick;
  return [
    "Plan the rest of my draft",
    next != null ? `Who is likely still there at #${next}?` : "Who are the best players left?",
    session.scoring_format === "categories" ? "Should I punt a category yet?" : "Which positions should I fill next?",
  ];
}
