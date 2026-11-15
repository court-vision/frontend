import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { userMessage } from "@/lib/api-error";
import { lineupKeys } from "@/hooks/useLineupEditor";
import { pickupKeys } from "@/hooks/useScheduledPickups";
import { laneKeys } from "@/hooks/useStreamLanes";
import type { RosterProtections } from "@/types/roster-protection";

export const protectionKeys = {
  all: ["rosterProtections"] as const,
  team: (teamId: number) => [...protectionKeys.all, teamId] as const,
};

const EMPTY: RosterProtections = { players: [], cancelled: [], not_cancelled: [] };

/**
 * The team's protected players (the roster lock): never dropped, or suggested
 * as a drop, by Court Vision until the user unprotects them. Only the user sets
 * or clears one, from this desk, so the list is read when the desk opens and on
 * focus, not polled.
 */
export function useRosterProtectionsQuery(teamId: number | null): { data: RosterProtections } {
  const { getToken, isSignedIn } = useAuth();
  const query = useQuery<RosterProtections>({
    queryKey: protectionKeys.team(teamId!),
    queryFn: ({ signal }) => apiClient.getProtections(getToken, teamId!, { signal }),
    enabled: !!teamId && isSignedIn === true,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    meta: { toast: false },
  });
  return { data: query.data ?? EMPTY };
}

/**
 * Protect or unprotect a player. The answer is the list then, and a toast says
 * what protecting cancelled (the pickups that dropped him, the lanes on his
 * spot), so those lists and today's moves (whose swap may have dropped him) are
 * read again.
 */
export function useSetProtectionMutation(teamId: number) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  return useMutation<{ protections: RosterProtections; message: string }, Error, { playerId: number; on: boolean }>({
    mutationKey: ["rosterProtections", "set", teamId],
    mutationFn: ({ playerId, on }) => apiClient.setProtection(getToken, teamId, playerId, on),
    meta: { toast: false },
    onSuccess: async ({ protections, message }, { on }) => {
      // A read still out (a focus refetch) holds the list from before: it must not land over this one.
      await queryClient.cancelQueries({ queryKey: protectionKeys.team(teamId) });
      queryClient.setQueryData(protectionKeys.team(teamId), { ...protections, cancelled: [], not_cancelled: [] });
      toast.success(message);
      if (on) {
        void queryClient.invalidateQueries({ queryKey: pickupKeys.team(teamId) });
        void queryClient.invalidateQueries({ queryKey: laneKeys.team(teamId) });
      }
      void queryClient.invalidateQueries({ queryKey: lineupKeys.actions(teamId) });
    },
    onError: (err, { on }) => {
      toast.error(userMessage(err, on ? "Couldn't protect him" : "Couldn't unprotect him"));
      void queryClient.invalidateQueries({ queryKey: protectionKeys.team(teamId) });
    },
  });
}
