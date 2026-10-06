"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { ROSTER_MOVE_INVALID, toApiError, userMessage } from "@/lib/api-error";
import { staleLineup } from "@/lib/lineup-editor";
import { lineupKeys, useTeamLineupQuery } from "@/hooks/useLineupEditor";
import { matchupKeys } from "@/hooks/useMatchup";
import { teamsKeys } from "@/hooks/useTeams";
import type { WeekDay } from "@/lib/week-grid";
import type { FantasyProvider } from "@/types/team";
import type {
  ApplyLineupMovesData,
  ApplyLineupMovesRequest,
  LineupMove,
  LineupPlanData,
  LineupState,
} from "@/types/lineup-editor";

/**
 * Every day's ESPN lineup in the matchup week, and the writes that change one.
 *
 * ESPN keeps one lineup per day (its "scoring period", 1 = opening night). An
 * edit carries forward to later days until the next day that has its own edit,
 * so a write to one day re-reads every later day. Past days can't be read.
 */
export interface DayLineups {
  /** Per day index: that day's lineup, undefined while loading or when it can't be read. */
  boards: Array<LineupState | undefined>;
  /** The day index of ESPN's today, if it falls in this week (day 1 before the season). */
  todayDay: number | null;
  /** ESPN's day number for a day index. */
  periodOf: (day: number) => number | null;
  loading: boolean;
  /** Send one day's moves. Rejects with the API error; a stale board is swapped in first. */
  apply: (day: number, board: LineupState, moves: LineupMove[]) => Promise<LineupState>;
  /** Read a day's lineup again (after an earlier day's write may have changed it). */
  refresh: (day: number) => Promise<LineupState | null>;
  /** Today's fill-only plan from the server (today only). */
  planToday: () => Promise<LineupPlanData | null>;
  applying: boolean;
}

/** Whole days from `a` to `b` (YYYY-MM-DD), calendar dates without timezones. */
export function dayDiff(a: string, b: string): number {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** Maps day indexes to ESPN day numbers from a board that knows its own day and date. */
export function periodMapper(anchor: LineupState | null | undefined, days: WeekDay[]) {
  const period = anchor?.scoring_period_id ?? null;
  const date = anchor?.nba_date ?? null;
  return (day: number): number | null => {
    if (period == null || !date || !days[day]) return null;
    return period + dayDiff(date, days[day].date);
  };
}

export function useDayBoards(
  teamId: number | null,
  provider: FantasyProvider | null | undefined,
  days: WeekDay[] | null
): DayLineups {
  const { getToken, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const today = useTeamLineupQuery(teamId, provider);
  const anchor = today.data ?? null;
  const weekDays = useMemo(() => days ?? [], [days]);
  const periodOf = useMemo(() => periodMapper(anchor, weekDays), [anchor, weekDays]);
  const todayDay = anchor?.nba_date ? weekDays.findIndex((d) => d.date === anchor.nba_date) : -1;

  // Later days of the week that ESPN will answer for: after today, up to the season's last day.
  const later = weekDays
    .map((d) => d.index)
    .filter((i) => {
      const p = periodOf(i);
      const current = anchor?.current_scoring_period_id ?? anchor?.scoring_period_id ?? null;
      const final = anchor?.final_scoring_period_id ?? null;
      return p != null && current != null && p > current && (final == null || p <= final);
    });

  const laterQueries = useQueries({
    queries: later.map((i) => {
      const period = periodOf(i)!;
      return {
        queryKey: lineupKeys.day(teamId!, period),
        queryFn: ({ signal }: { signal: AbortSignal }) => apiClient.getTeamLineup(getToken, teamId!, { signal }, period),
        enabled: !!teamId && isSignedIn === true && provider === "espn",
        staleTime: 60_000,
        refetchOnWindowFocus: true,
      };
    }),
  });

  const boards: Array<LineupState | undefined> = weekDays.map((d) => {
    if (d.index === todayDay) return anchor ?? undefined;
    const at = later.indexOf(d.index);
    return at >= 0 ? laterQueries[at]?.data ?? undefined : undefined;
  });

  const mutation = useMutation<ApplyLineupMovesData, Error, ApplyLineupMovesRequest>({
    mutationKey: ["lineup", "apply-day", teamId],
    mutationFn: (body) => apiClient.applyLineupMoves(getToken, teamId!, body),
    meta: { toast: false },
  });

  const cacheBoard = useCallback(
    (board: LineupState) => {
      if (!teamId) return;
      const isToday =
        board.current_scoring_period_id == null || board.scoring_period_id === board.current_scoring_period_id;
      if (isToday) queryClient.setQueryData(lineupKeys.state(teamId), board);
      else if (board.scoring_period_id != null) queryClient.setQueryData(lineupKeys.day(teamId, board.scoring_period_id), board);
    },
    [queryClient, teamId]
  );

  const mutateAsync = mutation.mutateAsync;
  const apply = useCallback(
    async (day: number, board: LineupState, moves: LineupMove[]) => {
      if (!teamId || board.scoring_period_id == null) throw new Error("This day can't be edited");
      try {
        const data = await mutateAsync({
          moves,
          expected_scoring_period_id: board.scoring_period_id,
          roster_version: board.roster_version,
        });
        cacheBoard(data.lineup);
        // Later days may have inherited this edit, and everything that shows the roster moved.
        await queryClient.invalidateQueries({ queryKey: lineupKeys.days(teamId) });
        if (board.scoring_period_id !== board.current_scoring_period_id) {
          void queryClient.invalidateQueries({ queryKey: lineupKeys.state(teamId) });
        }
        queryClient.removeQueries({ queryKey: lineupKeys.plan(teamId) });
        void queryClient.invalidateQueries({ queryKey: lineupKeys.actions(teamId) });
        void queryClient.invalidateQueries({ queryKey: teamsKeys.insights(teamId) });
        void queryClient.invalidateQueries({ queryKey: teamsKeys.roster(teamId) });
        void queryClient.invalidateQueries({ queryKey: matchupKeys.live(teamId) });
        void queryClient.invalidateQueries({ queryKey: matchupKeys.week(teamId) });
        if (!data.verified) toast.warning(`Sent to ESPN for ${board.nba_date ?? "that day"} — not confirmed yet`);
        return data.lineup;
      } catch (err) {
        const fresh = staleLineup(err);
        if (fresh) {
          cacheBoard(fresh);
          void queryClient.invalidateQueries({ queryKey: lineupKeys.days(teamId) });
        } else if (toApiError(err).code !== ROSTER_MOVE_INVALID) {
          console.error("Apply lineup moves error:", err);
        }
        throw err;
      }
    },
    [teamId, mutateAsync, cacheBoard, queryClient]
  );

  const refresh = useCallback(
    async (day: number) => {
      if (!teamId) return null;
      if (day === todayDay) {
        return queryClient.fetchQuery({
          queryKey: lineupKeys.state(teamId),
          queryFn: ({ signal }) => apiClient.getTeamLineup(getToken, teamId, { signal }),
          staleTime: 0,
        });
      }
      const period = periodOf(day);
      if (period == null) return null;
      return queryClient.fetchQuery({
        queryKey: lineupKeys.day(teamId, period),
        queryFn: ({ signal }) => apiClient.getTeamLineup(getToken, teamId, { signal }, period),
        staleTime: 0,
      });
    },
    [teamId, todayDay, periodOf, queryClient, getToken]
  );

  const planToday = useCallback(async () => {
    if (!teamId) return null;
    try {
      return await apiClient.getTeamLineupPlan(getToken, teamId);
    } catch (err) {
      toast.error(userMessage(err, "Couldn't plan today's moves"));
      return null;
    }
  }, [teamId, getToken]);

  return {
    boards,
    todayDay: todayDay >= 0 ? todayDay : null,
    periodOf,
    loading: today.isLoading || laterQueries.some((q) => q.isLoading),
    apply,
    refresh,
    planToday,
    applying: mutation.isPending,
  };
}
