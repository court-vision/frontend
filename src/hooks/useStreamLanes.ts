import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { STREAM_LANE_EXISTS, STREAM_LANE_INVALID, STREAM_LANE_LIMIT, toApiError, userMessage } from "@/lib/api-error";
import { invalidateRoster, pickupKeys } from "@/hooks/useScheduledPickups";
import { laneMarks, laneMovedRoster, type LaneMarks } from "@/lib/lanes";
import type { StreamLane, StreamLaneList, StreamLaneStartRequest, StreamLaneUpdateRequest } from "@/types/stream-lane";

export const laneKeys = {
  all: ["streamLanes"] as const,
  team: (teamId: number) => [...laneKeys.all, teamId] as const,
};

const EMPTY: StreamLaneList = { open: [], recent: [] };

/**
 * A team's stream lanes (up to four open, oldest first). While one is active
 * the list re-polls every minute: the server decides before each day's games,
 * and a decision that switches schedules a pickup, so a new decision re-reads
 * the pickups too. A pickup a lane made refreshes everything that shows the
 * roster.
 */
export function useStreamLanesQuery(teamId: number | null): { data: StreamLaneList } {
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

  // The last read, and whose: the hook outlives a team switch, and a first read compares with nothing.
  const last = useRef<{ team: number; marks: LaneMarks } | null>(null);
  const data = query.data;
  useEffect(() => {
    if (!data || teamId == null) return;
    const marks = laneMarks(data);
    const before = last.current?.team === teamId ? last.current.marks : null;
    last.current = { team: teamId, marks };
    if (!before) return;
    // A newer event is a decision, which may have scheduled a pickup.
    if (marks.newest > before.newest) queryClient.invalidateQueries({ queryKey: pickupKeys.team(teamId) });
    // The run that decides also makes the pickup, so the pickups list may never have seen it pending.
    if (laneMovedRoster(before, marks)) invalidateRoster(queryClient, teamId);
  }, [data, teamId, queryClient]);

  // Only the list: spreading the query would subscribe the desk to every fetch's status flips.
  return { data: data ?? EMPTY };
}

/** The list with this lane's latest: an open lane keeps its place (a new one goes last, as the server orders them). */
function putLane(prev: StreamLaneList | undefined, lane: StreamLane): StreamLaneList {
  const others = (list: StreamLane[] | undefined) => (list ?? []).filter((l) => l.id !== lane.id);
  if (lane.status === "ended") return { open: others(prev?.open), recent: [lane, ...others(prev?.recent)] };
  const open = prev?.open ?? [];
  return {
    open: open.some((l) => l.id === lane.id) ? open.map((l) => (l.id === lane.id ? lane : l)) : [...open, lane],
    recent: others(prev?.recent),
  };
}

/**
 * Start a lane. A refusal it can explain (422 STREAM_LANE_INVALID, 409
 * STREAM_LANE_EXISTS or STREAM_LANE_LIMIT) stays on the mutation for the sheet;
 * anything else is a toast. The lanes it was planned with have new projections,
 * so the list is read again.
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
      queryClient.invalidateQueries({ queryKey: laneKeys.team(teamId) });
      toast.success(message);
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: laneKeys.team(teamId) });
      const err = toApiError(error);
      if (err.code === STREAM_LANE_INVALID || err.code === STREAM_LANE_EXISTS || err.code === STREAM_LANE_LIMIT) return;
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
    onSuccess: ({ lane, message }, { body }) => {
      queryClient.setQueryData<StreamLaneList>(laneKeys.team(teamId), (prev) => putLane(prev, lane));
      // A pause cancels the lane's pending pickup (and a resume may schedule one): read them again.
      if (body.status) queryClient.invalidateQueries({ queryKey: pickupKeys.team(teamId) });
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
