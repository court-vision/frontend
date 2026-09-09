import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import {
  ROSTER_TRANSACTION_INVALID,
  ROSTER_WRITE_REJECTED,
  toApiError,
  userMessage,
} from "@/lib/api-error";
import { staleLineup } from "@/lib/lineup-editor";
import { STALE_POOL_REASONS, transactionError, transactionOutcomeCopy } from "@/lib/roster-transaction";
import { lineupKeys } from "@/hooks/useLineupEditor";
import { matchupKeys } from "@/hooks/useMatchup";
import { streamersKeys } from "@/hooks/useStreamers";
import { teamsKeys } from "@/hooks/useTeams";
import type { LineupState } from "@/types/lineup-editor";
import type { RosterTransactionData, RosterTransactionRequest } from "@/types/roster-transaction";

/**
 * Add and/or drop one player on ESPN. Mirrors `useApplyLineupMovesMutation`
 * and reports its own outcome (`meta.toast: false`): success and "sent but
 * not confirmed" as toasts; a stale board (409 ROSTER_STALE) replaces the
 * cached board with the fresh one the server hands back; a refusal the
 * dialog can explain (422 ROSTER_TRANSACTION_INVALID, 409
 * ROSTER_WRITE_REJECTED) stays on the mutation error for it to render
 * inline; anything else is a toast.
 *
 * On success the re-read board replaces the cached one, and everything that
 * lists the roster — insights, roster, matchups, the streamer pool this
 * player just left — is invalidated.
 */
export function useRosterTransactionMutation(teamId: number) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation<RosterTransactionData, Error, RosterTransactionRequest>({
    mutationKey: ["roster", "transaction", teamId],
    mutationFn: (body) => apiClient.applyRosterTransaction(getToken, teamId, body),
    meta: { toast: false },

    onSuccess: (data) => {
      queryClient.setQueryData<LineupState | null>(lineupKeys.state(teamId), data.lineup);
      queryClient.removeQueries({ queryKey: lineupKeys.plan(teamId) });
      queryClient.invalidateQueries({ queryKey: streamersKeys.team(teamId) });
      // Everything that renders the roster is now out of date.
      queryClient.invalidateQueries({ queryKey: teamsKeys.insights(teamId) });
      queryClient.invalidateQueries({ queryKey: teamsKeys.roster(teamId) });
      queryClient.invalidateQueries({ queryKey: [...matchupKeys.details(), teamId] });
      queryClient.invalidateQueries({ queryKey: matchupKeys.live(teamId) });
      queryClient.invalidateQueries({ queryKey: matchupKeys.week(teamId) });
      queryClient.invalidateQueries({ queryKey: [...matchupKeys.all, "daily", teamId] });
      const { tone, message } = transactionOutcomeCopy(data);
      if (tone === "success") toast.success(message);
      else toast.warning(message);
    },

    onError: (error) => {
      const err = toApiError(error);
      const fresh = staleLineup(err);
      if (fresh) {
        queryClient.setQueryData<LineupState | null>(lineupKeys.state(teamId), fresh);
        toast.info("Your roster changed on ESPN — review the refreshed board");
        return;
      }
      if (err.code === ROSTER_TRANSACTION_INVALID) {
        // Rendered inline by the dialog. A player who is no longer a free
        // agent means the streamer list is out of date too.
        const reason = transactionError(err)?.reason;
        if (reason && STALE_POOL_REASONS.has(reason)) {
          queryClient.invalidateQueries({ queryKey: streamersKeys.team(teamId) });
        }
        return;
      }
      if (err.code === ROSTER_WRITE_REJECTED) return; // ESPN's sentence, rendered inline
      console.error("Roster transaction error:", error);
      toast.error(userMessage(err));
    },
  });
}
