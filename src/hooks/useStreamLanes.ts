import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { STREAM_LANE_EXISTS, STREAM_LANE_INVALID, toApiError, userMessage } from "@/lib/api-error";
import { pickupKeys } from "@/hooks/useScheduledPickups";
import type { StreamLane, StreamLaneList, StreamLaneStartRequest, StreamLaneUpdateRequest } from "@/types/stream-lane";

export const laneKeys = {
  all: ["streamLanes"] as const,
  team: (teamId: number) => [...laneKeys.all, teamId] as const,
};

const EMPTY: StreamLaneList = { open: [], recent: [] };

/**
 * A team's stream lanes. While one is active the list re-polls every minute:
 * the server decides before each day's games, and a decision that switches
 * schedules a pickup, so a new decision re-reads the pickups too.
 */
export function useStreamLanesQuery(teamId: number | null) {
  const { getToken, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery<StreamLaneList>({
    queryKey: laneKeys.team(teamId!),
    queryFn: ({ signal }) => apiClient.getStreamLanes(getToken, teamId!, { signal }),
    enabled: !!teamId && isSignedIn === true,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => (q.state.data?.open.some((l) => l.status === "active") ? 60_000 : false),
    meta: { toast: false },
  });

  // The newest event seen last time: a newer one is a decision, which may have scheduled a pickup.
  const lastEvent = useRef<number | null>(null);
  const data = query.data;
  useEffect(() => {
    if (!data || teamId == null) return;
    const newest = Math.max(0, ...data.open.flatMap((l) => l.events.map((e) => e.id)));
    const before = lastEvent.current;
    lastEvent.current = newest;
    if (before != null && newest > before) queryClient.invalidateQueries({ queryKey: pickupKeys.team(teamId) });
  }, [data, teamId, queryClient]);

  return { ...query, data: data ?? EMPTY };
}

function putLane(prev: StreamLaneList | undefined, lane: StreamLane): StreamLaneList {
  const others = (list: StreamLane[] | undefined) => (list ?? []).filter((l) => l.id !== lane.id);
  return lane.status === "ended"
    ? { open: others(prev?.open), recent: [lane, ...others(prev?.recent)] }
    : { open: [lane, ...others(prev?.open)], recent: others(prev?.recent) };
}

/**
 * Start a lane. A refusal it can explain (422 STREAM_LANE_INVALID, 409
 * STREAM_LANE_EXISTS) stays on the mutation for the sheet; anything else is a toast.
 */
export function useStartStreamLaneMutation(teamId: number) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  return useMutation<{ lane: StreamLane; message: string }, Error, StreamLaneStartRequest>({
    mutationKey: ["streamLanes", "start", teamId],
    mutationFn: (body) => apiClient.startStreamLane(getToken, teamId, body),
    meta: { toast: false },
    onSuccess: ({ lane, message }) => {
      queryClient.setQueryData<StreamLaneList>(laneKeys.team(teamId), (prev) => putLane(prev, lane));
      toast.success(message);
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: laneKeys.team(teamId) });
      const err = toApiError(error);
      if (err.code === STREAM_LANE_INVALID || err.code === STREAM_LANE_EXISTS) return;
      toast.error(userMessage(err));
    },
  });
}

/** Pause, resume or change the notify mode; refusals are toasts (the lane row has no form). */
export function useUpdateStreamLaneMutation(teamId: number) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  return useMutation<{ lane: StreamLane; message: string }, Error, { laneId: number; body: StreamLaneUpdateRequest }>({
    mutationKey: ["streamLanes", "update", teamId],
    mutationFn: ({ laneId, body }) => apiClient.updateStreamLane(getToken, teamId, laneId, body),
    meta: { toast: false },
    onSuccess: ({ lane, message }) => {
      queryClient.setQueryData<StreamLaneList>(laneKeys.team(teamId), (prev) => putLane(prev, lane));
      toast.success(message);
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: laneKeys.team(teamId) });
      toast.error(userMessage(error));
    },
  });
}

/** Stop a lane; its pending pickup is cancelled with it, so the pickups are read again. */
export function useStopStreamLaneMutation(teamId: number) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  return useMutation<{ lane: StreamLane; message: string }, Error, number>({
    mutationKey: ["streamLanes", "stop", teamId],
    mutationFn: (laneId) => apiClient.stopStreamLane(getToken, teamId, laneId),
    meta: { toast: false },
    onSuccess: ({ lane, message }) => {
      queryClient.setQueryData<StreamLaneList>(laneKeys.team(teamId), (prev) => putLane(prev, lane));
      queryClient.invalidateQueries({ queryKey: pickupKeys.team(teamId) });
      toast.success(message);
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: laneKeys.team(teamId) });
      toast.error(userMessage(error));
    },
  });
}
