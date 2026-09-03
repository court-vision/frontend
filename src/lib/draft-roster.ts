/**
 * Pure roster-zone logic: how the caller's drafted players fill the league's
 * lineup slots, how they count against hard position caps, where they stack
 * on one NBA schedule, and which keepers are still to be recorded. Kept out of
 * the component so the slot-filling rule — the one a roster zone is quietly
 * wrong about — is testable without a DOM.
 */
import type { DraftKeeperOut, DraftPick, DraftRosterEntry } from "@/types/draft";

/** ESPN lineup slots in display order. IR is filled from the roster, never from the draft. */
export const SLOT_ORDER = [
  "PG", "SG", "SF", "PF", "C", "G", "F", "SG/SF", "G/F", "PF/C", "F/C", "UT", "BE",
] as const;

/** Where a primary position can start when ESPN's own eligibility list is missing. */
const PRIMARY_SLOTS: Record<string, string[]> = {
  PG: ["PG", "G", "G/F", "UT"],
  SG: ["SG", "G", "SG/SF", "G/F", "UT"],
  SF: ["SF", "F", "SG/SF", "G/F", "F/C", "UT"],
  PF: ["PF", "F", "PF/C", "F/C", "UT"],
  C: ["C", "PF/C", "F/C", "UT"],
};

const CAP_ORDER = ["PG", "SG", "SF", "PF", "C"];

export interface RosterPlayer {
  player_id: number;
  name: string;
  primary_position: string | null;
  positions: string[] | null;
  team: string | null;
  /** The pick that took him, when the session knows it. */
  overall_pick: number | null;
  keeper: boolean;
}

/**
 * Slots a player can start in: ESPN's eligibility list when the market
 * snapshot carries it, else what his primary position implies. Everyone can
 * sit on the bench, so BE is never listed here.
 */
export function startableSlots(
  player: Pick<RosterPlayer, "primary_position" | "positions">
): string[] {
  const espn = (player.positions ?? []).filter((slot) => slot !== "BE" && slot !== "IR");
  if (espn.length > 0) return espn;
  const implied = player.primary_position ? PRIMARY_SLOTS[player.primary_position] : undefined;
  return implied ?? ["UT"];
}

export interface LineupSlot {
  slot: string;
  player: RosterPlayer | null;
}

export interface Lineup {
  slots: LineupSlot[];
  /** Players no open slot could take: the roster is over-full at their positions. */
  overflow: RosterPlayer[];
}

/**
 * Fill the league's slots with the caller's players. The most constrained
 * players are placed first and each takes the most specific open slot it can
 * start in, so a pure centre lands at C before a PF/C does and UT and the
 * bench absorb the rest. A heuristic rather than a matching — enough to say
 * "2 C slots open" honestly.
 */
export function fillLineup(rosterSlots: Record<string, number>, players: RosterPlayer[]): Lineup {
  const slots: LineupSlot[] = [];
  for (const name of SLOT_ORDER) {
    const count = Math.max(0, Math.floor(Number(rosterSlots[name] ?? 0)));
    for (let i = 0; i < count; i++) slots.push({ slot: name, player: null });
  }
  const ordered = [...players].sort(
    (a, b) => startableSlots(a).length - startableSlots(b).length
  );
  const overflow: RosterPlayer[] = [];
  for (const player of ordered) {
    const eligible = new Set(startableSlots(player));
    const home = slots.find(
      (s) => s.player === null && (s.slot === "BE" || eligible.has(s.slot))
    );
    if (home) home.player = player;
    else overflow.push(player);
  }
  return { slots, overflow };
}

/** Empty starting slots by name — the bench is excluded, it says nothing about need. */
export function openStartingSlots(lineup: Lineup): { slot: string; open: number }[] {
  const open = new Map<string, number>();
  for (const s of lineup.slots) {
    if (s.player === null && s.slot !== "BE") open.set(s.slot, (open.get(s.slot) ?? 0) + 1);
  }
  return SLOT_ORDER.filter((name) => open.has(name)).map((name) => ({
    slot: name,
    open: open.get(name) as number,
  }));
}

export interface CapStatus {
  position: string;
  count: number;
  limit: number;
}

/**
 * Primary-position counts against the league's hard caps, in position order.
 * ESPN counts caps by primary position, not eligibility (plan §8 Q5), so a
 * PF/C listed C counts at C only.
 */
export function capStatuses(
  players: Pick<RosterPlayer, "primary_position">[],
  positionLimits: Record<string, number>
): CapStatus[] {
  const counts = new Map<string, number>();
  for (const p of players) {
    if (p.primary_position) counts.set(p.primary_position, (counts.get(p.primary_position) ?? 0) + 1);
  }
  const order = (position: string) => {
    const i = CAP_ORDER.indexOf(position);
    return i === -1 ? CAP_ORDER.length : i;
  };
  return Object.keys(positionLimits)
    .sort((a, b) => order(a) - order(b))
    .map((position) => ({
      position,
      count: counts.get(position) ?? 0,
      limit: Number(positionLimits[position]),
    }));
}

export interface TeamStack {
  team: string;
  count: number;
}

/** NBA teams the roster leans on, biggest stack first; below `min` is not a stack. */
export function teamStacks(players: Pick<RosterPlayer, "team">[], min = 2): TeamStack[] {
  const counts = new Map<string, number>();
  for (const p of players) if (p.team) counts.set(p.team, (counts.get(p.team) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count >= min)
    .map(([team, count]) => ({ team, count }))
    .sort((a, b) => b.count - a.count || a.team.localeCompare(b.team));
}

export interface KeeperStatus {
  keeper: DraftKeeperOut;
  /** A pick already holds this player (keeper or otherwise). */
  recorded: boolean;
  /** Why it cannot be recorded yet; null when it can. */
  blocker: string | null;
}

function normalized(name: string | null | undefined): string {
  return (name ?? "").toLowerCase().trim();
}

/** Same identity rule as the backend's duplicate check: strongest shared id wins. */
export function samePlayer(
  a: { player_id?: number | null; espn_player_id?: number | null; name?: string | null },
  pick: Pick<DraftPick, "player_id" | "espn_player_id" | "player_name">
): boolean {
  if (a.player_id != null && pick.player_id != null) return a.player_id === pick.player_id;
  if (a.espn_player_id != null && pick.espn_player_id != null) {
    return a.espn_player_id === pick.espn_player_id;
  }
  const name = normalized(a.name);
  return name !== "" && normalized(pick.player_name) === name;
}

/**
 * Each keeper against the session's picks: recorded already, recordable now
 * (it has a pick number — a round, and a slot to price it), or blocked.
 */
export function keeperStatuses(keepers: DraftKeeperOut[], picks: DraftPick[]): KeeperStatus[] {
  return keepers.map((keeper) => {
    const recorded = picks.some((pick) => samePlayer(keeper, pick));
    let blocker: string | null = null;
    if (!recorded) {
      if (keeper.player_id == null && keeper.espn_player_id == null && !keeper.name) {
        blocker = "no player";
      } else if (keeper.round == null) {
        blocker = "no round";
      } else if (keeper.overall_pick == null) {
        blocker = "set your slot";
      }
    }
    return { keeper, recorded, blocker };
  });
}

/**
 * The caller's players in pick order, each pick joined to its board roster
 * entry. A pick the board cannot place — a player not in nba.players yet —
 * still shows, positionless, so the roster count is never short.
 */
export function myRoster(roster: DraftRosterEntry[], picks: DraftPick[]): RosterPlayer[] {
  const byId = new Map(roster.map((entry) => [entry.player_id, entry]));
  const mine = picks.filter((p) => p.by_me).sort((a, b) => a.overall_pick - b.overall_pick);
  const placed = new Set<number>();
  const out: RosterPlayer[] = [];
  for (const pick of mine) {
    const entry = pick.player_id != null ? byId.get(pick.player_id) : undefined;
    if (entry) placed.add(entry.player_id);
    out.push({
      player_id: pick.player_id ?? -pick.overall_pick,
      name: entry?.name ?? pick.player_name ?? `Pick ${pick.overall_pick}`,
      primary_position: entry?.primary_position ?? null,
      positions: entry?.positions ?? null,
      team: entry?.team ?? null,
      overall_pick: pick.overall_pick,
      keeper: pick.source === "keeper",
    });
  }
  // Roster entries with no pick behind them: `mine` ids on the stateless board.
  for (const entry of roster) {
    if (placed.has(entry.player_id)) continue;
    out.push({
      player_id: entry.player_id,
      name: entry.name,
      primary_position: entry.primary_position,
      positions: entry.positions,
      team: entry.team,
      overall_pick: null,
      keeper: false,
    });
  }
  return out;
}

/** The pick "undo last" removes: the latest one made on the clock, else the latest of any. */
export function lastPick(picks: DraftPick[]): DraftPick | null {
  const latest = (list: DraftPick[]) =>
    list.reduce<DraftPick | null>((best, p) => (best === null || p.overall_pick > best.overall_pick ? p : best), null);
  return latest(picks.filter((p) => p.source !== "keeper")) ?? latest(picks);
}
