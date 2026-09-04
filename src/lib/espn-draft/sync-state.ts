/**
 * The ESPN-sync state machine, as a pure reducer.
 *
 * `reduce(state, event, ctx)` folds extension messages (and the results of the
 * effects it asks for) into a `SyncState`, returning the state plus a list of
 * `SyncEffect`s the hook should run — post an INIT snapshot, record a pick,
 * undo a pick. Keeping it pure is what makes the numbering rules (trap T1) and
 * the pause / mismatch / reset gates testable without React, a network, or a
 * browser. The hook (`useEspnDraftSync`) is the only thing that runs effects
 * and feeds their results back as events.
 *
 * Numbering: the reducer never bakes a pick number into a `pick` effect,
 * because a replay burst delivers INIT and the SELECTED frames after it in one
 * synchronous pass, before the backend has said where the draft front is. The
 * hook reserves a number at execution time (`pick-reserve`) once INIT has been
 * reconciled, so the front is authoritative by then.
 */
import type { DraftSession } from "@/types/draft";
import {
  espnLeagueIdFromUrl,
  parseFrame,
  peekInitHeader,
  type TapRecord,
} from "./protocol";

export type Connection =
  | "unconfigured"
  | "unsupported"
  | "not-installed"
  | "connecting"
  | "connected"
  | "disconnected";

export type Reconciled = "none" | "pending" | "ok" | "failed";

export interface SyncStats {
  picks: number;       // picks that reached the board (inserted or already-there)
  undos: number;
  duplicates: number;  // picks the server already had (a normal reconnect)
  conflicts: number;   // same number, a different player — needs a resync
  failed: number;
  pausedFrames: number;
  ignored: number;
  malformed: number;
}

export interface SyncState {
  connection: Connection;
  attempt: number;
  room: {
    tab: number | null;
    leagueId: number | null;
    transport: "ws" | "sse";
    openedAt: number;
    closed: boolean;
  } | null;
  mismatch: { espnLeagueId: number; expected: number } | null;
  myTeamId: number | null;
  initSeen: boolean;
  reconciled: Reconciled;
  /** The next ESPN pick number to assign, or null until an INIT settles it. */
  front: number | null;
  onClock: { teamId: number; msRemaining: number; at: number } | null;
  reset: boolean;
  lastFrameAt: number | null;
  stats: SyncStats;
  lastError: string | null;
}

export type PickOutcome = "inserted" | "duplicate" | "conflict" | "failed";

export type SyncEvent =
  | { type: "port"; status: Connection; error?: string }
  | { type: "replay"; records: TapRecord[] }
  | { type: "record"; record: TapRecord }
  | { type: "init-result"; ok: true; front: number; myTeamId: number }
  | { type: "init-result"; ok: false; error: string; code?: string; fallbackFront: number | null }
  | { type: "pick-reserve"; overall: number }
  | { type: "pick-result"; outcome: PickOutcome; error?: string }
  /** A queued pick the runner declined to post (mismatch/reset latched after it was queued). */
  | { type: "pick-skipped" }
  | { type: "undo-result"; ok: boolean; error?: string }
  | { type: "resume" };

export type SyncEffect =
  | { kind: "sync-init"; payload: string; leagueId: number | null; teamId: number | null }
  | { kind: "pick"; espnPlayerId: number; teamId: number; bid: number | null; live: boolean }
  | { kind: "undo"; pickNumber: number };

export interface SyncContext {
  expectedLeagueId: number | null;
  paused: boolean;
  now: number;
}

export function initialState(): SyncState {
  return {
    connection: "unconfigured",
    attempt: 0,
    room: null,
    mismatch: null,
    myTeamId: null,
    initSeen: false,
    reconciled: "none",
    front: null,
    onClock: null,
    reset: false,
    lastFrameAt: null,
    stats: { picks: 0, undos: 0, duplicates: 0, conflicts: 0, failed: 0, pausedFrames: 0, ignored: 0, malformed: 0 },
    lastError: null,
  };
}

const bump = (stats: SyncStats, key: keyof SyncStats): SyncStats => ({ ...stats, [key]: stats[key] + 1 });

/** True when a live frame should be applied rather than shelved. */
function acting(state: SyncState, ctx: SyncContext): boolean {
  return !ctx.paused && state.mismatch === null && !state.reset;
}

/**
 * Fold one tap record into the state, collecting any effects. Records from a
 * background ESPN tab (a different `tab` than the room's) are dropped; a new
 * `open` re-establishes the room on whatever tab it came from.
 */
function applyRecord(
  state: SyncState,
  record: TapRecord,
  ctx: SyncContext,
  effects: SyncEffect[],
  /** False during a replay burst (catch-up), true for a frame that just arrived. */
  live: boolean
): SyncState {
  // A stray record from another tab, once a room is established.
  if (
    record.kind !== "open" &&
    state.room &&
    record.tab != null &&
    state.room.tab != null &&
    record.tab !== state.room.tab
  ) {
    return state;
  }

  if (record.kind === "open") {
    const leagueId = espnLeagueIdFromUrl(record.url);
    if (ctx.expectedLeagueId != null && leagueId != null && leagueId !== ctx.expectedLeagueId) {
      // Wrong room: latch a mismatch and act on nothing until a matching open.
      return { ...state, mismatch: { espnLeagueId: leagueId, expected: ctx.expectedLeagueId } };
    }
    return {
      ...state,
      room: {
        tab: record.tab ?? null,
        leagueId,
        transport: record.transport === "sse" ? "sse" : "ws",
        openedAt: record.ts,
        closed: false,
      },
      mismatch: null,
      initSeen: false,
      reconciled: "none",
      reset: false,
      front: null,
      onClock: null,
    };
  }

  if (record.kind === "close" || record.kind === "error") {
    return state.room ? { ...state, room: { ...state.room, closed: true } } : state;
  }

  // kind === "frame"
  if (record.dir === "out") return state; // our own PING etc.
  const frame = parseFrame(record.frame ?? "");
  const withTime = { ...state, lastFrameAt: record.ts };

  switch (frame.op) {
    case "INIT": {
      const header = peekInitHeader(frame.payload);
      const next: SyncState = {
        ...withTime,
        initSeen: true,
        myTeamId: header?.teamId ?? state.myTeamId,
      };
      if (!acting(state, ctx)) return { ...next, stats: bump(next.stats, "pausedFrames") };
      effects.push({
        kind: "sync-init",
        payload: frame.payload,
        leagueId: state.room?.leagueId ?? header?.leagueId ?? null,
        teamId: header?.teamId ?? null,
      });
      return { ...next, reconciled: "pending", front: null };
    }
    case "SELECTED":
    case "SOLD": {
      if (!acting(state, ctx)) return { ...withTime, stats: bump(withTime.stats, "pausedFrames") };
      effects.push({
        kind: "pick",
        espnPlayerId: frame.playerId,
        teamId: frame.teamId,
        bid: frame.op === "SOLD" ? frame.bid : null,
        live,
      });
      return withTime;
    }
    case "UNDONE": {
      if (!acting(state, ctx)) return { ...withTime, stats: bump(withTime.stats, "pausedFrames") };
      effects.push({ kind: "undo", pickNumber: frame.pickNumber });
      // The next pick refills the hole the undo left.
      return { ...withTime, front: withTime.front === null ? frame.pickNumber : Math.min(withTime.front, frame.pickNumber) };
    }
    case "RESET":
      // Nothing destructive: pause and let the user decide (Resume reconnects).
      return { ...withTime, reset: true };
    case "SELECTING":
      return { ...withTime, onClock: { teamId: frame.teamId, msRemaining: frame.msRemaining, at: record.ts } };
    case "AUTODRAFT":
    case "CLOCK":
    case "ignored":
      return { ...withTime, stats: bump(withTime.stats, "ignored") };
    case "malformed":
      return { ...withTime, stats: bump(withTime.stats, "malformed") };
  }
}

export function reduce(state: SyncState, event: SyncEvent, ctx: SyncContext): { state: SyncState; effects: SyncEffect[] } {
  const effects: SyncEffect[] = [];

  switch (event.type) {
    case "port": {
      const attempt =
        event.status === "connected" ? 0 : event.status === "disconnected" ? state.attempt + 1 : state.attempt;
      return {
        state: { ...state, connection: event.status, attempt, lastError: event.error ?? state.lastError },
        effects,
      };
    }
    case "replay": {
      let s = state;
      for (const record of event.records) s = applyRecord(s, record, ctx, effects, false);
      return { state: s, effects };
    }
    case "record":
      return { state: applyRecord(state, event.record, ctx, effects, true), effects };
    case "init-result": {
      if (event.ok) {
        return { state: { ...state, reconciled: "ok", front: event.front, myTeamId: event.myTeamId }, effects };
      }
      // A server-side league refusal is terminal, not a degraded mode: latch the
      // mismatch so nothing else is posted into this session from that room.
      const mismatch =
        event.code === "DRAFT_INIT_LEAGUE_MISMATCH"
          ? { espnLeagueId: state.room?.leagueId ?? 0, expected: ctx.expectedLeagueId ?? 0 }
          : state.mismatch;
      return {
        state: {
          ...state,
          reconciled: "failed",
          mismatch,
          front: state.front ?? event.fallbackFront,
          lastError: event.error,
        },
        effects,
      };
    }
    case "pick-skipped":
      return { state: { ...state, stats: bump(state.stats, "pausedFrames") }, effects };
    case "pick-reserve":
      return { state: { ...state, front: event.overall + 1 }, effects };
    case "pick-result": {
      let stats = state.stats;
      if (event.outcome === "inserted") stats = bump(stats, "picks");
      else if (event.outcome === "duplicate") stats = bump(bump(stats, "picks"), "duplicates");
      else if (event.outcome === "conflict") stats = bump(stats, "conflicts");
      else stats = bump(stats, "failed");
      return { state: { ...state, stats, lastError: event.error ?? state.lastError }, effects };
    }
    case "undo-result":
      return {
        state: event.ok
          ? { ...state, stats: bump(state.stats, "undos") }
          : { ...state, stats: bump(state.stats, "failed"), lastError: event.error ?? state.lastError },
        effects,
      };
    case "resume":
      // The hook follows this with a reconnect, whose replay re-applies the
      // shelved frames. Here we only lift the reset gate.
      return { state: { ...state, reset: false }, effects };
  }
}

/**
 * The pick number to reserve next when the reducer's front is not yet known
 * (INIT sync failed, or F1 has no backend endpoint): the session's own draft
 * front — one past the last non-keeper pick, else its next unused number.
 */
export function frontFromSession(session: Pick<DraftSession, "picks" | "next_overall_pick">): number {
  const played = (session.picks ?? []).filter((p) => p.source !== "keeper").map((p) => p.overall_pick);
  return played.length ? Math.max(...played) + 1 : session.next_overall_pick;
}

export type ChipTone = "muted" | "ok" | "warn" | "error";

/** The status pill's tone, label and optional detail line for a given state. */
export function chipStatus(state: SyncState, paused: boolean): { tone: ChipTone; label: string; detail: string | null } {
  if (state.connection === "unsupported") return { tone: "muted", label: "ESPN sync: Chrome only", detail: null };
  if (state.connection === "not-installed")
    return { tone: "warn", label: "ESPN sync: tap not found", detail: "Load the Draft Tap extension, then reload" };
  if (paused)
    return {
      tone: "warn",
      label: "Sync paused",
      detail: state.stats.pausedFrames ? `${state.stats.pausedFrames} ESPN events not applied — Resume replays them` : null,
    };
  if (state.reset)
    return { tone: "error", label: "ESPN draft was reset — sync paused", detail: "Undo picks by hand or start a new session, then Resume" };
  if (state.mismatch)
    return {
      tone: "warn",
      label: `ESPN room is league ${state.mismatch.espnLeagueId}, this session is league ${state.mismatch.expected}`,
      detail: "Open your league's draft room to sync",
    };
  if (state.connection === "connecting") return { tone: "muted", label: "Connecting to tap…", detail: null };
  if (state.connection === "disconnected")
    return { tone: "warn", label: "Tap disconnected — retrying", detail: state.attempt > 1 ? `attempt ${state.attempt}` : null };

  // connected
  if (!state.room || state.room.closed)
    return {
      tone: state.room?.closed ? "warn" : "muted",
      label: state.room?.closed ? "ESPN room closed — reload the ESPN tab" : "Tap ready — open your ESPN draft room",
      detail: null,
    };
  if (state.reconciled === "pending") return { tone: "muted", label: "Reconciling with ESPN…", detail: null };

  const next = state.front ?? "?";
  const failing = state.stats.failed || state.stats.conflicts;
  const detailBits: string[] = [];
  if (state.onClock && state.myTeamId != null && state.onClock.teamId === state.myTeamId) detailBits.push("on the clock: you");
  if (state.stats.picks) detailBits.push(`${state.stats.picks} synced`);
  if (state.stats.conflicts) detailBits.push(`${state.stats.conflicts} disagree`);
  if (state.stats.failed) detailBits.push(`${state.stats.failed} failed`);
  const detail = detailBits.join(" · ") || null;

  if (state.reconciled === "failed" || !state.initSeen)
    return { tone: failing ? "error" : "warn", label: `Live (unreconciled) · next pick ${next}`, detail: detail ?? "Resync to reconcile with ESPN" };
  return { tone: failing ? "error" : "ok", label: `Live · next pick ${next}`, detail };
}
