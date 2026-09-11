import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { apiClient } from "@/lib/api";
import { lineupKeys } from "@/hooks/useLineupEditor";
import type { DailyActionsData } from "@/types/daily-actions";
import type { LineupState } from "@/types/lineup-editor";
import type { FantasyProvider } from "@/types/team";

/**
 * Today's recommended roster actions for an ESPN team. Only ESPN teams have
 * them, so the query is off for every other provider. Re-polls every five
 * minutes (the free-agent search behind it is the expensive part); every
 * roster write invalidates it on its own.
 *
 * The board the rows were computed against is pushed into the lineup editor's
 * cache inside `queryFn` (TanStack v5 has no `onSuccess` on a query), so a
 * `LineupEditorProvider` mounted once `data` exists finds fresh board data and
 * stages against exactly the board the rows came from, with no second read.
 */
export function useDailyActionsQuery(
  teamId: number | null,
  provider: FantasyProvider | null | undefined
) {
  const { getToken, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  return useQuery<DailyActionsData>({
    queryKey: lineupKeys.actions(teamId!),
    queryFn: async ({ signal }) => {
      const data = await apiClient.getTeamDailyActions(getToken, teamId!, { signal });
      if (data.lineup) {
        queryClient.setQueryData<LineupState | null>(lineupKeys.state(teamId!), data.lineup);
      }
      return data;
    },
    enabled: !!teamId && isSignedIn === true && provider === "espn",
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
    // The widget renders its own failure in place.
    meta: { toast: false },
  });
}
