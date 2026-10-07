"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useLiveMatchupQuery, useMatchupQuery, useWeeklyMatchupQuery } from "@/hooks/useMatchup";
import { useRosterTransactionMutation } from "@/hooks/useRosterTransaction";
import { useSelectedTeam } from "@/hooks/useSelectedTeam";
import { useStreamersQuery } from "@/hooks/useStreamers";
import { useTeamScheduleQuery } from "@/hooks/useTeamSchedule";
import { useUIStore } from "@/stores/useUIStore";
import { userMessage } from "@/lib/api-error";
import { staleLineup } from "@/lib/lineup-editor";
import { sourceFromApi, weekDaysFromApi } from "@/lib/week-source";
import {
  DEMO_DAYS,
  DEMO_ROSTER,
  DEMO_STREAMERS,
  DEMO_TODAY,
  demoAssignment,
  demoBoard,
  demoPeriod,
  demoPlan,
  demoSchedule,
  demoSource,
  demoTransact,
} from "@/lib/week-demo";
import type { LineupMove, LineupState } from "@/types/lineup-editor";
import type { ScheduleGame } from "@/types/games";
import type { StreamerPlayer } from "@/types/streamer";
import type { WeekSource } from "@/lib/week-grid";
import { useDayBoards, type DayLineups } from "./useDayBoards";
import { WeekTerminal } from "./WeekTerminal";
import type { WeekView } from "./Chrome";

export type TerminalStatus = "ready" | "loading" | "signed-out" | "no-team" | "error" | "empty";

export interface TeamOption {
  id: number;
  name: string;
  tag: string;
}

/** Everything the terminal needs from outside: data, each day's lineup, and the writes. */
export interface TerminalData {
  demo: boolean;
  status: TerminalStatus;
  message: string | null;
  teamId: number | null;
  teams: TeamOption[];
  selectTeam: (id: number) => void;
  /** The week, given today's ESPN lineup. */
  makeSource: (board: LineupState | null) => WeekSource | null;
  /** Each day's ESPN lineup and the lineup writes (ESPN teams). */
  lineup: DayLineups;
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

export function WeekPage({ demo, view }: { demo: boolean; view?: WeekView }) {
  return demo ? <DemoWeek view={view} /> : <LiveWeek view={view} />;
}

// ---------------------------------------------------------------------------
// Demo: a made-up week, writes applied locally
// ---------------------------------------------------------------------------

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function DemoWeek({ view }: { view?: WeekView }) {
  const [roster, setRoster] = useState(DEMO_ROSTER);
  // Each day's own edit (where everyone sits), ESPN's carry-forward applied on read.
  const edits = useRef<Record<number, Record<number, number>>>({});
  const [version, setVersion] = useState(1);
  const [applying, setApplying] = useState(false);
  const [scheduleTeam, setScheduleTeam] = useState<string | null>(null);
  const [transacting, setTransacting] = useState(false);

  const boardFor = useCallback(
    (r: typeof roster, day: number, v: number) =>
      demoBoard(r, `demo-${v}-${day}`, day, demoAssignment(r, edits.current, day)),
    []
  );
  const boards = useMemo(
    () => DEMO_DAYS.map((d) => (d.index >= DEMO_TODAY ? boardFor(roster, d.index, version) : undefined)),
    [roster, version, boardFor]
  );
  const source = useMemo(() => demoSource(roster), [roster]);
  const makeSource = useCallback(() => source, [source]);

  const apply = useCallback(
    async (day: number, board: LineupState, moves: LineupMove[]) => {
      setApplying(true);
      await wait(350);
      const next: Record<number, number> = Object.fromEntries(board.players.map((p) => [p.player_id, p.lineup_slot_id]));
      for (const m of moves) next[m.player_id] = m.to_slot_id;
      edits.current = { ...edits.current, [day]: next };
      // Functional: several days can be written in one send, each must re-render.
      setVersion((v) => v + 1);
      setApplying(false);
      return boardFor(roster, day, Date.now());
    },
    [roster, boardFor]
  );

  const lineup: DayLineups = {
    boards,
    todayDay: DEMO_TODAY,
    periodOf: (day) => demoPeriod(day),
    loading: false,
    apply,
    refresh: async (day) => (day >= DEMO_TODAY ? boardFor(roster, day, Date.now()) : null),
    planToday: async () => demoPlan(boards[DEMO_TODAY]!),
    applying,
  };

  const transact = useCallback(async (add: number | null, drop: number | null) => {
    setTransacting(true);
    await wait(450);
    setRoster((r) => demoTransact(r, add, drop));
    setVersion((v) => v + 10);
    setTransacting(false);
    return "ok" as const;
  }, []);

  const rosterIds = useMemo(() => new Set(roster.map((r) => r.id)), [roster]);
  const data: TerminalData = {
    demo: true,
    status: "ready",
    message: null,
    teamId: 1,
    teams: [{ id: 1, name: "Paint Beasts", tag: "ESPN · PTS" }],
    selectTeam: () => {},
    makeSource,
    lineup,
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

  return <WeekTerminal data={data} initialView={view} />;
}

// ---------------------------------------------------------------------------
// Live: the selected team's week from the API
// ---------------------------------------------------------------------------

function LiveWeek({ view }: { view?: WeekView }) {
  const { isSignedIn, isLoaded } = useAuth();
  const selected = useSelectedTeam();
  const setSelectedTeam = useUIStore((s) => s.setSelectedTeam);
  const teamId = selected.teamId;

  const week = useWeeklyMatchupQuery(teamId);
  const live = useLiveMatchupQuery(teamId);
  const matchup = useMatchupQuery(teamId);
  const weekDays = useMemo(() => (week.data ? weekDaysFromApi(week.data) : null), [week.data]);
  const lineup = useDayBoards(teamId, selected.provider, weekDays);

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
    lineup,
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

  return <WeekTerminal data={data} initialView={view} />;
}
