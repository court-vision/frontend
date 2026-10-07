import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import {
  SCHEDULED_PICKUP_DUPLICATE,
  SCHEDULED_PICKUP_INVALID,
  SCHEDULED_PICKUP_NOT_PENDING,
  toApiError,
  userMessage,
} from "@/lib/api-error";
import { lineupKeys } from "@/hooks/useLineupEditor";
import { matchupKeys } from "@/hooks/useMatchup";
import { streamersKeys } from "@/hooks/useStreamers";
import { teamsKeys } from "@/hooks/useTeams";
import type { ScheduledPickup, ScheduledPickupList, SchedulePickupRequest } from "@/types/scheduled-pickup";

export const pickupKeys = {
  all: ["pickups"] as const,
  team: (teamId: number) => [...pickupKeys.all, teamId] as const,
};

const EMPTY: ScheduledPickupList = { pending: [], recent: [] };

/**
 * A team's scheduled pickups. While any is pending the list re-polls every
 * minute, and a pickup that settles as executed refreshes everything that
 * shows the roster: the executor changed it on ESPN.
 */
export function useScheduledPickupsQuery(teamId: number | null, opts: { enabled?: boolean } = {}) {
  const { getToken, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery<ScheduledPickupList>({
    queryKey: pickupKeys.team(teamId!),
    queryFn: ({ signal }) => apiClient.getScheduledPickups(getToken, teamId!, { signal }),
    enabled: (opts.enabled ?? true) && !!teamId && isSignedIn === true,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => ((q.state.data?.pending.length ?? 0) > 0 ? 60_000 : false),
    meta: { toast: false },
  });

  // Pending ids seen last time: one that comes back executed has changed the roster.
  const seen = useRef<Set<number> | null>(null);
  const data = query.data;
  useEffect(() => {
    if (!data || teamId == null) return;
    const before = seen.current;
    seen.current = new Set(data.pending.map((p) => p.id));
    if (!before) return;
    const ran = data.recent.filter((p) => before.has(p.id) && p.status === "executed");
    if (ran.length === 0) return;
    invalidateRoster(queryClient, teamId);
  }, [data, teamId, queryClient]);

  return { ...query, data: data ?? EMPTY };
}

function invalidateRoster(queryClient: ReturnType<typeof useQueryClient>, teamId: number) {
  queryClient.invalidateQueries({ queryKey: lineupKeys.state(teamId) });
  queryClient.invalidateQueries({ queryKey: lineupKeys.days(teamId) });
  queryClient.invalidateQueries({ queryKey: streamersKeys.team(teamId) });
  queryClient.invalidateQueries({ queryKey: teamsKeys.roster(teamId) });
  queryClient.invalidateQueries({ queryKey: matchupKeys.live(teamId) });
  queryClient.invalidateQueries({ queryKey: matchupKeys.week(teamId) });
}

/**
 * Schedule a pickup for a later ESPN day. Reports its own outcome: success as a
 * toast (the server's sentence names the first attempt); a refusal it can
 * explain (422 SCHEDULED_PICKUP_INVALID, 409 SCHEDULED_PICKUP_DUPLICATE) stays
 * on the mutation error for the dialog; anything else is a toast too.
 */
export function useSchedulePickupMutation(teamId: number) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  return useMutation<{ pickup: ScheduledPickup; message: string }, Error, SchedulePickupRequest>({
    mutationKey: ["pickups", "schedule", teamId],
    mutationFn: (body) => apiClient.schedulePickup(getToken, teamId, body),
    meta: { toast: false },
    onSuccess: ({ pickup, message }) => {
      queryClient.setQueryData<ScheduledPickupList>(pickupKeys.team(teamId), (prev) => ({
        pending: [...(prev?.pending ?? []).filter((p) => p.id !== pickup.id), pickup].sort(
          (a, b) => a.scoring_period_id - b.scoring_period_id || a.id - b.id
        ),
        recent: prev?.recent ?? [],
      }));
      toast.success(message);
    },
    onError: (error) => {
      const err = toApiError(error);
      if (err.code === SCHEDULED_PICKUP_INVALID || err.code === SCHEDULED_PICKUP_DUPLICATE) return;
      toast.error(userMessage(err));
    },
  });
}

/** Cancel a pending pickup. One that already ran refreshes the list instead. */
export function useCancelPickupMutation(teamId: number) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  return useMutation<ScheduledPickup, Error, number>({
    mutationKey: ["pickups", "cancel", teamId],
    mutationFn: (pickupId) => apiClient.cancelPickup(getToken, teamId, pickupId),
    meta: { toast: false },
    onSuccess: (pickup) => {
      queryClient.setQueryData<ScheduledPickupList>(pickupKeys.team(teamId), (prev) => ({
        pending: (prev?.pending ?? []).filter((p) => p.id !== pickup.id),
        recent: [pickup, ...(prev?.recent ?? []).filter((p) => p.id !== pickup.id)],
      }));
      toast.success(`Pickup of ${pickup.add.name} cancelled`);
    },
    onError: (error) => {
      const err = toApiError(error);
      if (err.code === SCHEDULED_PICKUP_NOT_PENDING) {
        queryClient.invalidateQueries({ queryKey: pickupKeys.team(teamId) });
        toast.info("That pickup already ran");
        return;
      }
      toast.error(userMessage(err));
    },
  });
}
