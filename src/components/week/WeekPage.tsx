"use client";

import { useCallback, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { LineupEditorProvider, type LineupEditorMock } from "@/components/lineup/LineupEditorProvider";
import { useLiveMatchupQuery, useMatchupQuery, useWeeklyMatchupQuery } from "@/hooks/useMatchup";
import { useRosterTransactionMutation } from "@/hooks/useRosterTransaction";
import { useSelectedTeam } from "@/hooks/useSelectedTeam";
import { useStreamersQuery } from "@/hooks/useStreamers";
import { useTeamScheduleQuery } from "@/hooks/useTeamSchedule";
import { useUIStore } from "@/stores/useUIStore";
import { userMessage } from "@/lib/api-error";
import { staleLineup } from "@/lib/lineup-editor";
import { sourceFromApi } from "@/lib/week-source";
import {
  DEMO_ROSTER,
  DEMO_STREAMERS,
  demoApply,
  demoBoard,
  demoPlan,
  demoSchedule,
  demoSource,
  demoTransact,
} from "@/lib/week-demo";
import type { LineupState } from "@/types/lineup-editor";
import type { ScheduleGame } from "@/types/games";
import type { StreamerPlayer } from "@/types/streamer";
import type { WeekSource } from "@/lib/week-grid";
import { WeekTerminal } from "./WeekTerminal";

export type TerminalStatus = "ready" | "loading" | "signed-out" | "no-team" | "error" | "empty";

export interface TeamOption {
  id: number;
  name: string;
  tag: string;
}

/** Everything the terminal needs from outside: data, and the two writes that aren't lineup moves. */
export interface TerminalData {
  demo: boolean;
  status: TerminalStatus;
  message: string | null;
  teamId: number | null;
  teams: TeamOption[];
  selectTeam: (id: number) => void;
  /** The week, once today's board (from the lineup editor) is known. */
  makeSource: (board: LineupState | null) => WeekSource | null;
  updatedAt: number | null;
  refetch: () => void;
  streamers: StreamerPlayer[];
  streamersLoading: boolean;
  requestStreamers: () => void;
  /** Opponents for a previewed free agent's games. */
  schedule: ScheduleGame[] | null;
  setScheduleTeam: (team: string | null) => void;
  /** Add and/or drop on the provider. Resolves "ok", or "refused" with `transactError` set. */
  transact: (add: number | null, drop: number | null, board: LineupState) => Promise<"ok" | "refused">;
  transacting: boolean;
  transactError: string | null;
  clearTransactError: () => void;
}

export function WeekPage({ demo }: { demo: boolean }) {
  return demo ? <DemoWeek /> : <LiveWeek />;
}

// ---------------------------------------------------------------------------
// Demo: a made-up week, writes applied locally
// ---------------------------------------------------------------------------

function DemoWeek() {
  const [roster, setRoster] = useState(DEMO_ROSTER);
  const [version, setVersion] = useState(1);
  const [scheduleTeam, setScheduleTeam] = useState<string | null>(null);
  const [transacting, setTransacting] = useState(false);

  const board = useMemo(() => demoBoard(roster, `demo-${version}`), [roster, version]);
  const source = useMemo(() => demoSource(roster), [roster]);
  const mock = useMemo<LineupEditorMock>(
    () => ({ state: board, plan: demoPlan(board), apply: demoApply }),
    [board]
  );

  const transact = useCallback(
    async (add: number | null, drop: number | null) => {
      setTransacting(true);
      await new Promise((r) => setTimeout(r, 450));
      setRoster((r) => demoTransact(r, add, drop));
      setVersion((v) => v + 10);
      setTransacting(false);
      return "ok" as const;
    },
    []
  );

  const rosterIds = useMemo(() => new Set(roster.map((r) => r.id)), [roster]);
  const makeSource = useCallback(() => source, [source]);
  const data: TerminalData = {
    demo: true,
    status: "ready",
    message: null,
    teamId: 1,
    teams: [{ id: 1, name: "Paint Beasts", tag: "ESPN · PTS" }],
    selectTeam: () => {},
    makeSource,
    updatedAt: null,
    refetch: () => {},
    streamers: DEMO_STREAMERS.filter((s) => !rosterIds.has(s.player_id)),
    streamersLoading: false,
    requestStreamers: () => {},
    schedule: scheduleTeam ? demoSchedule(scheduleTeam) : null,
    setScheduleTeam,
    transact,
    transacting,
    transactError: null,
    clearTransactError: () => {},
  };

  // A new board version remounts the editor, as a re-read board drops staging.
  return (
    <LineupEditorProvider key={board.roster_version} teamId={1} mock={mock}>
      <WeekTerminal data={data} />
    </LineupEditorProvider>
  );
}

// ---------------------------------------------------------------------------
// Live: the selected team's week from the API
// ---------------------------------------------------------------------------

function LiveWeek() {
  const { isSignedIn, isLoaded } = useAuth();
  const selected = useSelectedTeam();
  const setSelectedTeam = useUIStore((s) => s.setSelectedTeam);
  const teamId = selected.teamId;

  const week = useWeeklyMatchupQuery(teamId);
  const live = useLiveMatchupQuery(teamId);
  const matchup = useMatchupQuery(teamId);

  const [wantStreamers, setWantStreamers] = useState(false);
  const streamers = useStreamersQuery(wantStreamers ? teamId : null, {
    mode: "week",
    faCount: 150,
    excludeInjured: true,
  });
  const [scheduleTeam, setScheduleTeam] = useState<string | null>(null);
  const schedule = useTeamScheduleQuery(scheduleTeam, true, 10);
  const transaction = useRosterTransactionMutation(teamId ?? 0);

  const weekData = week.data;
  const liveData = live.data;
  const matchupData = matchup.data;
  const makeSource = useCallback(
    (board: LineupState | null) =>
      weekData ? sourceFromApi({ week: weekData, live: liveData, matchup: matchupData, board }) : null,
    [weekData, liveData, matchupData]
  );

  let status: TerminalStatus = "ready";
  let message: string | null = null;
  if (!isLoaded) status = "loading";
  else if (!isSignedIn) status = "signed-out";
  else if (selected.isLoading) status = "loading";
  else if (teamId == null) status = "no-team";
  else if (week.isLoading) status = "loading";
  else if (week.error) {
    status = "error";
    message = userMessage(week.error, "Couldn't load this week");
  } else if (!weekData || weekData.days.length === 0) status = "empty";

  const mutateAsync = transaction.mutateAsync;
  const transact = useCallback(
    async (add: number | null, drop: number | null, board: LineupState) => {
      if (board.scoring_period_id == null) return "refused" as const;
      try {
        await mutateAsync({
          add_player_id: add,
          drop_player_id: drop,
          expected_scoring_period_id: board.scoring_period_id,
          roster_version: board.roster_version,
        });
        return "ok" as const;
      } catch (err) {
        // A stale board was swapped in by the mutation; the preview no longer applies.
        return staleLineup(err) ? ("ok" as const) : ("refused" as const);
      }
    },
    [mutateAsync]
  );

  const teams: TeamOption[] = selected.teams.map((t) => ({
    id: t.team_id,
    name: t.league_info?.team_name ?? `Team ${t.team_id}`,
    tag: `${(t.league_info?.provider ?? "espn").toUpperCase()} · ${t.league?.scoring_type === "categories" ? "CATS" : "PTS"}`,
  }));

  const data: TerminalData = {
    demo: false,
    status,
    message,
    teamId,
    teams,
    selectTeam: (id) => setSelectedTeam(id),
    makeSource,
    updatedAt: Math.max(week.dataUpdatedAt || 0, live.dataUpdatedAt || 0) || null,
    refetch: () => {
      void week.refetch();
      void live.refetch();
      void matchup.refetch();
    },
    streamers: streamers.data?.streamers ?? [],
    streamersLoading: wantStreamers && streamers.isLoading,
    requestStreamers: () => setWantStreamers(true),
    schedule: schedule.data?.schedule ?? null,
    setScheduleTeam,
    transact,
    transacting: transaction.isPending,
    transactError: transaction.error ? userMessage(transaction.error) : null,
    clearTransactError: transaction.reset,
  };

  if (teamId != null && selected.provider === "espn") {
    return (
      <LineupEditorProvider teamId={teamId}>
        <WeekTerminal data={data} />
      </LineupEditorProvider>
    );
  }
  return <WeekTerminal data={data} />;
}
