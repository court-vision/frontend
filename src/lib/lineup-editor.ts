/**
 * Pure logic for the manual lineup editor: which slots a player may move to,
 * how a tap turns into a staged move or swap, and the exact moves and
 * validation the server (`backend/services/lineup_planner.validate_moves`)
 * will run. The server stays authoritative; this gives instant feedback.
 *
 * `Staged` holds only the players whose slot differs from the board the
 * server sent, keyed by ESPN player id. Everything else is derived from
 * `LineupState` + `Staged` so a fresh board (new `roster_version`) can drop
 * the staging wholesale.
 */
import { ROSTER_STALE, toApiError } from "./api-error";
import type {
  LineupMove,
  LineupPlanData,
  LineupPlayer,
  LineupState,
  MoveError,
} from "@/types/lineup-editor";

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

export const SLOT_NAMES: Readonly<Record<number, string>> = {
  0: "PG",
  1: "SG",
  2: "SF",
  3: "PF",
  4: "C",
  5: "G",
  6: "F",
  7: "SG/SF",
  8: "G/F",
  9: "PF/C",
  10: "F/C",
  11: "UT",
  12: "BE",
  13: "IR",
};

export const BENCH_SLOT_ID = 12;
export const IR_SLOT_ID = 13;

/** Render order; also every slot the editor may touch (ESPN's 14/15 never are). */
export const SLOT_ORDER: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
export const EDITABLE_SLOT_IDS: readonly number[] = SLOT_ORDER;
export const UNTOUCHABLE_SLOT_IDS: readonly number[] = [14, 15];

export function slotName(id: number): string {
  return SLOT_NAMES[id] ?? `Slot ${id}`;
}

export function isActiveSlot(id: number): boolean {
  return id >= 0 && id <= 11;
}

export function isEditableSlot(id: number): boolean {
  return id >= 0 && id <= 13;
}

// ---------------------------------------------------------------------------
// Staging model
// ---------------------------------------------------------------------------

/** player_id → slot_id, only for players whose slot differs from the server board. */
export type Staged = Record<number, number>;

export function reset(): Staged {
  return {};
}

export function playerIndex(state: LineupState): Map<number, LineupPlayer> {
  return new Map(state.players.map((p) => [p.player_id, p]));
}

/** Where every player sits once the staged moves are applied. */
export function assignment(state: LineupState, staged: Staged): Map<number, number> {
  const out = new Map<number, number>();
  for (const p of state.players) {
    out.set(p.player_id, staged[p.player_id] ?? p.lineup_slot_id);
  }
  return out;
}

/** How many of a slot the league has (`slot_counts` is id-keyed with string keys). */
export function slotCapacity(state: LineupState, slotId: number): number {
  const fromCounts = state.slot_counts[String(slotId)];
  if (typeof fromCounts === "number") return Math.max(0, fromCounts);
  return Math.max(0, state.slots.find((s) => s.slot_id === slotId)?.count ?? 0);
}

/** Players sitting in `slotId` after staging, in board order. */
export function occupants(state: LineupState, staged: Staged, slotId: number): LineupPlayer[] {
  const assign = assignment(state, staged);
  return state.players.filter((p) => assign.get(p.player_id) === slotId);
}

/** ESPN's `injured` flag, or an OUT-type status: what ESPN's own IR rule checks. */
export function isInjured(player: LineupPlayer): boolean {
  const status = (player.injury_status ?? "").toUpperCase();
  return player.injured || ["OUT", "O", "IL", "IL+", "SUSPENSION", "INJURY_RESERVE"].includes(status);
}

/**
 * ESPN lets anyone sit on the bench; every other slot needs to be in the
 * player's list — except IR, which ESPN lists for *everyone* and refuses at
 * transaction time unless the player is injured (TRAN_ROSTER_INELIGIBLE_IR_NOT_INJURED,
 * captured 2026-09-08), so that rule is applied here too.
 */
function canOccupy(player: LineupPlayer, slotId: number): boolean {
  if (slotId === BENCH_SLOT_ID) return true;
  if (!player.eligible_slot_ids.includes(slotId)) return false;
  return slotId !== IR_SLOT_ID || isInjured(player);
}

/** Drop entries that no longer differ from the board (or name a player who left it). */
export function normalize(state: LineupState, staged: Staged): Staged {
  const byId = playerIndex(state);
  const out: Staged = {};
  for (const [key, slot] of Object.entries(staged)) {
    const id = Number(key);
    const p = byId.get(id);
    if (p && p.lineup_slot_id !== slot) out[id] = slot;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export interface SlotRow {
  slot_id: number;
  slot: string;
  /** Instance of the slot (0-based) — `UT` has three, so keys are `${slot_id}-${ordinal}`. */
  ordinal: number;
  player: LineupPlayer | null;
}

/**
 * One row per slot instance, in the server's slot order. A player keeps the
 * ordinal he occupied on the server board; a player staged into the slot
 * takes the first vacated ordinal (so a swap lands exactly where the row you
 * tapped was); empty ordinals sink to the bottom of their slot group.
 */
export function slotRows(state: LineupState, staged: Staged): SlotRow[] {
  const assign = assignment(state, staged);
  const placed = new Set<number>();
  const rows: SlotRow[] = [];

  for (const def of state.slots) {
    const count = Math.max(0, def.count);
    const cells: Array<LineupPlayer | null> = Array.from({ length: count }, () => null);
    const serverOccupants = state.players.filter((p) => p.lineup_slot_id === def.slot_id);
    serverOccupants.forEach((p, i) => {
      if (assign.get(p.player_id) === def.slot_id && i < count) {
        cells[i] = p;
        placed.add(p.player_id);
      }
    });
    for (const p of state.players) {
      if (placed.has(p.player_id) || assign.get(p.player_id) !== def.slot_id) continue;
      const empty = cells.indexOf(null);
      if (empty >= 0) cells[empty] = p;
      else cells.push(p); // over capacity — validation reports it, the row still shows
      placed.add(p.player_id);
    }
    const indexed = cells.map((player, ordinal) => ({ player, ordinal }));
    for (const cell of [...indexed.filter((c) => c.player), ...indexed.filter((c) => !c.player)]) {
      rows.push({ slot_id: def.slot_id, slot: def.slot, ordinal: cell.ordinal, player: cell.player });
    }
  }

  // A player whose slot has no definition (ESPN's 14/15, or a board mismatch) still renders.
  let stray = 0;
  for (const p of state.players) {
    if (placed.has(p.player_id)) continue;
    const slot = assign.get(p.player_id) ?? p.lineup_slot_id;
    rows.push({ slot_id: slot, slot: slotName(slot), ordinal: stray++, player: p });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Targets, staging
// ---------------------------------------------------------------------------

/**
 * Slots `playerId` may move to right now. A slot with spare capacity is always
 * a target; a full one only when an occupant can swap back into the mover's
 * current slot (unlocked and eligible for it). The bench takes anyone, IR only
 * the IR-eligible, and a locked player goes nowhere.
 */
export function eligibleTargets(state: LineupState, staged: Staged, playerId: number): number[] {
  const mover = playerIndex(state).get(playerId);
  if (!mover || mover.locked) return [];
  const assign = assignment(state, staged);
  const current = assign.get(playerId) ?? mover.lineup_slot_id;
  if (!isEditableSlot(current)) return [];

  const candidates = new Set(mover.eligible_slot_ids.filter(isEditableSlot));
  candidates.add(BENCH_SLOT_ID);

  const out: number[] = [];
  for (const slot of SLOT_ORDER) {
    if (slot === current || !candidates.has(slot)) continue;
    const capacity = slotCapacity(state, slot);
    if (capacity <= 0) continue;
    const holders = state.players.filter((p) => assign.get(p.player_id) === slot);
    if (holders.length < capacity) {
      out.push(slot);
    } else if (holders.some((h) => h.player_id !== playerId && !h.locked && canOccupy(h, current))) {
      out.push(slot);
    }
  }
  return out;
}

/**
 * Who would swap out if `playerId` moved into a full `targetSlotId`: the first
 * occupant who is unlocked and eligible for the mover's current slot. Null
 * when the slot has spare capacity (no swap needed) or nobody can leave.
 */
export function swapPartner(
  state: LineupState,
  staged: Staged,
  playerId: number,
  targetSlotId: number
): LineupPlayer | null {
  const mover = playerIndex(state).get(playerId);
  if (!mover) return null;
  const assign = assignment(state, staged);
  const current = assign.get(playerId) ?? mover.lineup_slot_id;
  const holders = state.players.filter((p) => assign.get(p.player_id) === targetSlotId);
  if (holders.length < slotCapacity(state, targetSlotId)) return null;
  return holders.find((h) => h.player_id !== playerId && !h.locked && canOccupy(h, current)) ?? null;
}

/**
 * Move `playerId` into `targetSlotId`: into spare capacity when there is some,
 * otherwise swapping with the first occupant who is unlocked and eligible for
 * the mover's current slot. Returns the same object when nothing can change.
 */
export function stage(
  state: LineupState,
  staged: Staged,
  playerId: number,
  targetSlotId: number
): Staged {
  const mover = playerIndex(state).get(playerId);
  if (!mover) return staged;
  const assign = assignment(state, staged);
  const current = assign.get(playerId) ?? mover.lineup_slot_id;
  if (targetSlotId === current || !isEditableSlot(targetSlotId) || !isEditableSlot(current)) {
    return staged;
  }
  const capacity = slotCapacity(state, targetSlotId);
  if (capacity <= 0) return staged;

  const holders = state.players.filter((p) => assign.get(p.player_id) === targetSlotId);
  const next: Staged = { ...staged, [playerId]: targetSlotId };
  if (holders.length >= capacity) {
    const partner = swapPartner(state, staged, playerId, targetSlotId);
    if (!partner) return staged;
    next[partner.player_id] = current;
  }
  return normalize(state, next);
}

/**
 * Undo `playerId`'s staged move. When it was one half of a swap (the other
 * player is staged into the mover's server slot, coming from the mover's
 * target) both halves are undone, so a slot is never left over capacity by
 * an undo.
 */
export function unstage(state: LineupState, staged: Staged, playerId: number): Staged {
  if (!(playerId in staged)) return staged;
  const mover = playerIndex(state).get(playerId);
  const target = staged[playerId];
  const next: Staged = { ...staged };
  delete next[playerId];
  if (mover) {
    const partner = state.players.find(
      (p) =>
        p.player_id !== playerId &&
        next[p.player_id] === mover.lineup_slot_id &&
        p.lineup_slot_id === target
    );
    if (partner) delete next[partner.player_id];
  }
  return next;
}

// ---------------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------------

export type MoveRole = "start" | "bench" | "shift";

/** start: bench → active; bench: anything → bench; shift: the rest (active ↔ active, IR moves). */
export function moveRole(move: Pick<LineupMove, "from_slot_id" | "to_slot_id">): MoveRole {
  if (move.from_slot_id === BENCH_SLOT_ID && isActiveSlot(move.to_slot_id)) return "start";
  if (move.to_slot_id === BENCH_SLOT_ID) return "bench";
  return "shift";
}

const ROLE_ORDER: Record<MoveRole, number> = { start: 0, shift: 1, bench: 2 };

/**
 * The moves to send: `from_slot_id` is the server slot, `to_slot_id` the
 * staged one. Starts come before shifts before benchings, and the two halves
 * of a swap are kept adjacent (the start first).
 */
export function diff(state: LineupState, staged: Staged): LineupMove[] {
  const moves: LineupMove[] = [];
  for (const p of state.players) {
    const to = staged[p.player_id];
    if (to !== undefined && to !== p.lineup_slot_id) {
      moves.push({ player_id: p.player_id, from_slot_id: p.lineup_slot_id, to_slot_id: to });
    }
  }
  const sorted = [...moves].sort((a, b) => ROLE_ORDER[moveRole(a)] - ROLE_ORDER[moveRole(b)]);

  const out: LineupMove[] = [];
  const emitted = new Set<number>();
  for (const m of sorted) {
    if (emitted.has(m.player_id)) continue;
    out.push(m);
    emitted.add(m.player_id);
    const partner = sorted.find(
      (o) =>
        !emitted.has(o.player_id) &&
        o.from_slot_id === m.to_slot_id &&
        o.to_slot_id === m.from_slot_id
    );
    if (partner) {
      out.push(partner);
      emitted.add(partner.player_id);
    }
  }
  return out;
}

/**
 * Why a move is refused before it reaches ESPN (mirrors the server's wording).
 * Eligibility is ESPN's own `eligibleSlots`; IR is on it only for players ESPN
 * has marked OUT, so an IR refusal names that rule instead of the slot.
 */
export function ineligibleMessage(p: LineupPlayer, toSlotId: number): string {
  if (toSlotId === IR_SLOT_ID) {
    return `${p.name} can't go on IR — ESPN only allows players it lists as injured (OUT) there`;
  }
  const eligible = p.eligible_slot_ids.filter((s) => isActiveSlot(s)).map(slotName);
  const where = eligible.length ? ` (eligible: ${eligible.join(", ")})` : "";
  return `${p.name} isn't eligible at ${slotName(toSlotId)}${where}`;
}

/**
 * The checks `validate_moves` runs server-side, for instant feedback: per-move
 * UNTOUCHABLE_SLOT / LOCKED / INELIGIBLE first, then CAPACITY per target slot
 * once every move is individually sound.
 */
export function validateStaged(state: LineupState, staged: Staged): MoveError[] {
  const byId = playerIndex(state);
  const moves = diff(state, staged);
  const errors: MoveError[] = [];

  for (const m of moves) {
    const p = byId.get(m.player_id);
    if (!p) {
      errors.push({ player_id: m.player_id, code: "UNKNOWN_PLAYER", message: "Player is not on this roster" });
      continue;
    }
    if (UNTOUCHABLE_SLOT_IDS.includes(m.from_slot_id) || UNTOUCHABLE_SLOT_IDS.includes(m.to_slot_id)) {
      errors.push({ player_id: m.player_id, code: "UNTOUCHABLE_SLOT", message: "That slot cannot be edited" });
      continue;
    }
    if (p.locked) {
      errors.push({
        player_id: m.player_id,
        code: "LOCKED",
        message: `${p.name} is locked${p.game_started ? " (game started)" : ""}`,
      });
      continue;
    }
    if (!canOccupy(p, m.to_slot_id)) {
      errors.push({ player_id: m.player_id, code: "INELIGIBLE", message: ineligibleMessage(p, m.to_slot_id) });
    }
  }
  if (errors.length) return errors;

  const assign = assignment(state, staged);
  const targets = [...new Set(moves.map((m) => m.to_slot_id))].sort((a, b) => a - b);
  for (const slot of targets) {
    const limit = slotCapacity(state, slot);
    const held = state.players.filter((p) => assign.get(p.player_id) === slot).length;
    if (held > limit) {
      errors.push({
        player_id: null,
        code: "CAPACITY",
        message: `${slotName(slot)} would hold ${held} players (limit ${limit})`,
      });
    }
  }
  return errors;
}

/** The server's plan as staging: every planned move lands on its `to_slot_id`. */
export function planToStaged(state: LineupState, plan: LineupPlanData): Staged {
  const byId = playerIndex(state);
  const out: Staged = {};
  for (const m of plan.moves) {
    const p = byId.get(m.player_id);
    if (p && m.to_slot_id !== p.lineup_slot_id) out[m.player_id] = m.to_slot_id;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Stale boards
// ---------------------------------------------------------------------------

/** The fresh board a ROSTER_STALE (409) error hands back, if any. */
export function staleLineup(error: unknown): LineupState | null {
  const data = toApiError(error).data;
  if (typeof data !== "object" || data === null) return null;
  const lineup = (data as { lineup?: unknown }).lineup;
  if (typeof lineup !== "object" || lineup === null) return null;
  return typeof (lineup as LineupState).roster_version === "string" ? (lineup as LineupState) : null;
}

/** True when the write was refused because the board moved on ESPN. */
export function isStale(state: LineupState | null | undefined, error: unknown): boolean {
  if (toApiError(error).code === ROSTER_STALE) return true;
  const fresh = staleLineup(error);
  return !!fresh && !!state && fresh.roster_version !== state.roster_version;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

/** "19:30" → "7:30 PM". Anything unparseable is returned as-is. */
export function formatTipTime(hhmm: string | null | undefined): string {
  if (!hhmm) return "";
  const match = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!match) return hhmm;
  const h = Number(match[1]);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${match[2]} ${suffix}`;
}

/** "2026-10-20" → "Tue, Oct 20" (calendar date, no timezone shift). */
export function formatNbaDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** "vs LAL · 7:30 PM", or "No game". `compact` gives the phone form "vs LAL 7:30P". */
export function gameLabel(
  player: Pick<LineupPlayer, "has_game_today" | "opponent" | "game_time_et">,
  opts: { compact?: boolean } = {}
): string {
  if (!player.has_game_today) return "No game";
  const time = formatTipTime(player.game_time_et);
  const shortTime = opts.compact ? time.replace(" PM", "P").replace(" AM", "A") : time;
  const parts = [player.opponent, shortTime].filter(Boolean);
  return parts.length ? parts.join(opts.compact ? " " : " · ") : "Game today";
}

/** Tooltip for the lock icon; null when the player is free to move. */
export function lockLabel(
  player: Pick<LineupPlayer, "locked" | "lineup_locked" | "game_started" | "game_time_et">
): string | null {
  if (!player.locked) return null;
  if (player.game_started) {
    const time = formatTipTime(player.game_time_et);
    return time ? `Locked — game started ${time}` : "Locked — game started";
  }
  return player.lineup_locked ? "Locked by ESPN" : "Locked";
}

/** "Jalen Green: BE → UT". */
export function moveLabel(state: LineupState, move: LineupMove): string {
  const name = playerIndex(state).get(move.player_id)?.name ?? `Player ${move.player_id}`;
  return `${name}: ${slotName(move.from_slot_id)} → ${slotName(move.to_slot_id)}`;
}
