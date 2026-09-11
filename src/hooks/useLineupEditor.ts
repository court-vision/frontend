import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { ROSTER_MOVE_INVALID, toApiError, userMessage } from "@/lib/api-error";
import { staleLineup } from "@/lib/lineup-editor";
import { matchupKeys } from "@/hooks/useMatchup";
import { teamsKeys } from "@/hooks/useTeams";
import type { FantasyProvider } from "@/types/team";
import type {
  ApplyLineupMovesData,
  ApplyLineupMovesRequest,
  LineupState,
} from "@/types/lineup-editor";

// Query keys
export const lineupKeys = {
  all: ["lineup"] as const,
  state: (teamId: number) => [...lineupKeys.all, "state", teamId] as const,
  plan: (teamId: number) => [...lineupKeys.all, "plan", teamId] as const,
  /** Today's recommended actions (the home widget); lives in the lineup family so a write invalidates it here. */
  actions: (teamId: number) => [...lineupKeys.all, "actions", teamId] as const,
};

/**
 * Today's ESPN board for a team. Only ESPN teams have one (Yahoo answers
 * `null`), so the query is off for every other provider. While the board is
 * writable it re-polls every minute: tip-offs lock players as the evening goes.
 */
export function useTeamLineupQuery(
  teamId: number | null,
  provider: FantasyProvider | null | undefined,
  opts: { enabled?: boolean } = {}
) {
  const { getToken, isSignedIn } = useAuth();

  return useQuery<LineupState | null>({
    queryKey: lineupKeys.state(teamId!),
    queryFn: ({ signal }) => apiClient.getTeamLineup(getToken, teamId!, { signal }),
    enabled: (opts.enabled ?? true) && !!teamId && isSignedIn === true && provider === "espn",
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.data?.can_write ? 60_000 : false),
  });
}

/** The fill-only plan. Fetched on demand: enable it, or call `refetch`. */
export function useLineupPlanQuery(teamId: number | null, opts: { enabled?: boolean } = {}) {
  const { getToken, isSignedIn } = useAuth();

  return useQuery({
    queryKey: lineupKeys.plan(teamId!),
    queryFn: ({ signal }) => apiClient.getTeamLineupPlan(getToken, teamId!, { signal }),
    enabled: (opts.enabled ?? false) && !!teamId && isSignedIn === true,
    staleTime: 0,
    gcTime: 60_000,
    // The apply bar shows the plan's own failure inline.
    meta: { toast: false },
  });
}

/**
 * Send staged moves to ESPN. Reports its own outcome (`meta.toast: false`):
 * success and "sent but not confirmed" as toasts; a stale board (409
 * ROSTER_STALE) replaces the cached board with the fresh one the server hands
 * back; invalid moves (422 ROSTER_MOVE_INVALID) stay on the mutation error
 * for the apply bar to render per row; anything else is a toast.
 */
export function useApplyLineupMovesMutation(teamId: number) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation<ApplyLineupMovesData, Error, ApplyLineupMovesRequest>({
    mutationKey: ["lineup", "apply", teamId],
    mutationFn: (body) => apiClient.applyLineupMoves(getToken, teamId, body),
    meta: { toast: false },

    onSuccess: (data) => {
      queryClient.setQueryData<LineupState | null>(lineupKeys.state(teamId), data.lineup);
      queryClient.removeQueries({ queryKey: lineupKeys.plan(teamId) });
      queryClient.invalidateQueries({ queryKey: lineupKeys.actions(teamId) });
      // Everything that renders the roster by slot is now out of date.
      queryClient.invalidateQueries({ queryKey: teamsKeys.insights(teamId) });
      queryClient.invalidateQueries({ queryKey: teamsKeys.roster(teamId) });
      queryClient.invalidateQueries({ queryKey: [...matchupKeys.details(), teamId] });
      queryClient.invalidateQueries({ queryKey: matchupKeys.live(teamId) });
      queryClient.invalidateQueries({ queryKey: matchupKeys.week(teamId) });
      queryClient.invalidateQueries({ queryKey: [...matchupKeys.all, "daily", teamId] });
      if (data.verified) {
        toast.success("Lineup updated on ESPN");
      } else {
        toast.warning("Sent to ESPN — not confirmed yet, check your roster");
      }
    },

    onError: (error) => {
      const err = toApiError(error);
      const fresh = staleLineup(err);
      if (fresh) {
        queryClient.setQueryData<LineupState | null>(lineupKeys.state(teamId), fresh);
        toast.info("Your lineup changed — review the refreshed roster");
        return;
      }
      if (err.code === ROSTER_MOVE_INVALID) return; // rendered inline by the apply bar
      console.error("Apply lineup moves error:", error);
      toast.error(userMessage(err));
    },
  });
}
