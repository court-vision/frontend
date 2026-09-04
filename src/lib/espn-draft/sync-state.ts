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
 *
 * The write path: a pick the room sends to ESPN (`draft-sent`) is `pending`
 * until ESPN echoes it as a SELECTED for our team — which the read path then
 * records like anyone else's pick — or until something says it will never
 * come: the extension's `command-result` failure, an ERROR frame, a closed
 * socket, a dropped port, or the hook's timeout. Nothing is recorded on send.
 * `canDraft` is the gate the UI and the hook both consult before sending.
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
  sent: number;        // picks this room sent to ESPN
  sendFailed: number;  // of those, the ones that never became our SELECTED
}

export type SendOutcome = "echoed" | "failed" | "timeout";

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
  /** What the extension advertised: `read`, plus `write` while its popup toggle is on. */
  capabilities: string[];
  /** A SELECT sent on the room's socket that ESPN has not yet answered. */
  pending: { playerId: number; requestId: string; since: number } | null;
  lastSend: {
    requestId: string;
    playerId: number;
    outcome: SendOutcome;
    reason: string | null;
    detail: string | null;
    at: number;
  } | null;
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
  | { type: "resume" }
  | { type: "capabilities"; capabilities: string[] }
  | { type: "draft-sent"; playerId: number; requestId: string }
  /** A send the hook itself gave up on (the port went away before ESPN answered). */
  | { type: "draft-result"; requestId: string; reason: string; detail?: string }
  | { type: "draft-timeout"; requestId: string };

export type SyncEffect =
  | { kind: "sync-init"; payload: string; leagueId: number | null; teamId: number | null }
  | {
      kind: "pick";
      espnPlayerId: number;
      teamId: number;
      bid: number | null;
      live: boolean;
      /** Set when this SELECTED is the echo of a pick this room sent. */
      sentRequestId?: string;
    }
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
    stats: {
      picks: 0,
      undos: 0,
      duplicates: 0,
      conflicts: 0,
      failed: 0,
      pausedFrames: 0,
      ignored: 0,
      malformed: 0,
      sent: 0,
      sendFailed: 0,
    },
    lastError: null,
    capabilities: [],
    pending: null,
    lastSend: null,
  };
}

const bump = (stats: SyncStats, key: keyof SyncStats): SyncStats => ({ ...stats, [key]: stats[key] + 1 });

/** True when a live frame should be applied rather than shelved. */
function acting(state: SyncState, ctx: SyncContext): boolean {
  return !ctx.paused && state.mismatch === null && !state.reset;
}

/** Close out the pending send, whatever closed it. A no-op when nothing is pending. */
function settle(
  state: SyncState,
  outcome: SendOutcome,
  reason: string | null,
  detail: string | null,
  at: number
): SyncState {
  if (!state.pending) return state;
  const { requestId, playerId } = state.pending;
  return {
    ...state,
    pending: null,
    stats: outcome === "echoed" ? state.stats : bump(state.stats, "sendFailed"),
    lastSend: { requestId, playerId, outcome, reason, detail, at },
  };
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
    // Whatever was in flight went out on a socket that no longer exists.
    const base = settle(state, "failed", "socket-reopened", null, record.ts);
    const leagueId = espnLeagueIdFromUrl(record.url);
    if (ctx.expectedLeagueId != null && leagueId != null && leagueId !== ctx.expectedLeagueId) {
      // Wrong room: latch a mismatch and act on nothing until a matching open.
      return { ...base, mismatch: { espnLeagueId: leagueId, expected: ctx.expectedLeagueId } };
    }
    return {
      ...base,
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
    const base = settle(state, "failed", "socket-closed", null, record.ts);
    return base.room ? { ...base, room: { ...base.room, closed: true } } : base;
  }

  if (record.kind === "command-result") {
    // Only the answer to OUR outstanding request matters; anything else (an
    // old request, another room's) is noise. `ok` means the tap put the frame
    // on the wire — the pick is still pending until ESPN's SELECTED.
    if (!state.pending || record.requestId !== state.pending.requestId) return state;
    if (record.ok) return state;
    return settle(state, "failed", record.reason ?? "unknown", null, record.ts);
  }

  // kind === "frame"
  if (record.dir === "out") return state; // our own PING / SELECT
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
      let next: SyncState = withTime;
      let sentRequestId: string | undefined;
      // Settle a pending send BEFORE the acting gate: the frame is the answer
      // to our request whether or not the pick itself gets applied right now.
      if (next.pending) {
        const mine = next.myTeamId != null && frame.teamId === next.myTeamId;
        if (mine && frame.playerId === next.pending.playerId) {
          sentRequestId = next.pending.requestId;
          next = settle(next, "echoed", null, null, record.ts);
        } else if (mine) {
          // The clock ran out, or ESPN autopicked: our team got someone else.
          next = settle(next, "failed", "superseded", null, record.ts);
        } else if (frame.playerId === next.pending.playerId) {
          next = settle(next, "failed", "taken", null, record.ts);
        }
      }
      // The team on the clock has picked; the next SELECTING names its successor.
      if (next.onClock && next.onClock.teamId === frame.teamId) next = { ...next, onClock: null };
      if (!acting(state, ctx)) return { ...next, stats: bump(next.stats, "pausedFrames") };
      effects.push({
        kind: "pick",
        espnPlayerId: frame.playerId,
        teamId: frame.teamId,
        bid: frame.op === "SOLD" ? frame.bid : null,
        live,
        ...(sentRequestId ? { sentRequestId } : {}),
      });
      return next;
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
    case "ERROR":
      // ESPN refuses out loud only in answer to something; while nothing is
      // pending it is somebody else's problem (or the room's own chatter).
      if (withTime.pending) return settle(withTime, "failed", "espn-error", frame.text || null, record.ts);
      return { ...withTime, stats: bump(withTime.stats, "ignored") };
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
      let next: SyncState = { ...state, connection: event.status, attempt, lastError: event.error ?? state.lastError };
      if (event.status !== "connected") {
        // A reconnect re-advertises capabilities; until then, assume none.
        next = settle({ ...next, capabilities: [] }, "failed", "disconnected", null, ctx.now);
      }
      return { state: next, effects };
    }
    case "capabilities":
      return { state: { ...state, capabilities: event.capabilities }, effects };
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
    case "draft-sent":
      return {
        state: {
          ...state,
          pending: { playerId: event.playerId, requestId: event.requestId, since: ctx.now },
          stats: bump(state.stats, "sent"),
        },
        effects,
      };
    case "draft-result":
      if (!state.pending || state.pending.requestId !== event.requestId) return { state, effects };
      return { state: settle(state, "failed", event.reason, event.detail ?? null, ctx.now), effects };
    case "draft-timeout":
      if (!state.pending || state.pending.requestId !== event.requestId) return { state, effects };
      return { state: settle(state, "timeout", "timeout", null, ctx.now), effects };
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

// ------------------------------- the gate ------------------------------- //

export type DraftGateReason =
  | "not-connected"
  | "no-write"
  | "no-room"
  | "room-closed"
  | "sse"
  | "paused"
  | "mismatch"
  | "reset"
  | "pending"
  | "no-team"
  | "not-on-clock"
  | "clock-stale";

export type DraftGate = { ok: true } | { ok: false; reason: DraftGateReason };

/** How long past ESPN's own clock a SELECTING still counts as "on the clock". */
export const CLOCK_GRACE_MS = 5_000;

/**
 * Whether the room may send a pick to ESPN right now. Checked in this order so
 * the first reason is the most fundamental one to fix. `now` is whatever clock
 * the caller trusts: the wall clock at send time; at render time, the last
 * inbound frame's timestamp (PONGs arrive every 15 s), which keeps the check
 * pure and still catches a SELECTING replayed from minutes ago.
 */
export function canDraft(state: SyncState, paused: boolean, now: number): DraftGate {
  const no = (reason: DraftGateReason): DraftGate => ({ ok: false, reason });
  // A dropped port clears capabilities too, so connection comes first: the
  // honest message then is "not connected", not "turn on the toggle".
  if (state.connection !== "connected") return no("not-connected");
  if (!state.capabilities.includes("write")) return no("no-write");
  if (!state.room) return no("no-room");
  if (state.room.closed) return no("room-closed");
  if (state.room.transport === "sse") return no("sse"); // receive-only
  if (paused) return no("paused");
  if (state.mismatch) return no("mismatch");
  if (state.reset) return no("reset");
  if (state.pending) return no("pending");
  if (state.myTeamId == null) return no("no-team");
  if (!state.onClock || state.onClock.teamId !== state.myTeamId) return no("not-on-clock");
  if (state.onClock.at + state.onClock.msRemaining + CLOCK_GRACE_MS < now) return no("clock-stale");
  return { ok: true };
}

/** One line for a disabled Draft button's tooltip or a refused keystroke's toast. */
export function canDraftLabel(reason: DraftGateReason): string {
  switch (reason) {
    case "no-write":
      return "Turn on “Allow drafting from Court Vision” in the Draft Tap popup";
    case "not-connected":
      return "Not connected to the Draft Tap";
    case "no-room":
      return "Open your ESPN draft room";
    case "room-closed":
      return "ESPN room closed — reload the ESPN tab";
    case "sse":
      return "ESPN room is on a receive-only connection — reload the ESPN tab";
    case "paused":
      return "Sync is paused";
    case "mismatch":
      return "The ESPN room is a different league";
    case "reset":
      return "ESPN reset the draft";
    case "pending":
      return "A pick is already on its way to ESPN";
    case "no-team":
      return "Your ESPN team is not known yet — wait for the room to reconcile";
    case "not-on-clock":
      return "Not your turn";
    case "clock-stale":
      return "ESPN has not said who is on the clock — check the ESPN tab";
  }
}

/** The toast for a send that did not become our pick. `detail` is ESPN's own text, when it gave one. */
export function sendFailureMessage(reason: string, detail?: string | null): string {
  switch (reason) {
    case "espn-error":
      return detail ? `ESPN refused the pick: ${detail}` : "ESPN refused the pick";
    case "write-disabled":
      return "Drafting is switched off in the Draft Tap popup";
    case "sse":
      return "ESPN room is on a receive-only connection — reload the ESPN tab";
    case "no-tab":
    case "no-socket":
    case "not-open":
    case "socket-closed":
    case "socket-reopened":
      return "The ESPN room's connection is gone — check the ESPN tab";
    case "disconnected":
      return "Lost the Draft Tap before ESPN answered — check the ESPN tab";
    case "taken":
      return "Someone else took that player first";
    case "superseded":
      return "ESPN recorded a different pick for you — did the clock run out?";
    case "timeout":
      return "No answer from ESPN — check the ESPN tab";
    default:
      return `The pick could not be sent (${reason})`;
  }
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
  if (state.pending) return { tone: "ok", label: "Sending pick to ESPN…", detail: null };

  const next = state.front ?? "?";
  const failing = state.stats.failed || state.stats.conflicts;
  const detailBits: string[] = [];
  if (state.onClock && state.myTeamId != null && state.onClock.teamId === state.myTeamId) detailBits.push("on the clock: you");
  if (state.capabilities.includes("write")) detailBits.push("drafting on");
  if (state.stats.picks) detailBits.push(`${state.stats.picks} synced`);
  if (state.stats.conflicts) detailBits.push(`${state.stats.conflicts} disagree`);
  if (state.stats.failed) detailBits.push(`${state.stats.failed} failed`);
  const detail = detailBits.join(" · ") || null;

  if (state.reconciled === "failed" || !state.initSeen)
    return { tone: failing ? "error" : "warn", label: `Live (unreconciled) · next pick ${next}`, detail: detail ?? "Resync to reconcile with ESPN" };
  return { tone: failing ? "error" : "ok", label: `Live · next pick ${next}`, detail };
}
