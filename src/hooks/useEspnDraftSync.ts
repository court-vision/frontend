"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DRAFT_TAP_EXTENSION_ID } from "@/endpoints";
import { toApiError, userMessage } from "@/lib/api-error";
import { parseExtensionMessage } from "@/lib/espn-draft/protocol";
import {
  backoffDelay,
  chromeRuntimeAvailable,
  connectToExtension,
  type PortHandle,
} from "@/lib/espn-draft/extension";
import {
  frontFromSession,
  initialState,
  reduce,
  type SyncEffect,
  type SyncEvent,
  type SyncState,
} from "@/lib/espn-draft/sync-state";
import {
  draftKeys,
  useDraftInitSyncMutation,
  useDraftPickMutation,
  useUndoDraftPickMutation,
} from "@/hooks/useDrafts";
import { useDraftSyncStore } from "@/stores/useDraftSyncStore";
import type { DraftBoardResult, DraftSession } from "@/types/draft";

export interface EspnDraftSyncInput {
  sessionId: number;
  session: DraftSession | undefined;
  board: DraftBoardResult | undefined;
  /** The ESPN league id this session belongs to, or null for a mock/unsynced session. */
  expectedLeagueId: number | null;
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
}

/**
 * Drive the draft room from live ESPN frames relayed by the Draft Tap
 * extension. Owns the port lifecycle, a serialized effect queue (order matters:
 * an INIT's reconciliation must land before the picks after it), and the pick /
 * undo mutations. All the decision logic lives in the pure reducer in
 * `sync-state.ts`; this hook only runs its effects and feeds back the results.
 */
export function useEspnDraftSync(input: EspnDraftSyncInput): EspnDraftSync {
  const { sessionId, expectedLeagueId, enabled } = input;
  const queryClient = useQueryClient();
  const { paused, setPaused: setPausedStore } = useDraftSyncStore();

  const syncPick = useDraftPickMutation(sessionId, { silent: true });
  const syncUndo = useUndoDraftPickMutation(sessionId, { silent: true });
  const syncInit = useDraftInitSyncMutation(sessionId);

  // State via a manual reducer: `reduce` returns effects alongside the next
  // state, which a plain useReducer cannot surface, so `dispatch` is our own.
  const [state, setState] = useReducer((_s: SyncState, next: SyncState) => next, undefined, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Latest render values the async effect runners read, so a queued effect
  // never closes over a stale mutation, board, or context.
  const refs = useRef({ paused, expectedLeagueId, syncPick, syncUndo, syncInit });
  refs.current = { paused, expectedLeagueId, syncPick, syncUndo, syncInit };

  const chain = useRef<Promise<void>>(Promise.resolve());

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
  // otherwise be a dispatch ⇄ runEffect dependency cycle.
  const runEffectRef = useRef<(eff: SyncEffect) => void>(() => {});

  // ---- dispatch: reduce, then serialize effects ----

  const dispatch = useCallback((event: SyncEvent) => {
    const ctx = { expectedLeagueId: refs.current.expectedLeagueId, paused: refs.current.paused, now: Date.now() };
    const { state: next, effects } = reduce(stateRef.current, event, ctx);
    stateRef.current = next;
    setState(next);
    for (const eff of effects) {
      const run = () => runEffectRef.current(eff);
      chain.current = chain.current.then(run, run);
    }
  }, []);

  // ---- effect runners ----

  const runSyncInit = useCallback(
    async (eff: Extract<SyncEffect, { kind: "sync-init" }>) => {
      try {
        const result = await refs.current.syncInit.mutateAsync(eff.payload);
        dispatch({ type: "init-result", ok: true, front: result.espn_front, myTeamId: result.espn_team_id });
      } catch (error) {
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
    async (eff: Extract<SyncEffect, { kind: "pick" }>) => {
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
      const overall = front;
      // Reserve the number synchronously, before the await, so the next queued
      // pick sees the advance (trap T1: never let the backend pick the number).
      dispatch({ type: "pick-reserve", overall });

      const row = cachedBoard()?.rows.find((r) => r.espn_id === eff.espnPlayerId);
      const myTeamId = stateRef.current.myTeamId;
      try {
        await refs.current.syncPick.mutateAsync({
          overall_pick: overall,
          espn_player_id: eff.espnPlayerId,
          player_id: row?.player_id ?? null,
          player_name: row?.name ?? null,
          by_me: myTeamId != null && eff.teamId === myTeamId,
          source: "espn_sync",
          bid: eff.bid,
        });
        dispatch({ type: "pick-result", outcome: "inserted" });
        // Only a pick that just happened earns a toast; a late-join replay of
        // forty picks is a chip count, not forty notifications.
        if (eff.live) {
          toast.message(`${row?.name ?? `Player ${eff.espnPlayerId}`} off the board at ${overall} · ESPN`, {
            id: `espn-pick-${overall}`,
          });
        }
      } catch (error) {
        const api = toApiError(error);
        if (api.code === "DRAFT_PLAYER_ALREADY_DRAFTED") {
          dispatch({ type: "pick-result", outcome: "duplicate" });
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
          return;
        }
        dispatch({ type: "pick-result", outcome: "failed", error: userMessage(error) });
      }
    },
    [cachedSession, cachedBoard, dispatch]
  );

  const runUndo = useCallback(
    async (eff: Extract<SyncEffect, { kind: "undo" }>) => {
      try {
        await refs.current.syncUndo.mutateAsync(eff.pickNumber);
        dispatch({ type: "undo-result", ok: true });
      } catch (error) {
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

  runEffectRef.current = (eff: SyncEffect) => {
    if (eff.kind === "sync-init") void runSyncInit(eff);
    else if (eff.kind === "pick") void runPick(eff);
    else void runUndo(eff);
  };

  // ---- port lifecycle ----

  const [nonce, setNonce] = useState(0);
  const reconnect = useCallback(() => setNonce((n) => n + 1), []);
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

    let handle: PortHandle | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      dispatch({ type: "port", status: "connecting" });
      handle = connectToExtension(DRAFT_TAP_EXTENSION_ID, {
        onMessage: (msg) => {
          const parsed = parseExtensionMessage(msg);
          if (!parsed) return;
          if (parsed.type === "hello") {
            dispatch({ type: "port", status: "connected" });
          } else if (parsed.type === "replay") {
            dispatch({ type: "port", status: "connected" });
            dispatch({ type: "replay", records: parsed.records });
          } else {
            dispatch({ type: "record", record: parsed.record });
          }
        },
        onDisconnect: (reason) => {
          if (cancelled) return;
          if (reason === "not-installed") {
            dispatch({ type: "port", status: "not-installed" });
            timer = setTimeout(connect, 30_000); // they may install mid-session
          } else {
            dispatch({ type: "port", status: "disconnected" });
            timer = setTimeout(connect, backoffDelay(stateRef.current.attempt));
          }
        },
      });
      if (handle === null) dispatch({ type: "port", status: "unsupported" });
    };

    connect();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      handle?.disconnect();
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
  };
}
