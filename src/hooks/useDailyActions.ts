import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { apiClient } from "@/lib/api";
import { lineupKeys } from "@/hooks/useLineupEditor";
import { actionsPollMs } from "@/lib/week-polling";
import type { DailyActionsData } from "@/types/daily-actions";
import type { LineupState } from "@/types/lineup-editor";
import type { FantasyProvider } from "@/types/team";

/**
 * Today's recommended moves for an ESPN team (starts, IR, the day's streamer
 * swap). Only ESPN teams have them, so the query is off for every other
 * provider. The free-agent search behind it is the slow part (1–2 s), so it
 * re-polls every five minutes while your players are locking (from just before
 * the first tip on today's `board` until the last) and every fifteen otherwise;
 * a roster write invalidates it with the rest of the lineup family, and the desk
 * refetches when its board moves on.
 */
export function useDailyActionsQuery(
  teamId: number | null,
  provider: FantasyProvider | null | undefined,
  opts: { board?: LineupState | null } = {}
) {
  const { getToken, isSignedIn } = useAuth();
  const board = opts.board ?? null;
  return useQuery<DailyActionsData>({
    queryKey: lineupKeys.actions(teamId!),
    queryFn: ({ signal }) => apiClient.getTeamDailyActions(getToken, teamId!, { signal }),
    enabled: !!teamId && isSignedIn === true && provider === "espn",
    staleTime: 2 * 60_000,
    refetchInterval: () => actionsPollMs(board, Date.now()),
    refetchOnWindowFocus: true,
    // The strip shows its own failure in place.
    meta: { toast: false },
  });
}
