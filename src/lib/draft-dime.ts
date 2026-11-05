/**
 * Dime in a draft room (the Dime autopilot plan, step 7; backend
 * services/ai/draft.py): what the room's Dime section reads off the notes and
 * the seat, and when the room asks for a note at the user's pick on its own.
 *
 * Every note is a turn the user started from the room (the plan button, the
 * notes switch, the seat), so nothing here decides for the user: it only says
 * which note is about which pick, and when the switch should ask.
 */
import type { DimeDraftNote, DimeDraftRoom, DraftSession } from "@/types/draft";

/** One of the three recommendations a pick note was written beside. */
export interface DimePickTop {
  player_id: number | null;
  name: string;
  position: string | null;
  score: number | null;
  availability: string | null;
  adp: number | null;
  reason: string | null;
}

/** The board's numbers the server read for a pick note. */
export interface DimePickFacts {
  pick: number | null;
  picksUntil: number | null;
  onClock: boolean;
  /** The pick `gone` is about: the coming pick, or while on the clock the one after it. */
  goneBefore: number | null;
  top: DimePickTop[];
  gone: Array<{ name: string; adp: number | null }>;
  punts: string[];
  needs: Array<{ label: string; need: number | null }>;
}

/** What a recap note read of the user's seat. */
export interface DimeRecapFacts {
  grade: string | null;
  place: number | null;
  seats: number | null;
  valueOverSlot: number | null;
  byDime: number;
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const numOr = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const list = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => x != null && typeof x === "object") : [];

/** A pick note's facts, read defensively: the server's dict is untyped on the wire. */
export function pickFacts(note: Pick<DimeDraftNote, "facts">): DimePickFacts {
  const f = note.facts ?? {};
  return {
    pick: numOr(f.pick),
    picksUntil: numOr(f.picks_until),
    onClock: f.on_clock === true,
    goneBefore: numOr(f.gone_before),
    top: list(f.top).map((r) => ({
      player_id: numOr(r.player_id),
      name: str(r.name) ?? "—",
      position: str(r.position),
      score: numOr(r.score),
      availability: str(r.availability),
      adp: numOr(r.adp),
      reason: str(r.reason),
    })),
    gone: list(f.gone).map((r) => ({ name: str(r.name) ?? "—", adp: numOr(r.adp) })),
    punts: Array.isArray(f.punts) ? f.punts.filter((p): p is string => typeof p === "string") : [],
    needs: list(f.needs).map((n) => ({ label: str(n.label) ?? str(n.category) ?? "—", need: numOr(n.need) })),
  };
}

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

/** The plan the room is drafted to: the newest plan note that set one. */
export function latestPlan(notes: readonly DimeDraftNote[]): DimeDraftNote | null {
  return notes.find((n) => n.kind === "plan" && n.state === "done" && n.plan) ?? null;
}

/** The advice note about one of the user's picks (not one Dime made from the seat), failed or not. */
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

/**
 * The pick the notes switch should ask about now, or null. It asks once the
 * user's pick is `lead` picks away or nearer, once per pick: a note already
 * there (even a failed one; the user asks again by hand) or one running
 * anywhere in the room holds it, and so does Dime drafting the seat.
 */
export function pickToAsk(
  room: DimeDraftRoom | null | undefined,
  session: Pick<DraftSession, "status" | "my_next_pick" | "picks_until_my_turn"> | null | undefined
): number | null {
  if (!room || !session || !room.available || !room.notes_on) return null;
  if (session.status !== "active" || session.my_next_pick == null || session.picks_until_my_turn == null) return null;
  if (session.picks_until_my_turn > room.lead) return null;
  if (room.running != null || seatBusy(room)) return null;
  if (noteForPick(room.notes, session.my_next_pick)) return null;
  return session.my_next_pick;
}

/**
 * What changes the room under the user when it moves: a note finishing (a plan
 * sets punts, a seat pick adds a pick) or the seat changing hands. The room
 * reads its session and board again when this does.
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
};

/** Why the seat last came back to the user, in a line; null when nothing worth saying. */
export function seatReason(seat: DimeDraftRoom["seat"]): string | null {
  if (seat.state !== "off" || !seat.reason) return null;
  return SEAT_REASON[seat.reason] ?? `The seat stopped (${seat.reason.toLowerCase().replace(/_/g, " ")})`;
}

/** What a note is, as its card's head says it. */
export function noteLabel(note: Pick<DimeDraftNote, "kind" | "for_pick" | "seat">): string {
  if (note.kind === "plan") return "Plan";
  if (note.kind === "recap") return "Recap";
  return note.seat ? `Took pick ${note.for_pick}` : `Pick ${note.for_pick}`;
}

const FAILED_REASON: Record<string, string> = {
  stale: "It stopped before it finished",
  no_pick: "Dime didn't make a pick",
  AI_TIMEOUT: "Dime took too long",
};

/** Why a note failed, in a line. */
export function failedLine(note: Pick<DimeDraftNote, "state" | "reason">): string | null {
  if (note.state !== "failed") return null;
  if (note.reason && FAILED_REASON[note.reason]) return FAILED_REASON[note.reason];
  if (note.reason && /BUDGET|QUOTA/.test(note.reason)) return "The assistant's budget is used up";
  return "It couldn't be written";
}

/** "punt FT%, TO" / "no punts" for a plan's punts, with the room's labels where they're known. */
export function puntLine(punts: readonly string[] | null | undefined, labels: Record<string, string> = {}): string {
  if (!punts || punts.length === 0) return "no punts";
  return `punt ${punts.map((p) => labels[p] ?? p.toUpperCase()).join(", ")}`;
}
