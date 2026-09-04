"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DRAFT_TAP_EXTENSION_ID } from "@/endpoints";
import { toApiError, userMessage } from "@/lib/api-error";
import { parseExtensionMessage, type SelectCommand } from "@/lib/espn-draft/protocol";
import {
  backoffDelay,
  chromeRuntimeAvailable,
  connectToExtension,
  type PortHandle,
} from "@/lib/espn-draft/extension";
import {
  canDraft as canDraftGate,
  frontFromSession,
  initialState,
  reduce,
  type DraftGate,
  type DraftGateReason,
  type SyncEffect,
  type SyncEvent,
  type SyncState,
} from "@/lib/espn-draft/sync-state";
import {
  draftKeys,
  useDraftInitSyncMutation,
  useDraftPickMutation,
  useUndoDraftPickMutation,
  useUpdateDraftSessionMutation,
} from "@/hooks/useDrafts";
import { useDraftSyncStore } from "@/stores/useDraftSyncStore";
import type { DraftBoardResult, DraftBoardRow, DraftSession } from "@/types/draft";

/** How long a sent pick waits for ESPN's SELECTED before the room gives up on it. */
export const SEND_TIMEOUT_MS = 10_000;

/** The toast id for one player's send, so "Sending…" is replaced in place by its outcome. */
export const sendToastId = (espnPlayerId: number) => `espn-send-${espnPlayerId}`;

export type SendResult =
  | { outcome: "echoed" }
  | { outcome: "refused"; reason: DraftGateReason }
  | { outcome: "failed"; reason: string; detail: string | null }
  | { outcome: "timeout" };

export interface EspnDraftSyncInput {
  sessionId: number;
  session: DraftSession | undefined;
  board: DraftBoardResult | undefined;
  /** The ESPN draft this session is linked to, or null until a mock room links to one. */
  expectedLeagueId: number | null;
  /** True for a mock room with no link yet: the first ESPN room it sees is offered, not adopted. */
  bindable: boolean;
  enabled: boolean;
}

export interface EspnDraftSync {
  state: SyncState;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  reconnect: () => void;
  resume: () => void;
  /** Whether the feature is switched on at all (an extension id is configured). */
  configured: boolean;
  /** Whether a pick can be sent to ESPN right now — and if not, the first reason why. */
  canDraft: DraftGate;
  pending: SyncState["pending"];
  /** An ESPN room seen by an unlinked mock session, awaiting the user's say-so. */
  unbound: SyncState["unbound"];
  /** Link this session to the room in `unbound` and reconnect; rejects with the API error (409 when another room has it). */
  linkRoom: () => Promise<void>;
  /** Keep ignoring the room in `unbound` (its frames stay shelved). */
  ignoreRoom: () => void;
  /**
   * Send `SELECT <espn_id>` on the ESPN room's own socket. Settles when ESPN
   * echoes the pick (which the sync path then records), when something says
   * it never will, or after `SEND_TIMEOUT_MS`.
   */
  draftPlayer: (row: DraftBoardRow) => Promise<SendResult>;
}

/**
 * Drive the draft room from live ESPN frames relayed by the Draft Tap
 * extension. Owns the port lifecycle, a serialized effect queue (order matters:
 * an INIT's reconciliation must land before the picks after it), and the pick /
 * undo mutations. All the decision logic lives in the pure reducer in
 * `sync-state.ts`; this hook only runs its effects and feeds back the results.
 *
 * Every queued effect carries the generation it was queued under. The
 * generation advances when the session changes or the connection is torn down,
 * and a stale effect neither starts nor reports — so work queued for one room
 * can never post into the next, and a resync's replay starts clean.
 *
 * A send goes straight onto the port, never through the effect chain: the
 * chain may be busy reconciling an INIT, and the clock does not wait for it.
 */
export function useEspnDraftSync(input: EspnDraftSyncInput): EspnDraftSync {
  const { sessionId, expectedLeagueId, bindable, enabled } = input;
  const queryClient = useQueryClient();
  const { paused, setPaused: setPausedStore } = useDraftSyncStore();

  const syncPick = useDraftPickMutation(sessionId, { silent: true });
  const syncUndo = useUndoDraftPickMutation(sessionId, { silent: true });
  const syncInit = useDraftInitSyncMutation(sessionId);
  const updateSession = useUpdateDraftSessionMutation(sessionId);

  // State via a manual reducer: `reduce` returns effects alongside the next
  // state, which a plain useReducer cannot surface, so `dispatch` is our own.
  const [state, setState] = useReducer((_s: SyncState, next: SyncState) => next, undefined, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Latest render values the async effect runners read, so a queued effect
  // never closes over a stale mutation, board, or context.
  const refs = useRef({ paused, expectedLeagueId, bindable, syncPick, syncUndo, syncInit, updateSession });
  refs.current = { paused, expectedLeagueId, bindable, syncPick, syncUndo, syncInit, updateSession };

  const chain = useRef<Promise<void>>(Promise.resolve());
  const genRef = useRef(0);
  const handleRef = useRef<PortHandle | null>(null);

  // The one send that may be in flight: its promise is settled from `dispatch`
  // the moment the reducer clears `pending`, whatever cleared it.
  const sendRef = useRef<{
    requestId: string;
    resolve: (result: SendResult) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const abandonSend = useCallback((reason: string) => {
    const send = sendRef.current;
    if (!send) return;
    clearTimeout(send.timer);
    sendRef.current = null;
    send.resolve({ outcome: "failed", reason, detail: null });
  }, []);

  const cachedSession = useCallback(
    () => queryClient.getQueryData<DraftSession>(draftKeys.detail(sessionId)) ?? input.session,
    [queryClient, sessionId, input.session]
  );
  const cachedBoard = useCallback(
    () => queryClient.getQueryData<DraftBoardResult>(draftKeys.board(sessionId)) ?? input.board,
    [queryClient, sessionId, input.board]
  );

  // Effects run through a ref so `dispatch` can stay stable (empty deps) while
  // the runners it schedules close over the latest render — breaking what would
  // otherwise be a dispatch ⇄ runEffect dependency cycle. The ref MUST return
  // the runner's promise: the chain serializes by awaiting it.
  const runEffectRef = useRef<(eff: SyncEffect, gen: number) => Promise<void>>(async () => {});

  // ---- dispatch: reduce, then serialize effects ----

  const dispatch = useCallback((event: SyncEvent) => {
    const ctx = {
      expectedLeagueId: refs.current.expectedLeagueId,
      bindable: refs.current.bindable,
      paused: refs.current.paused,
      now: Date.now(),
    };
    const prev = stateRef.current;
    const { state: next, effects } = reduce(prev, event, ctx);
    stateRef.current = next;
    setState(next);

    const send = sendRef.current;
    if (send && prev.pending?.requestId === send.requestId && next.pending === null) {
      clearTimeout(send.timer);
      sendRef.current = null;
      const last = next.lastSend;
      send.resolve(
        last?.outcome === "echoed"
          ? { outcome: "echoed" }
          : last?.outcome === "timeout"
            ? { outcome: "timeout" }
            : { outcome: "failed", reason: last?.reason ?? "unknown", detail: last?.detail ?? null }
      );
    }

    const gen = genRef.current;
    for (const eff of effects) {
      // A stale effect (queued under an earlier generation) is dropped unrun.
      const run = () => (gen === genRef.current ? runEffectRef.current(eff, gen) : Promise.resolve());
      chain.current = chain.current.then(run, run);
    }
  }, []);

  // ---- effect runners ----

  const runSyncInit = useCallback(
    async (eff: Extract<SyncEffect, { kind: "sync-init" }>, gen: number) => {
      try {
        const result = await refs.current.syncInit.mutateAsync(eff.payload);
        if (gen !== genRef.current) return;
        dispatch({
          type: "init-result",
          ok: true,
          front: result.espn_front,
          myTeamId: result.espn_team_id,
          draftState: result.draft_state,
        });
      } catch (error) {
        if (gen !== genRef.current) return;
        // Reconciliation failed (backend down, a league mismatch, a bad frame):
        // fall back to the session's own front so live picks still number, and
        // let the chip show the unreconciled state.
        const session = cachedSession();
        dispatch({
          type: "init-result",
          ok: false,
          error: userMessage(error),
          code: toApiError(error).code ?? undefined,
          fallbackFront: session ? frontFromSession(session) : null,
        });
      }
    },
    [cachedSession, dispatch]
  );

  const runPick = useCallback(
    async (eff: Extract<SyncEffect, { kind: "pick" }>, gen: number) => {
      // A gate may have latched after this effect was queued (a server-side
      // league refusal, a RESET). Re-check at run time; never post through it.
      if (stateRef.current.mismatch || stateRef.current.reset) {
        dispatch({ type: "pick-skipped" });
        return;
      }
      let front = stateRef.current.front;
      if (front === null) {
        const session = cachedSession();
        front = session ? frontFromSession(session) : 1;
      }
      // A pick the session already holds needs no round trip: a replay after a
      // reload re-delivers every pick the room synced live, and posting each
      // one only to be told "already drafted" is what made catching up slow.
      // The number is still reserved, so the front stays honest.
      const held = cachedSession()?.picks.find((p) => p.espn_player_id === eff.espnPlayerId);
      if (held && !eff.sentRequestId) {
        dispatch({ type: "pick-reserve", overall: Math.max(front, held.overall_pick) });
        dispatch({ type: "pick-result", outcome: "duplicate" });
        return;
      }
      const overall = front;
      // Reserve the number synchronously, before the await, so the next queued
      // pick sees the advance (trap T1: never let the backend pick the number).
      dispatch({ type: "pick-reserve", overall });

      const row = cachedBoard()?.rows.find((r) => r.espn_id === eff.espnPlayerId);
      const name = row?.name ?? `Player ${eff.espnPlayerId}`;
      const myTeamId = stateRef.current.myTeamId;
      // Our own send: its "Sending…" toast is resolved in place, whatever happens.
      const sent = eff.sentRequestId ? { id: sendToastId(eff.espnPlayerId) } : null;
      const unrecorded = () =>
        toast.error(`ESPN has ${name} at ${overall}, but the room could not record it — Resync`, sent ?? undefined);
      try {
        await refs.current.syncPick.mutateAsync({
          overall_pick: overall,
          espn_player_id: eff.espnPlayerId,
          // Who ESPN says picked: the seat is a lookup from this, not a guess
          // from the pick number, so traded picks and auctions attribute right.
          espn_team_id: eff.teamId,
          player_id: row?.player_id ?? null,
          player_name: row?.name ?? null,
          by_me: myTeamId != null && eff.teamId === myTeamId,
          source: "espn_sync",
          bid: eff.bid,
        });
        if (gen !== genRef.current) return;
        dispatch({ type: "pick-result", outcome: "inserted" });
        if (sent) {
          toast.success(`You drafted ${name} at ${overall} · ESPN`, sent);
        } else if (eff.live) {
          // Only a pick that just happened earns a toast; a late-join replay of
          // forty picks is a chip count, not forty notifications.
          toast.message(`${name} off the board at ${overall} · ESPN`, { id: `espn-pick-${overall}` });
        }
      } catch (error) {
        if (gen !== genRef.current) return;
        const api = toApiError(error);
        if (api.code === "DRAFT_PLAYER_ALREADY_DRAFTED") {
          dispatch({ type: "pick-result", outcome: "duplicate" });
          if (sent) toast.success(`You drafted ${name} · ESPN`, sent);
          return;
        }
        if (api.code === "DRAFT_PICK_ALREADY_EXISTS") {
          const held = cachedSession()?.picks.find((p) => p.overall_pick === overall);
          const sameEspn = held?.espn_player_id === eff.espnPlayerId;
          dispatch({
            type: "pick-result",
            outcome: sameEspn ? "duplicate" : "conflict",
            error: sameEspn ? undefined : `Pick ${overall} is a different player in ESPN — Resync`,
          });
          if (sent) {
            if (sameEspn) toast.success(`You drafted ${name} at ${overall} · ESPN`, sent);
            else unrecorded();
          }
          return;
        }
        dispatch({ type: "pick-result", outcome: "failed", error: userMessage(error) });
        if (sent) unrecorded();
      }
    },
    [cachedSession, cachedBoard, dispatch]
  );

  const runUndo = useCallback(
    async (eff: Extract<SyncEffect, { kind: "undo" }>, gen: number) => {
      try {
        await refs.current.syncUndo.mutateAsync(eff.pickNumber);
        if (gen !== genRef.current) return;
        dispatch({ type: "undo-result", ok: true });
      } catch (error) {
        if (gen !== genRef.current) return;
        const api = toApiError(error);
        if (api.status === 404) {
          dispatch({ type: "undo-result", ok: true }); // already gone
          return;
        }
        dispatch({ type: "undo-result", ok: false, error: userMessage(error) });
      }
    },
    [dispatch]
  );

  // ESPN says the draft is over: close the session. The backend also closes a
  // room whose picks fill it, so this only matters when ESPN ends early (a
  // commissioner stopping the draft) or when the length was never known.
  const runComplete = useCallback(
    async (gen: number) => {
      const session = cachedSession();
      if (!session || session.status !== "active") return;
      try {
        await refs.current.updateSession.mutateAsync({ status: "completed" });
        if (gen !== genRef.current) return;
        toast.success("Draft complete — ESPN says the draft is over", { id: "espn-draft-complete" });
      } catch {
        // The chip still shows ESPN's state; the room can be finished from the list.
      }
    },
    [cachedSession]
  );

  runEffectRef.current = (eff: SyncEffect, gen: number) => {
    if (eff.kind === "sync-init") return runSyncInit(eff, gen);
    if (eff.kind === "pick") return runPick(eff, gen);
    if (eff.kind === "complete") return runComplete(gen);
    return runUndo(eff, gen);
  };

  // ---- the write path ----

  const draftPlayer = useCallback(
    (row: DraftBoardRow): Promise<SendResult> => {
      // Re-validate at send time on the wall clock: the button's gate ran at
      // render, on the last frame's timestamp.
      const gate = canDraftGate(stateRef.current, refs.current.paused, Date.now());
      if (!gate.ok) return Promise.resolve({ outcome: "refused", reason: gate.reason });
      const playerId = row.espn_id;
      if (playerId == null) return Promise.resolve({ outcome: "failed", reason: "no-espn-id", detail: null });
      const handle = handleRef.current;
      if (!handle) return Promise.resolve({ outcome: "refused", reason: "not-connected" });

      const requestId = crypto.randomUUID();
      const command: SelectCommand = { type: "select", playerId, requestId };
      if (!handle.send(command)) return Promise.resolve({ outcome: "failed", reason: "disconnected", detail: null });

      return new Promise<SendResult>((resolve) => {
        const timer = setTimeout(() => dispatch({ type: "draft-timeout", requestId }), SEND_TIMEOUT_MS);
        sendRef.current = { requestId, resolve, timer };
        dispatch({ type: "draft-sent", playerId, requestId });
      });
    },
    [dispatch]
  );

  // Render-time gate on the last frame's clock (pure); `draftPlayer` re-checks
  // on the wall clock before anything goes out.
  const canDraft = useMemo(() => canDraftGate(state, paused, state.lastFrameAt ?? 0), [state, paused]);

  // ---- session change: start the reducer clean, orphan any queued work ----

  useEffect(() => {
    genRef.current += 1;
    stateRef.current = initialState();
    setState(stateRef.current);
    chain.current = Promise.resolve();
    abandonSend("disconnected");
  }, [sessionId, abandonSend]);

  // ---- port lifecycle ----

  const [nonce, setNonce] = useState(0);
  const reconnect = useCallback(() => setNonce((n) => n + 1), []);

  // ---- linking ----

  const linkRoom = useCallback(async () => {
    const target = stateRef.current.unbound?.espnLeagueId;
    if (target == null) return;
    await refs.current.updateSession.mutateAsync({ espn_league_id: target });
    // The session now carries the link, so the reconnect's replay applies the
    // room's frames under a matching expectation — INIT and all.
    reconnect();
  }, [reconnect]);

  const ignoreRoom = useCallback(() => dispatch({ type: "dismiss-room" }), [dispatch]);
  const setPaused = useCallback(
    (p: boolean) => {
      setPausedStore(p);
      if (!p) reconnect(); // resume replays the shelved frames on reconnect
    },
    [setPausedStore, reconnect]
  );
  const resume = useCallback(() => {
    dispatch({ type: "resume" });
    setPaused(false);
  }, [dispatch, setPaused]);

  useEffect(() => {
    if (!enabled) {
      dispatch({ type: "port", status: "unconfigured" });
      return;
    }
    if (!DRAFT_TAP_EXTENSION_ID) {
      dispatch({ type: "port", status: "unconfigured" });
      return;
    }
    if (!chromeRuntimeAvailable()) {
      dispatch({ type: "port", status: "unsupported" });
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      dispatch({ type: "port", status: "connecting" });
      // `connectToExtension` reports a synchronous connect failure through
      // onDisconnect *and* returns null; only an unreported null is "unsupported".
      let reported = false;
      handleRef.current = connectToExtension(DRAFT_TAP_EXTENSION_ID, {
        onMessage: (msg) => {
          const parsed = parseExtensionMessage(msg);
          if (!parsed) return;
          if (parsed.type === "hello") {
            dispatch({ type: "port", status: "connected" });
            // A pre-0.3 extension advertises nothing: it can read, and that is all.
            dispatch({ type: "capabilities", capabilities: parsed.capabilities ?? ["read"] });
          } else if (parsed.type === "capabilities") {
            dispatch({ type: "capabilities", capabilities: parsed.capabilities });
          } else if (parsed.type === "replay") {
            dispatch({ type: "port", status: "connected" });
            dispatch({ type: "replay", records: parsed.records });
          } else {
            dispatch({ type: "record", record: parsed.record });
          }
        },
        onDisconnect: (reason) => {
          if (cancelled) return;
          reported = true;
          handleRef.current = null;
          if (reason === "not-installed") {
            dispatch({ type: "port", status: "not-installed" });
            timer = setTimeout(connect, 30_000); // they may install mid-session
          } else {
            dispatch({ type: "port", status: "disconnected" });
            timer = setTimeout(connect, backoffDelay(stateRef.current.attempt));
          }
        },
      });
      if (handleRef.current === null && !reported) dispatch({ type: "port", status: "unsupported" });
    };

    connect();
    return () => {
      cancelled = true;
      // Orphan whatever this connection queued: a reconnect's replay re-delivers
      // it, and a disabled room must post nothing further.
      genRef.current += 1;
      if (timer) clearTimeout(timer);
      abandonSend("disconnected");
      handleRef.current?.disconnect();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sessionId, nonce]);

  return {
    state,
    paused,
    setPaused,
    reconnect,
    resume,
    configured: Boolean(DRAFT_TAP_EXTENSION_ID),
    canDraft,
    pending: state.pending,
    draftPlayer,
    unbound: state.unbound,
    linkRoom,
    ignoreRoom,
  };
}
