/**
 * Dropping a player on his own, made now: the boards as they stand once he is
 * gone, the staged moves that leave with him, and why he can't be dropped.
 *
 * A drop is staged in the tray's today column beside the lineup moves and the
 * add / drop. The lineup moves are staged on the boards as they will stand
 * after the drops, so the spot a dropped player leaves can be filled; each
 * request to ESPN is still pinned to the board ESPN holds. The server stays
 * authoritative (`backend/services/roster_transaction_service.py`); these
 * gates mirror its refusals so the desk can say why before it asks.
 */
import { unstage, type Staged } from "./lineup-editor";
import { writeBlockedCopy, type LineupState } from "@/types/lineup-editor";

/** A staged drop: the player (ESPN id) and the first day (index) he is gone. */
export interface DropLeave {
  id: number;
  from: number;
}

/**
 * Each day's board with the players dropped by then left out. The same array
 * when nothing is dropped, and the same board for a day nobody leaves, so a
 * grid built on them rebuilds only where a drop changes something.
 */
export function withoutDropped(
  boards: ReadonlyArray<LineupState | undefined>,
  leaves: ReadonlyArray<DropLeave>
): ReadonlyArray<LineupState | undefined> {
  if (leaves.length === 0) return boards;
  return boards.map((b, day) => {
    if (!b) return b;
    const gone = new Set(leaves.filter((x) => day >= x.from).map((x) => x.id));
    if (!b.players.some((p) => gone.has(p.player_id))) return b;
    return { ...b, players: b.players.filter((p) => !gone.has(p.player_id)) };
  });
}

/**
 * Take a player's staged moves back on every day, each with the swap it made
 * (`unstage`): dropped, he can't move, and whoever swapped with him would stay
 * moved for nothing. `boards` are the ones the staging was made on. The same
 * object when he had nothing staged.
 */
export function unstageEverywhere(
  boards: ReadonlyArray<LineupState | undefined>,
  stagedByDay: Readonly<Record<number, Staged>>,
  playerId: number
): Record<number, Staged> {
  let out: Record<number, Staged> | null = null;
  for (const [key, staged] of Object.entries(stagedByDay)) {
    const day = Number(key);
    const b = boards[day];
    if (!b) continue;
    const next = unstage(b, staged, playerId);
    if (next === staged) continue;
    out ??= { ...stagedByDay };
    out[day] = next;
  }
  return out ?? stagedByDay;
}

export interface DropBlockedInput {
  player: { id: number; name: string };
  /** Today's board as ESPN holds it (no staged drops applied); null when there is none. */
  board: LineupState | null | undefined;
  /** The players the team's active stream lanes hold their spots with. */
  laneHolders: ReadonlySet<number>;
  /** A pending scheduled pickup that already drops him: its add's name and its day's. */
  scheduled: { add: string; day: string } | null;
  /** The add / drop staged in the tray already drops him. */
  pinnedDrops: boolean;
  /** The demo writes to nothing, so ESPN's write gate doesn't apply. */
  demo: boolean;
}

/**
 * Why this player can't be dropped now, as a sentence for the menu (and the
 * tray, once staged) — or null when he can. The server refuses the same cases:
 * a locked player (`drop_locked`), a lane holder (`drop_is_lane_holder`) and a
 * player a scheduled pickup drops (`drop_is_scheduled`).
 */
export function dropBlockedReason({ player, board, laneHolders, scheduled, pinnedDrops, demo }: DropBlockedInput): string | null {
  if (!board) return "Dropping from here needs an ESPN team.";
  if (!demo && !board.can_write) return writeBlockedCopy(board.write_blocked_reason);
  const onBoard = board.players.find((p) => p.player_id === player.id);
  if (!onBoard) return `${player.name} isn't on today's ESPN roster.`;
  if (onBoard.locked) {
    return onBoard.game_started
      ? `${player.name} is locked until tomorrow: his game has started.`
      : `${player.name} is locked on ESPN today.`;
  }
  if (laneHolders.has(player.id)) return "A stream lane is streaming his spot: stop it to drop him.";
  if (scheduled) {
    return `${player.name} is already being dropped for ${scheduled.add} on ${scheduled.day}: cancel that pickup to drop him now.`;
  }
  if (pinnedDrops) return "The add staged in the tray already drops him.";
  return null;
}
