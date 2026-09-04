/**
 * The ESPN draft-room wire protocol, as a set of pure functions.
 *
 * The Draft Tap extension forwards raw frame strings off the room's
 * WebSocket; it parses nothing. All of the understanding lives
 * here, so a protocol change is a web deploy rather than a store-review round
 * trip. Everything in this file is pure and total — `parseFrame` never throws;
 * an unrecognised or malformed frame becomes a value, not an exception.
 *
 * Frame vocabulary:
 *   SELECTED <teamId> <playerId> <slotId> [<selectorSWID>]   a pick; SWID present ⇒ human, absent ⇒ autopick
 *   SOLD     <teamId> <playerId> <slotId> <bid> <0>          an auction pick (the fifth arg is unused)
 *   UNDONE   <pickNumber>                                     commissioner undo of that overall pick
 *   INIT     <base64>                                         full state snapshot, on every connect
 *   RESET                                                     draft reset
 *   SELECTING <teamId> <msRemaining>                          who is on the clock
 *   AUTODRAFT <teamId> <bool>                                 a team's autodraft flag (arrives before INIT)
 *   CLOCK    <phase> [time [teamId [playerId [amount]]]]      variable arity 1–5
 * Everything else (AUTOSUGGEST, PROJECTED_STANDINGS, TOKEN, JOINED, STATE, PONG…) is ignored.
 */
import { z } from "zod";

// ------------------------------- records ------------------------------- //

/**
 * One record the extension forwards. `looseObject` because the extension may
 * add fields in a newer version than the page; we read the ones we know and
 * ignore the rest rather than rejecting the whole message.
 */
export const TapRecordSchema = z.looseObject({
  ts: z.number(),
  kind: z.enum(["open", "frame", "close", "error"]),
  dir: z.enum(["in", "out"]).optional(),
  transport: z.enum(["ws", "sse"]).optional(),
  frame: z.string().optional(),
  url: z.string().optional(),
  code: z.number().optional(),
  reason: z.string().optional(),
  clean: z.boolean().optional(),
  page: z.string().optional(),
  tab: z.number().optional(),
});
export type TapRecord = z.infer<typeof TapRecordSchema>;

export const ExtensionMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello"), version: z.string() }),
  z.object({ type: z.literal("replay"), records: z.array(TapRecordSchema) }),
  z.object({ type: z.literal("record"), record: TapRecordSchema }),
]);
export type ExtensionMessage = z.infer<typeof ExtensionMessageSchema>;

/** Validate an untrusted message from the extension; null when it does not fit. */
export function parseExtensionMessage(raw: unknown): ExtensionMessage | null {
  const result = ExtensionMessageSchema.safeParse(raw);
  return result.success ? result.data : null;
}

// -------------------------------- frames ------------------------------- //

export type DraftFrame =
  | { op: "SELECTED"; teamId: number; playerId: number; slotId: number; selector: string | null }
  | { op: "SOLD"; teamId: number; playerId: number; slotId: number; bid: number }
  | { op: "UNDONE"; pickNumber: number }
  | { op: "INIT"; payload: string }
  | { op: "RESET" }
  | { op: "SELECTING"; teamId: number; msRemaining: number }
  | { op: "AUTODRAFT"; teamId: number; enabled: boolean }
  | { op: "CLOCK"; phase: number; time: number | null; teamId: number | null; playerId: number | null; amount: number | null }
  | { op: "ignored"; opcode: string }
  | { op: "malformed"; opcode: string; raw: string };

/** A signed 32-bit integer, or null when the token is missing or not an integer. */
function int(token: string | undefined): number | null {
  if (token === undefined) return null;
  const n = Number(token);
  return Number.isInteger(n) ? n : null;
}

/**
 * Parse one whitespace-delimited frame. Never throws: a frame whose required
 * numeric args are missing or non-integer is `malformed`; an opcode we do not
 * act on is `ignored`. Extra trailing args are ignored (SOLD carries a fifth,
 * SELECTED an optional fourth).
 */
export function parseFrame(frame: string): DraftFrame {
  const parts = frame.trim().split(/\s+/);
  const opcode = parts[0] ?? "";
  const bad = (): DraftFrame => ({ op: "malformed", opcode, raw: frame });

  switch (opcode) {
    case "SELECTED": {
      const teamId = int(parts[1]);
      const playerId = int(parts[2]);
      const slotId = int(parts[3]);
      if (teamId === null || playerId === null || slotId === null) return bad();
      // The 4th field is the picker's member id (SWID). Present ⇒ a human made
      // the pick; absent ⇒ an autopick. We keep the raw token, not an int.
      const selector = parts[4] ?? null;
      return { op: "SELECTED", teamId, playerId, slotId, selector };
    }
    case "SOLD": {
      const teamId = int(parts[1]);
      const playerId = int(parts[2]);
      const slotId = int(parts[3]);
      const bid = int(parts[4]);
      if (teamId === null || playerId === null || slotId === null || bid === null) return bad();
      return { op: "SOLD", teamId, playerId, slotId, bid };
    }
    case "UNDONE": {
      const pickNumber = int(parts[1]);
      if (pickNumber === null) return bad();
      return { op: "UNDONE", pickNumber };
    }
    case "INIT": {
      const payload = parts[1];
      if (!payload) return bad();
      return { op: "INIT", payload };
    }
    case "RESET":
      return { op: "RESET" };
    case "SELECTING": {
      const teamId = int(parts[1]);
      const msRemaining = int(parts[2]);
      if (teamId === null || msRemaining === null) return bad();
      return { op: "SELECTING", teamId, msRemaining };
    }
    case "AUTODRAFT": {
      const teamId = int(parts[1]);
      if (teamId === null || (parts[2] !== "true" && parts[2] !== "false")) return bad();
      return { op: "AUTODRAFT", teamId, enabled: parts[2] === "true" };
    }
    case "CLOCK": {
      const phase = int(parts[1]);
      if (phase === null) return bad();
      return {
        op: "CLOCK",
        phase,
        time: int(parts[2]),
        teamId: int(parts[3]),
        playerId: int(parts[4]),
        amount: int(parts[5]),
      };
    }
    default:
      return { op: "ignored", opcode: opcode || "(empty)" };
  }
}

// ------------------------------ url + init ----------------------------- //

/** The ESPN league id from a JOIN/sse url, e.g. …/league-35392660/JOIN → 35392660. */
export function espnLeagueIdFromUrl(url?: string): number | null {
  if (!url) return null;
  const m = url.match(/league-(\d+)(?:\/|$)/);
  return m ? Number(m[1]) : null;
}

/**
 * Peek at an INIT payload's header without a full decode: the first four
 * big-endian int32s are (presence=1, version=1, leagueId, teamId), where
 * teamId is the CONNECTING user's ESPN team id. Lets the room know which picks
 * are `by_me` the instant INIT arrives, before the backend reconciles.
 * Returns null if the payload is too short or not the expected shape.
 */
export function peekInitHeader(payload: string): { leagueId: number; teamId: number } | null {
  let bytes: Uint8Array;
  try {
    const bin = atob(payload.slice(0, 24)); // 24 b64 chars → 18 bytes, ≥ the 16 we read
    bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  if (bytes.length < 16) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const presence = view.getInt32(0, false);
  const version = view.getInt32(4, false);
  if (presence !== 1 || version !== 1) return null;
  return { leagueId: view.getInt32(8, false), teamId: view.getInt32(12, false) };
}
