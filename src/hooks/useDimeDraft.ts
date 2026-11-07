import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";

import { apiClient } from "@/lib/api";
import { shouldPoll } from "@/lib/draft-dime";
import { draftKeys } from "@/hooks/useDrafts";
import type { DimeDraftDesk, DimeDraftNote, DimeDraftNoteKind, DimeDraftRoom } from "@/types/draft";

/** Keyed by the Clerk user too: another account on the same page never sees the last one's notes. */
export const dimeDraftKey = (userId: string | null | undefined, sessionId: number) =>
  [...draftKeys.all, "dime", userId ?? "signed-out", sessionId] as const;

/**
 * Dime in a draft room: its notes and switches. A note is written in a few
 * seconds and the seat drafts a pick at a time, so the view is read every 2.5
 * seconds while either runs and left alone otherwise (the room asks when the
 * draft moves). The GET never refuses for a server or user without Dime, so a
 * failure here is a real one and stays quiet: the room just shows no Dime.
 */
export function useDimeDraftQuery(sessionId: number | null, enabled: boolean) {
  const { getToken, isSignedIn, userId } = useAuth();
  return useQuery<DimeDraftRoom>({
    queryKey: dimeDraftKey(userId, sessionId ?? 0),
    queryFn: ({ signal }) => apiClient.getDimeDraft(getToken, sessionId!, { signal }),
    enabled: enabled && !!sessionId && isSignedIn === true,
    staleTime: 15_000,
    refetchInterval: (query) => (shouldPoll(query.state.data) ? 2_500 : false),
    retry: false,
    meta: { toast: false },
  });
}

export const dimeDraftNotesKey = (userId: string | null | undefined) => [...draftKeys.all, "dime", userId ?? "signed-out", "desk"] as const;

/**
 * The AI desk's Draft notes: every room's notes in one read, read again every
 * 5 seconds while one is being written. The room's own writes refresh it too.
 */
export function useDimeDraftNotesQuery(enabled: boolean) {
  const { getToken, isSignedIn, userId } = useAuth();
  return useQuery<DimeDraftDesk>({
    queryKey: dimeDraftNotesKey(userId),
    queryFn: ({ signal }) => apiClient.getDimeDraftNotes(getToken, { signal }),
    enabled: enabled && isSignedIn === true,
    staleTime: 30_000,
    refetchInterval: (query) => (query.state.data?.rooms.some((r) => r.notes.some((n) => n.state === "running")) ? 5_000 : false),
    retry: false,
  });
}

function useDimeWrite<TVars, TResult>(sessionId: number, fn: (vars: TVars) => Promise<TResult>, apply: (d: DimeDraftRoom, r: TResult) => DimeDraftRoom) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVars>({
    mutationFn: fn,
    // The room says why in its own words (the refusals are written for the user)
    meta: { toast: false },
    onSuccess: (result) => {
      queryClient.setQueryData<DimeDraftRoom>(dimeDraftKey(userId, sessionId), (d) => (d ? apply(d, result) : d));
      void queryClient.invalidateQueries({ queryKey: dimeDraftKey(userId, sessionId) });
      void queryClient.invalidateQueries({ queryKey: dimeDraftNotesKey(userId) });
    },
  });
}

/** Ask Dime for a plan, a note at the coming pick, or a recap. */
export function useAskDimeDraft(sessionId: number) {
  const { getToken } = useAuth();
  return useDimeWrite<DimeDraftNoteKind, DimeDraftNote>(
    sessionId,
    (kind) => apiClient.askDimeDraft(getToken, sessionId, kind),
    (d, note) => ({
      ...d,
      running: note.state === "running" ? note.id : d.running,
      notes: [note, ...d.notes.filter((n) => n.id !== note.id)],
    })
  );
}

export function useSetDimeDraftNotes(sessionId: number) {
  const { getToken } = useAuth();
  return useDimeWrite<boolean, DimeDraftRoom>(sessionId, (on) => apiClient.setDimeDraftNotes(getToken, sessionId, on), (_, room) => room);
}

export function useSetDimeDraftSeat(sessionId: number) {
  const { getToken } = useAuth();
  return useDimeWrite<boolean, DimeDraftRoom>(sessionId, (on) => apiClient.setDimeDraftSeat(getToken, sessionId, on), (_, room) => room);
}
