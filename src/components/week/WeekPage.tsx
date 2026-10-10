"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { lineupKeys } from "@/hooks/useLineupEditor";
import { useLiveMatchupQuery, useMatchupQuery, useWeeklyMatchupQuery } from "@/hooks/useMatchup";
import { useRosterTransactionMutation } from "@/hooks/useRosterTransaction";
import { useCancelPickupMutation, useSchedulePickupMutation, useScheduledPickupsQuery } from "@/hooks/useScheduledPickups";
import { useConnectionsQuery } from "@/hooks/useConnections";
import { useSelectedTeam } from "@/hooks/useSelectedTeam";
import { useStreamersQuery } from "@/hooks/useStreamers";
import { useTeamScheduleQuery } from "@/hooks/useTeamSchedule";
import { useUIStore } from "@/stores/useUIStore";
import { userMessage } from "@/lib/api-error";
import { connectionForTeam, connectionTitle, providerLabel, returnPath, teamName, teamTag, withoutYahooReturn, yahooReturn, type YahooReturn } from "@/lib/account";
import { yahooConnectErrorMessage } from "@/lib/yahoo-connect";
import { AddTeamTray, type AddStart } from "@/components/account/AddTeamTray";
import { ACCOUNT_DESK } from "@/components/desk/routes";
import { useLiveAddTeam } from "@/components/account/useAccountModels";
import type { DeskTeam } from "@/components/desk/TeamSwitch";
import { staleLineup } from "@/lib/lineup-editor";
import { sourceFromApi, weekDaysFromApi } from "@/lib/week-source";
import {
  DEMO_DAYS,
  DEMO_ROSTER,
  DEMO_BREAKOUTS,
  DEMO_STREAMERS,
  DEMO_TODAY,
  demoAssignment,
  demoBoard,
  demoDailyStreamers,
  demoPeriod,
  demoPlan,
  demoSchedule,
  demoScheduledPickup,
  demoSource,
  demoTransact,
} from "@/lib/week-demo";
import type { LineupMove, LineupState } from "@/types/lineup-editor";
import type { ScheduleGame } from "@/types/games";
import type { StreamerPlayer } from "@/types/streamer";
import type { BreakoutCandidateResp } from "@/types/breakout";
import type { ScheduledPickup, ScheduledPickupList } from "@/types/scheduled-pickup";
import { useBreakoutStreamersQuery } from "@/hooks/useBreakoutStreamers";
import type { WeekSource } from "@/lib/week-grid";
import { useDayBoards, type DayLineups } from "./useDayBoards";
import { WeekTerminal } from "./WeekTerminal";
import type { WeekView } from "./Chrome";
import type { MarketMode } from "./Market";

export type TerminalStatus = "ready" | "loading" | "signed-out" | "no-team" | "error" | "empty";

export type TeamOption = DeskTeam;

/** Something the team's account needs before its week can be read, and the way there. */
export interface BarNotice {
  text: string;
  action: string;
  onAction: () => void;
}

/** Everything the terminal needs from outside: data, each day's lineup, and the writes. */
export interface TerminalData {
  demo: boolean;
  status: TerminalStatus;
  message: string | null;
  teamId: number | null;
  teams: TeamOption[];
  selectTeam: (id: number) => void;
  /** Opens the add-team flow on this desk; null in the demo. */
  addTeam: (() => void) | null;
  notice: BarNotice | null;
  /** The week, given today's ESPN lineup. */
  makeSource: (board: LineupState | null) => WeekSource | null;
  /** Each day's ESPN lineup and the lineup writes (ESPN teams). */
  lineup: DayLineups;
  updatedAt: number | null;
  refetch: () => void;
  streamers: StreamerPlayer[];
  streamersLoading: boolean;
  requestStreamers: () => void;
  /** The single-day search for `dailyDay` (a day index), once a day is asked for. */
  daily: StreamerPlayer[];
  dailyLoading: boolean;
  dailyDay: number | null;
  setDailyDay: (day: number | null) => void;
  /** Breakout candidates (league-blind), once asked for. */
  breakouts: BreakoutCandidateResp[];
  breakoutsLoading: boolean;
  requestBreakouts: () => void;
  /** Opponents for a previewed free agent's games. */
  schedule: ScheduleGame[] | null;
  setScheduleTeam: (team: string | null) => void;
  /** Add and/or drop on the provider. Resolves "ok", or "refused" with `transactError` set. */
  transact: (add: number | null, drop: number | null, board: LineupState) => Promise<"ok" | "refused">;
  transacting: boolean;
  transactError: string | null;
  clearTransactError: () => void;
  /** Scheduled pickups (ESPN teams): pending, soonest first, and those settled in the last week. */
  pickups: ScheduledPickupList;
  /** Schedule an add (with a drop, or into an open spot) for a later day of the week. */
  schedulePickup: (add: StreamerPlayer, drop: number | null, day: number) => Promise<"ok" | "refused">;
  scheduling: boolean;
  scheduleError: string | null;
  clearScheduleError: () => void;
  cancelPickup: (id: number) => void;
  /** The pickup being cancelled, while that request is out. */
  cancelling: number | null;
}

export function WeekPage({ demo, view, market }: { demo: boolean; view?: WeekView; market?: MarketMode }) {
  return demo ? <DemoWeek view={view} market={market} /> : <LiveWeek view={view} market={market} />;
}

// ---------------------------------------------------------------------------
// Demo: a made-up week, writes applied locally
// ---------------------------------------------------------------------------

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function DemoWeek({ view, market }: { view?: WeekView; market?: MarketMode }) {
  const [roster, setRoster] = useState(DEMO_ROSTER);
  // Each day's own edit (where everyone sits), ESPN's carry-forward applied on read.
  const edits = useRef<Record<number, Record<number, number>>>({});
  const [version, setVersion] = useState(1);
  const [applying, setApplying] = useState(false);
  const [scheduleTeam, setScheduleTeam] = useState<string | null>(null);
  const [transacting, setTransacting] = useState(false);
  const [dailyDay, setDailyDay] = useState<number | null>(null);
  const [pickups, setPickups] = useState<ScheduledPickup[]>([]);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const nextPickupId = useRef(1);

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

  const schedulePickup = useCallback(
    async (add: StreamerPlayer, drop: number | null, day: number) => {
      setScheduleError(null);
      if (pickups.some((p) => p.add.player_id === add.player_id)) {
        setScheduleError(`A pickup of ${add.name} is already scheduled`);
        return "refused" as const;
      }
      setScheduling(true);
      await wait(400);
      const out = drop != null ? roster.find((r) => r.id === drop) ?? null : null;
      const pickup = demoScheduledPickup(nextPickupId.current++, add, out, day);
      setPickups((list) => [...list, pickup].sort((a, b) => a.scoring_period_id - b.scoring_period_id || a.id - b.id));
      setScheduling(false);
      toast.success(`Pickup of ${add.name} scheduled for ${DEMO_DAYS[day].dow} (demo)`);
      return "ok" as const;
    },
    [pickups, roster]
  );
  const cancelPickup = useCallback((id: number) => {
    setPickups((list) => list.filter((p) => p.id !== id));
    toast.success("Pickup cancelled (demo)");
  }, []);

  const rosterIds = useMemo(() => new Set(roster.map((r) => r.id)), [roster]);
  const data: TerminalData = {
    demo: true,
    status: "ready",
    message: null,
    teamId: 1,
    teams: [{ id: 1, name: "Paint Beasts", tag: "ESPN · PTS" }],
    selectTeam: () => {},
    addTeam: null,
    notice: null,
    makeSource,
    lineup,
    updatedAt: null,
    refetch: () => {},
    streamers: DEMO_STREAMERS.filter((s) => !rosterIds.has(s.player_id)),
    streamersLoading: false,
    requestStreamers: () => {},
    daily: dailyDay != null ? demoDailyStreamers(dailyDay).filter((s) => !rosterIds.has(s.player_id)) : [],
    dailyLoading: false,
    dailyDay,
    setDailyDay,
    breakouts: DEMO_BREAKOUTS.filter((b) => !rosterIds.has(b.beneficiary.player_id)),
    breakoutsLoading: false,
    requestBreakouts: () => {},
    schedule: scheduleTeam ? demoSchedule(scheduleTeam) : null,
    setScheduleTeam,
    transact,
    transacting,
    transactError: null,
    clearTransactError: () => {},
    pickups: { pending: pickups, recent: [] },
    schedulePickup,
    scheduling,
    scheduleError,
    clearScheduleError: () => setScheduleError(null),
    cancelPickup,
    cancelling: null,
  };

  return <WeekTerminal data={data} initialView={view} initialMarket={market} />;
}

// ---------------------------------------------------------------------------
// Live: the selected team's week from the API
// ---------------------------------------------------------------------------

const START_PROVIDER: AddStart = { step: "provider" };

function LiveWeek({ view, market }: { view?: WeekView; market?: MarketMode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const selected = useSelectedTeam();
  const setSelectedTeam = useUIStore((s) => s.setSelectedTeam);
  const connections = useConnectionsQuery();
  const addModel = useLiveAddTeam();
  const [add, setAdd] = useState<AddStart | null>(null);
  // The saved team, if it is still one of yours; else the first. Nothing picked is a state, not a wait.
  const teamId = selected.teamId;
  const teamsLoaded = isSignedIn === true && !selected.isLoading && !selected.teamsError;
  useEffect(() => {
    if (!teamsLoaded || selected.teams.length === 0) return;
    if (teamId == null || !selected.teams.some((t) => t.team_id === teamId)) setSelectedTeam(selected.teams[0].team_id);
  }, [teamsLoaded, selected.teams, teamId, setSelectedTeam]);

  // Back from Yahoo's sign-in: the callback appended its verdict to this URL.
  const [arrival, setArrival] = useState<YahooReturn | null | undefined>(undefined);
  useEffect(() => {
    if (arrival !== undefined) return;
    const search = new URLSearchParams(window.location.search);
    const back = yahooReturn(search);
    setArrival(back);
    if (!back) return;
    const qs = withoutYahooReturn(search).toString().replace(/=(&|$)/g, "$1");
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    if (back.kind === "connected") {
      toast.success("Yahoo account connected. Pick the league and the team.");
      setAdd({ step: "yahoo-league", connectionId: back.connectionId });
    } else {
      toast.error(yahooConnectErrorMessage(back.code));
    }
  }, [arrival]);

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
  const [dailyDay, setDailyDay] = useState<number | null>(null);
  const daily = useStreamersQuery(dailyDay != null ? teamId : null, {
    mode: "daily",
    targetDay: dailyDay,
    faCount: 150,
    excludeInjured: true,
  });
  const [wantBreakouts, setWantBreakouts] = useState(false);
  const breakouts = useBreakoutStreamersQuery(30, wantBreakouts);
  const [scheduleTeam, setScheduleTeam] = useState<string | null>(null);
  const schedule = useTeamScheduleQuery(scheduleTeam, true, 10);
  const transaction = useRosterTransactionMutation(teamId ?? 0);
  const pickups = useScheduledPickupsQuery(selected.provider === "espn" ? teamId : null);
  const pickupSchedule = useSchedulePickupMutation(teamId ?? 0);
  const pickupCancel = useCancelPickupMutation(teamId ?? 0);

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
  const queryClient = useQueryClient();
  const transact = useCallback(
    async (add: number | null, drop: number | null, board: LineupState) => {
      if (board.scoring_period_id == null || teamId == null) return "refused" as const;
      // The later days' lineups hold the roster too; the shared mutation only refreshes today's.
      const rereadLaterDays = () => void queryClient.invalidateQueries({ queryKey: lineupKeys.days(teamId) });
      try {
        await mutateAsync({
          add_player_id: add,
          drop_player_id: drop,
          expected_scoring_period_id: board.scoring_period_id,
          roster_version: board.roster_version,
        });
        rereadLaterDays();
        return "ok" as const;
      } catch (err) {
        // A stale board was swapped in by the mutation; the preview no longer applies.
        if (!staleLineup(err)) return "refused" as const;
        rereadLaterDays();
        return "ok" as const;
      }
    },
    [mutateAsync, queryClient, teamId]
  );

  const { periodOf } = lineup;
  const scheduleAsync = pickupSchedule.mutateAsync;
  const schedulePickup = useCallback(
    async (add: StreamerPlayer, drop: number | null, day: number) => {
      const period = periodOf(day);
      if (period == null) return "refused" as const;
      try {
        await scheduleAsync({ add_player_id: add.player_id, drop_player_id: drop, scoring_period_id: period });
        return "ok" as const;
      } catch {
        return "refused" as const;
      }
    },
    [periodOf, scheduleAsync]
  );
  const cancelMutate = pickupCancel.mutate;

  const connectionList = connections.data ?? [];
  const teams: TeamOption[] = selected.teams.map((t) => {
    const c = connectionForTeam(connectionList, t.team_id);
    return {
      id: t.team_id,
      name: teamName(t),
      tag: teamTag(t),
      warn: c?.status === "expired" ? `${providerLabel(c.provider)} rejected the ${connectionTitle(c)}'s ${c.provider === "yahoo" ? "login" : "cookies"}` : null,
    };
  });
  const expired = teamId != null ? connectionForTeam(connectionList, teamId) : null;
  const notice: BarNotice | null =
    expired && expired.status === "expired"
      ? expired.provider === "yahoo"
        ? { text: "Yahoo rejected the login", action: "Open account", onAction: () => router.push(`${ACCOUNT_DESK}?c=${expired.id}`) }
        : { text: "ESPN rejected the cookies", action: "Update", onAction: () => setAdd({ step: "espn-connect", connectionId: expired.id, refresh: true }) }
      : null;

  const data: TerminalData = {
    demo: false,
    status,
    message,
    teamId,
    teams,
    selectTeam: (id) => setSelectedTeam(id),
    addTeam: () => setAdd(START_PROVIDER),
    notice,
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
    daily: dailyDay != null ? daily.data?.streamers ?? [] : [],
    dailyLoading: dailyDay != null && daily.isLoading,
    dailyDay,
    setDailyDay,
    breakouts: breakouts.data?.candidates ?? [],
    breakoutsLoading: wantBreakouts && breakouts.isLoading,
    requestBreakouts: () => setWantBreakouts(true),
    schedule: schedule.data?.schedule ?? null,
    setScheduleTeam,
    transact,
    transacting: transaction.isPending,
    transactError: transaction.error ? userMessage(transaction.error) : null,
    clearTransactError: transaction.reset,
    pickups: pickups.data,
    schedulePickup,
    scheduling: pickupSchedule.isPending,
    scheduleError: pickupSchedule.error ? userMessage(pickupSchedule.error) : null,
    clearScheduleError: pickupSchedule.reset,
    cancelPickup: (id) => cancelMutate(id),
    cancelling: pickupCancel.isPending ? pickupCancel.variables ?? null : null,
  };

  // Everything the terminal holds (staged moves, a picked free agent and its
  // timing, an open confirm, a hovered pickup) is one team's: another team gets
  // a fresh terminal, so nothing staged for one can be sent for the other.
  return (
    <>
      <WeekTerminal key={teamId ?? "none"} data={data} initialView={view} initialMarket={market} />
      <AddTeamTray
        open={add != null}
        onOpenChange={(o) => {
          if (!o) setAdd(null);
        }}
        model={addModel}
        start={add ?? START_PROVIDER}
        returnTo={returnPath(pathname, new URLSearchParams(typeof window === "undefined" ? "" : window.location.search), ["view", "market"])}
        onAdded={(added) => setSelectedTeam(added.teamId)}
      />
    </>
  );
}
