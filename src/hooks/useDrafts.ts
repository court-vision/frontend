import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";

import { apiClient } from "@/lib/api";
import type {
  DraftBoardResult,
  DraftBoardRow,
  DraftInitSync,
  DraftPick,
  DraftPickCreate,
  DraftRosterEntry,
  DraftSession,
  DraftSessionCreate,
  DraftSessionUpdate,
} from "@/types/draft";

// Query keys
export const draftKeys = {
  all: ["drafts"] as const,
  lists: () => [...draftKeys.all, "list"] as const,
  details: () => [...draftKeys.all, "detail"] as const,
  detail: (sessionId: number) => [...draftKeys.details(), sessionId] as const,
  boards: () => [...draftKeys.all, "board"] as const,
  board: (sessionId: number) => [...draftKeys.boards(), sessionId] as const,
  // The stateless board is keyed by team plus the pick sets the caller passes;
  // sorted+joined so the same picks in a different order share a cache entry.
  teamBoard: (teamId: number | null, picked: number[], mine: number[]) =>
    [
      ...draftKeys.boards(),
      "team",
      teamId,
      [...picked].sort((a, b) => a - b).join(","),
      [...mine].sort((a, b) => a - b).join(","),
    ] as const,
};

export function useDraftSessionsQuery() {
  const { getToken, isSignedIn } = useAuth();

  return useQuery<DraftSession[]>({
    queryKey: draftKeys.lists(),
    queryFn: () => apiClient.getDraftSessions(getToken),
    enabled: isSignedIn === true,
    staleTime: 1000 * 60 * 2, // 2 minutes — a room in progress changes often
  });
}

export function useDraftSessionQuery(sessionId: number | null) {
  const { getToken, isSignedIn } = useAuth();

  return useQuery<DraftSession>({
    queryKey: draftKeys.detail(sessionId!),
    queryFn: () => apiClient.getDraftSession(getToken, sessionId!),
    enabled: !!sessionId && isSignedIn === true,
    staleTime: 1000 * 30,
  });
}

/**
 * The room's board. Every pick invalidates it, so it is deliberately short-lived
 * rather than polled: the draft moves when the user says it moves.
 */
export function useDraftBoardQuery(sessionId: number | null) {
  const { getToken, isSignedIn } = useAuth();

  return useQuery<DraftBoardResult>({
    queryKey: draftKeys.board(sessionId!),
    queryFn: ({ signal }) => apiClient.getDraftBoard(getToken, sessionId!, { signal }),
    enabled: !!sessionId && isSignedIn === true,
    staleTime: 1000 * 30,
  });
}

/** The stateless big board: a pre-draft look with no session behind it. */
export function useTeamDraftBoardQuery(
  teamId: number | null,
  picked: number[] = [],
  mine: number[] = []
) {
  const { getToken, isSignedIn } = useAuth();

  return useQuery<DraftBoardResult>({
    queryKey: draftKeys.teamBoard(teamId, picked, mine),
    queryFn: ({ signal }) =>
      apiClient.getTeamDraftBoard(getToken, teamId!, picked, mine, { signal }),
    enabled: !!teamId && isSignedIn === true,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateDraftSessionMutation() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation<DraftSession, Error, DraftSessionCreate>({
    mutationKey: ["drafts", "create"],
    mutationFn: (body) => apiClient.createDraftSession(getToken, body),
    onSuccess: (session) => {
      toast.success("Draft room created");
      queryClient.setQueryData(draftKeys.detail(session.id), session);
      queryClient.invalidateQueries({ queryKey: draftKeys.lists() });
    },
    onError: (error) => {
      console.error("Create draft session error:", error);
    },
  });
}

export function useUpdateDraftSessionMutation(sessionId: number) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation<DraftSession, Error, DraftSessionUpdate>({
    mutationKey: ["drafts", "update", sessionId],
    mutationFn: (body) => apiClient.updateDraftSession(getToken, sessionId, body),
    onSuccess: (session) => {
      queryClient.setQueryData(draftKeys.detail(sessionId), session);
      queryClient.invalidateQueries({ queryKey: draftKeys.lists() });
      // my_slot and rounds change what the board recommends.
      queryClient.invalidateQueries({ queryKey: draftKeys.board(sessionId) });
    },
    onError: (error) => {
      console.error("Update draft session error:", error);
    },
  });
}

/** The roster entry a board row becomes once drafted by the caller. */
function rosterEntryOf(row: DraftBoardRow): DraftRosterEntry {
  return {
    player_id: row.player_id,
    name: row.name,
    team: row.team,
    primary_position: row.primary_position,
    positions: row.positions,
    value: row.value,
    value_source: row.value_source,
    injury_status: row.injury_status,
  };
}

/** What `onMutate` snapshots so `onError` can put the cache back exactly. */
interface PickContext {
  board: DraftBoardResult | undefined;
  session: DraftSession | undefined;
}

/**
 * Record a pick, optimistically.
 *
 * Draft day is the one place in the app where a round-trip between clicking a
 * player and seeing him leave the board is felt, so the row is removed before
 * the request lands and put back if it fails. `apiClient.addDraftPick` is
 * deliberately not a `raw: true` mutation: the route answers 409/400/422 for
 * real, so a rejected pick actually reaches `onError` and rolls back.
 */
export function useDraftPickMutation(sessionId: number, opts: { silent?: boolean } = {}) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation<DraftPick, Error, DraftPickCreate, PickContext>({
    mutationKey: ["drafts", "pick", sessionId],
    mutationFn: (body) => apiClient.addDraftPick(getToken, sessionId, body),
    // The live-sync feeder handles its own errors (a duplicate frame is a 409
    // it treats as success) and reports them in the sync chip, so it opts out
    // of the global mutation-error toast.
    meta: opts.silent ? { toast: false } : undefined,

    onMutate: async (pick) => {
      const boardKey = draftKeys.board(sessionId);
      const sessionKey = draftKeys.detail(sessionId);
      // Both, or an in-flight refetch lands on top of the optimistic state.
      await queryClient.cancelQueries({ queryKey: boardKey });
      await queryClient.cancelQueries({ queryKey: sessionKey });

      const board = queryClient.getQueryData<DraftBoardResult>(boardKey);
      const session = queryClient.getQueryData<DraftSession>(sessionKey);

      if (board && pick.player_id != null) {
        const drafted = board.rows.find((row) => row.player_id === pick.player_id);
        const rows = board.rows.filter((row) => row.player_id !== pick.player_id);
        // A pick of mine lands on the roster at once — the lineup slots and
        // cap counts are read from it — provided the row is known here.
        const roster =
          pick.by_me && drafted && !board.roster.some((r) => r.player_id === drafted.player_id)
            ? [...board.roster, rosterEntryOf(drafted)]
            : board.roster;
        queryClient.setQueryData<DraftBoardResult>(boardKey, {
          ...board,
          rows,
          // Recommendations are re-ranked server-side; dropping the drafted
          // player is the honest half of that we can do here.
          recommendations: board.recommendations.filter(
            (rec) => rec.player_id !== pick.player_id
          ),
          roster,
          meta: board.meta ? { ...board.meta, available: rows.length } : board.meta,
        });
      }

      if (session) {
        const overall = pick.overall_pick ?? session.next_overall_pick;
        const optimistic: DraftPick = {
          overall_pick: overall,
          round: null,
          slot: null,
          player_id: pick.player_id ?? null,
          espn_player_id: pick.espn_player_id ?? null,
          player_name: pick.player_name ?? null,
          // Only ESPN can say which team made a pick; an optimistic row has no
          // answer until the server replies with one.
          espn_team_id: pick.espn_team_id ?? null,
          by_me: pick.by_me ?? false,
          source: pick.source ?? "manual",
          bid: pick.bid ?? null,
          created_at: null,
        };
        queryClient.setQueryData<DraftSession>(sessionKey, {
          ...session,
          pick_count: session.pick_count + 1,
          next_overall_pick: Math.max(session.next_overall_pick, overall + 1),
          picks: [...session.picks.filter((p) => p.overall_pick !== overall), optimistic],
        });
      }

      return { board, session };
    },

    onError: (error, _pick, context) => {
      console.error("Add draft pick error:", error);
      // A snapshot of `undefined` means nothing was cached — leave it alone
      // rather than writing undefined over a query that has since loaded.
      if (context?.board !== undefined) {
        queryClient.setQueryData(draftKeys.board(sessionId), context.board);
      }
      if (context?.session !== undefined) {
        queryClient.setQueryData(draftKeys.detail(sessionId), context.session);
      }
    },

    // In onSettled, not onSuccess: a rolled-back cache still has to be
    // reconciled with the server.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: draftKeys.board(sessionId) });
      queryClient.invalidateQueries({ queryKey: draftKeys.detail(sessionId) });
      queryClient.invalidateQueries({ queryKey: draftKeys.lists() });
    },
  });
}

/**
 * Reconcile a session with an ESPN INIT snapshot. Silent (the sync chip reports
 * results, not a toast); the reconciled session comes back on the response, so
 * it is written straight into the cache and the board is invalidated.
 */
export function useDraftInitSyncMutation(sessionId: number) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation<DraftInitSync, Error, string>({
    mutationKey: ["drafts", "sync-init", sessionId],
    mutationFn: (payload) => apiClient.syncDraftInit(getToken, sessionId, payload),
    meta: { toast: false },
    onSuccess: (result) => {
      queryClient.setQueryData(draftKeys.detail(sessionId), result.session);
      queryClient.invalidateQueries({ queryKey: draftKeys.board(sessionId) });
      queryClient.invalidateQueries({ queryKey: draftKeys.lists() });
    },
    onError: (error) => {
      console.error("Draft INIT sync error:", error);
    },
  });
}

/**
 * Undo a pick. Never `removeQueries` — the board row has to come *back*, so the
 * board is invalidated and refetched.
 */
export function useUndoDraftPickMutation(sessionId: number, opts: { silent?: boolean } = {}) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation<number, Error, number>({
    mutationKey: ["drafts", "undo-pick", sessionId],
    mutationFn: (overallPick) => apiClient.deleteDraftPick(getToken, sessionId, overallPick),
    // Silent for the live feeder: an ESPN undo it mirrors should not toast, and
    // a 404 (already gone) is success it swallows.
    meta: opts.silent ? { toast: false } : undefined,
    onSuccess: (overallPick) => {
      if (!opts.silent) toast.success(`Pick ${overallPick} undone`);
      queryClient.invalidateQueries({ queryKey: draftKeys.board(sessionId) });
      queryClient.invalidateQueries({ queryKey: draftKeys.detail(sessionId) });
      queryClient.invalidateQueries({ queryKey: draftKeys.lists() });
    },
    onError: (error) => {
      console.error("Undo draft pick error:", error);
    },
  });
}
