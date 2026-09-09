"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  useApplyLineupMovesMutation,
  useLineupPlanQuery,
  useTeamLineupQuery,
} from "@/hooks/useLineupEditor";
import { useRosterTransactionMutation } from "@/hooks/useRosterTransaction";
import { ROSTER_MOVE_INVALID, toApiError, type ApiError } from "@/lib/api-error";
import {
  assignment as computeAssignment,
  diff,
  eligibleTargets,
  planToStaged,
  playerIndex,
  slotRows,
  stage as stageMove,
  staleLineup,
  unstage as unstageMove,
  validateStaged,
  type SlotRow,
  type Staged,
} from "@/lib/lineup-editor";
import type { FantasyProvider } from "@/types/team";
import type {
  LineupMove,
  LineupPlanData,
  LineupPlayer,
  LineupState,
  MoveError,
  WriteBlockedReason,
} from "@/types/lineup-editor";

export type PlanStatus = "idle" | "loading" | "loaded" | "error";

/** Dev-only: a fixture board, the plan the server would answer, and a fake write. */
export interface LineupEditorMock {
  state: LineupState;
  plan: LineupPlanData;
  /** The board as the server would re-read it after the staged moves. */
  apply: (state: LineupState, staged: Staged) => LineupState;
}

export interface LineupEditorContextValue {
  teamId: number;
  /** `undefined` while loading, `null` when the team has no ESPN board (Yahoo). */
  state: LineupState | null | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;

  staged: Staged;
  rows: SlotRow[];
  assignment: Map<number, number>;
  playerById: Map<number, LineupPlayer>;

  selectedPlayerId: number | null;
  /** Slots the selected player may move to (empty when nothing is selected). */
  selectedTargets: number[];
  select: (playerId: number | null) => void;
  /** Stage a move (or swap) for `playerId`; true when the board changed. Clears the selection. */
  stage: (playerId: number, slotId: number) => boolean;
  unstage: (playerId: number) => void;
  reset: () => void;
  eligibleTargetsFor: (playerId: number) => number[];
  /**
   * Tap policy shared by every board: nothing selected → select the tapped
   * player; the selected player again → deselect; an eligible slot → stage;
   * another movable player → switch the selection to him.
   */
  tap: (slotId: number, playerId: number | null) => void;

  moves: LineupMove[];
  /** Client-side mirror of the server's move checks. */
  validation: MoveError[];
  /** The server's 422 `ROSTER_MOVE_INVALID` errors for the last apply attempt. */
  moveErrors: MoveError[];

  loadPlan: () => Promise<void>;
  planStatus: PlanStatus;
  plan: LineupPlanData | null;
  planError: Error | null;

  apply: () => Promise<void>;
  applying: boolean;
  applyError: ApiError | null;
  confirmOpen: boolean;
  setConfirmOpen: (open: boolean) => void;

  canWrite: boolean;
  blockedReason: WriteBlockedReason | null;
  isMock: boolean;

  /**
   * Dropping a player outright is its own ESPN transaction, separate from the
   * staged lineup moves: the board's Drop row asks for the selected player,
   * a confirm sends it, and the re-read board that comes back drops any
   * staging (its roster_version changes).
   */
  /** The selected player, once the Drop row was tapped; null = no confirm pending. */
  dropTargetId: number | null;
  /** Tap the Drop row: asks to release the selected player (no-op without a selection). */
  requestDrop: () => void;
  cancelDrop: () => void;
  confirmDrop: () => Promise<void>;
  dropping: boolean;
  /** The last drop attempt's failure, for the confirm dialog to explain inline. */
  dropError: ApiError | null;
}

const LineupEditorContext = createContext<LineupEditorContextValue | null>(null);

/** The editor for the enclosing team, or null outside a provider (Yahoo, no team). */
export function useLineupEditor(): LineupEditorContextValue | null {
  return useContext(LineupEditorContext);
}

interface StagingStore {
  /** `roster_version` the staging belongs to; a fresh board drops it wholesale. */
  version: string | null;
  staged: Staged;
  selected: number | null;
}

const EMPTY_STORE: StagingStore = { version: null, staged: {}, selected: null };
const NO_TARGETS: number[] = [];

interface PlanStore {
  status: PlanStatus;
  plan: LineupPlanData | null;
  error: Error | null;
}

const PLAN_IDLE: PlanStore = { status: "idle", plan: null, error: null };

interface LineupEditorProviderProps {
  teamId: number;
  mock?: LineupEditorMock;
  children: ReactNode;
}

export function LineupEditorProvider({ teamId, mock, children }: LineupEditorProviderProps) {
  const query = useTeamLineupQuery(teamId, "espn", { enabled: !mock });
  const planQuery = useLineupPlanQuery(teamId, { enabled: false });
  const mutation = useApplyLineupMovesMutation(teamId);
  const dropMutation = useRosterTransactionMutation(teamId);

  // Mock boards live here so a fake "apply" can advance the roster_version.
  const [mockState, setMockState] = useState<LineupState | undefined>(mock?.state);
  const state: LineupState | null | undefined = mock ? mockState : query.data;

  const [store, setStore] = useState<StagingStore>(EMPTY_STORE);
  const [planStore, setPlanStore] = useState<PlanStore>(PLAN_IDLE);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);

  const version = state?.roster_version ?? null;
  const live = store.version === version && version !== null;
  const staged = live ? store.staged : EMPTY_STORE.staged;
  const selectedPlayerId = live ? store.selected : null;

  const playerById = useMemo(() => (state ? playerIndex(state) : new Map<number, LineupPlayer>()), [state]);
  const assignment = useMemo(
    () => (state ? computeAssignment(state, staged) : new Map<number, number>()),
    [state, staged]
  );
  const rows = useMemo(() => (state ? slotRows(state, staged) : []), [state, staged]);
  const moves = useMemo(() => (state ? diff(state, staged) : []), [state, staged]);
  const validation = useMemo(() => (state ? validateStaged(state, staged) : []), [state, staged]);
  const selectedTargets = useMemo(
    () => (state && selectedPlayerId != null ? eligibleTargets(state, staged, selectedPlayerId) : NO_TARGETS),
    [state, staged, selectedPlayerId]
  );

  const resetMutation = mutation.reset;
  const write = useCallback(
    (update: (prev: { staged: Staged; selected: number | null }) => { staged: Staged; selected: number | null }) => {
      if (!version) return;
      setStore((prev) => {
        const current = prev.version === version ? prev : { version, staged: {}, selected: null };
        const next = update({ staged: current.staged, selected: current.selected });
        return { version, ...next };
      });
      // A new staging invalidates the last apply attempt's per-row errors.
      resetMutation();
    },
    [version, resetMutation]
  );

  const select = useCallback(
    (playerId: number | null) => write((prev) => ({ ...prev, selected: playerId })),
    [write]
  );

  const stage = useCallback(
    (playerId: number, slotId: number): boolean => {
      if (!state) return false;
      const next = stageMove(state, staged, playerId, slotId);
      if (next === staged) return false;
      write(() => ({ staged: next, selected: null }));
      return true;
    },
    [state, staged, write]
  );

  const unstage = useCallback(
    (playerId: number) => {
      if (!state) return;
      write((prev) => ({ ...prev, staged: unstageMove(state, prev.staged, playerId) }));
    },
    [state, write]
  );

  const reset = useCallback(() => {
    write(() => ({ staged: {}, selected: null }));
    setPlanStore(PLAN_IDLE);
  }, [write]);

  const eligibleTargetsFor = useCallback(
    (playerId: number) => (state ? eligibleTargets(state, staged, playerId) : NO_TARGETS),
    [state, staged]
  );

  const tap = useCallback(
    (slotId: number, playerId: number | null) => {
      if (!state) return;
      const tapped = playerId != null ? playerById.get(playerId) : undefined;
      const movable = !!tapped && !tapped.locked;
      if (selectedPlayerId == null) {
        if (movable) select(playerId);
        return;
      }
      if (playerId === selectedPlayerId) {
        select(null);
        return;
      }
      if (selectedTargets.includes(slotId)) {
        stage(selectedPlayerId, slotId);
        return;
      }
      select(movable ? playerId : null);
    },
    [state, playerById, selectedPlayerId, selectedTargets, select, stage]
  );

  // Escape cancels a pending selection on either page.
  useEffect(() => {
    if (selectedPlayerId == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedPlayerId, select]);

  const planRefetch = planQuery.refetch;
  const loadPlan = useCallback(async () => {
    if (!state) return;
    setPlanStore({ status: "loading", plan: null, error: null });
    let plan: LineupPlanData | null = null;
    if (mock) {
      plan = mock.plan;
    } else {
      const result = await planRefetch();
      if (result.error || !result.data) {
        setPlanStore({
          status: "error",
          plan: null,
          error: result.error ?? new Error("No plan returned"),
        });
        return;
      }
      plan = result.data;
    }
    write(() => ({ staged: planToStaged(state, plan), selected: null }));
    setPlanStore({ status: "loaded", plan, error: null });
  }, [state, mock, planRefetch, write]);

  const mutateAsync = mutation.mutateAsync;
  const apply = useCallback(async () => {
    if (!state || moves.length === 0) return;
    if (mock) {
      setMockState(mock.apply(state, staged));
      setPlanStore(PLAN_IDLE);
      setConfirmOpen(false);
      toast.success("Lineup updated on ESPN (mock)");
      return;
    }
    if (state.scoring_period_id == null) return;
    try {
      await mutateAsync({
        moves,
        expected_scoring_period_id: state.scoring_period_id,
        roster_version: state.roster_version,
      });
      setPlanStore(PLAN_IDLE);
      setConfirmOpen(false);
    } catch (err) {
      // The mutation's onError already toasted / swapped in the fresh board.
      // A stale board has dropped the staging, so there is nothing left to confirm.
      if (staleLineup(err)) setConfirmOpen(false);
    }
  }, [state, moves, staged, mock, mutateAsync]);

  // ---- drop a player outright (its own transaction, not a staged move) ----
  const resetDrop = dropMutation.reset;
  const requestDrop = useCallback(() => {
    if (selectedPlayerId == null) return;
    const player = playerById.get(selectedPlayerId);
    if (!player || player.locked) return;
    resetDrop();
    setDropTargetId(selectedPlayerId);
  }, [selectedPlayerId, playerById, resetDrop]);

  const cancelDrop = useCallback(() => setDropTargetId(null), []);

  const dropMutateAsync = dropMutation.mutateAsync;
  const confirmDrop = useCallback(async () => {
    if (!state || dropTargetId == null) return;
    const player = playerById.get(dropTargetId);
    if (mock) {
      setMockState({
        ...state,
        players: state.players.filter((p) => p.player_id !== dropTargetId),
        roster_version: `${state.roster_version}:drop:${dropTargetId}`,
      });
      setPlanStore(PLAN_IDLE);
      setDropTargetId(null);
      toast.success(`Dropped ${player?.name ?? "player"} on ESPN (mock)`);
      return;
    }
    if (state.scoring_period_id == null) return;
    try {
      await dropMutateAsync({
        add_player_id: null,
        drop_player_id: dropTargetId,
        expected_scoring_period_id: state.scoring_period_id,
        roster_version: state.roster_version,
      });
      // The re-read board replaces the cached one; its new roster_version
      // clears the staging and the selection on its own.
      setPlanStore(PLAN_IDLE);
      setDropTargetId(null);
    } catch (err) {
      // The mutation's onError already toasted / swapped in the fresh board;
      // a refusal it left on the error is rendered by the dialog.
      if (staleLineup(err)) setDropTargetId(null);
    }
  }, [state, dropTargetId, playerById, mock, dropMutateAsync]);

  const dropError = dropMutation.error ? toApiError(dropMutation.error) : null;

  const applyError = mutation.error ? toApiError(mutation.error) : null;
  const moveErrors = useMemo<MoveError[]>(() => {
    if (!applyError || applyError.code !== ROSTER_MOVE_INVALID) return [];
    const data = applyError.data as { errors?: unknown } | null;
    return Array.isArray(data?.errors) ? (data.errors as MoveError[]) : [];
  }, [applyError]);

  const value = useMemo<LineupEditorContextValue>(
    () => ({
      teamId,
      state,
      isLoading: mock ? false : query.isLoading,
      error: mock ? null : (query.error ?? null),
      refetch: () => {
        if (!mock) void query.refetch();
      },
      staged,
      rows,
      assignment,
      playerById,
      selectedPlayerId,
      selectedTargets,
      select,
      stage,
      unstage,
      reset,
      eligibleTargetsFor,
      tap,
      moves,
      validation,
      moveErrors,
      loadPlan,
      planStatus: planStore.status,
      plan: planStore.plan,
      planError: planStore.error,
      apply,
      applying: mutation.isPending,
      applyError,
      confirmOpen,
      setConfirmOpen,
      canWrite: !!state?.can_write,
      blockedReason: (state?.write_blocked_reason ?? null) as WriteBlockedReason | null,
      isMock: !!mock,
      dropTargetId,
      requestDrop,
      cancelDrop,
      confirmDrop,
      dropping: dropMutation.isPending,
      dropError,
    }),
    [
      teamId, state, mock, query, staged, rows, assignment, playerById, selectedPlayerId,
      selectedTargets, select, stage, unstage, reset, eligibleTargetsFor, tap, moves,
      validation, moveErrors, loadPlan, planStore, apply, mutation.isPending, applyError,
      confirmOpen, dropTargetId, requestDrop, cancelDrop, confirmDrop, dropMutation.isPending,
      dropError,
    ]
  );

  return <LineupEditorContext.Provider value={value}>{children}</LineupEditorContext.Provider>;
}

interface LineupEditorProviderIfEspnProps {
  teamId: number | null;
  provider: FantasyProvider | null | undefined;
  mock?: LineupEditorMock;
  children: ReactNode;
}

/** Only ESPN teams have an editable board; everyone else renders without a context. */
export function LineupEditorProviderIfEspn({
  teamId,
  provider,
  mock,
  children,
}: LineupEditorProviderIfEspnProps) {
  if (provider !== "espn" || teamId == null) return <>{children}</>;
  return (
    <LineupEditorProvider teamId={teamId} mock={mock}>
      {children}
    </LineupEditorProvider>
  );
}
