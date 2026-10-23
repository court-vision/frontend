"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { lineupKeys } from "@/hooks/useLineupEditor";
import {
  matchupKeys,
  useLiveMatchupQuery,
  useMatchupQuery,
  useMatchupScoreHistoryQuery,
  useWeeklyMatchupQuery,
} from "@/hooks/useMatchup";
import { useRosterTransactionMutation } from "@/hooks/useRosterTransaction";
import { useCancelPickupMutation, useSchedulePickupMutation, useScheduledPickupsQuery } from "@/hooks/useScheduledPickups";
import {
  useStartStreamLaneMutation,
  useStopStreamLaneMutation,
  useStreamLanesQuery,
  useUpdateStreamLaneMutation,
} from "@/hooks/useStreamLanes";
import { apiClient } from "@/lib/api";
import { demoLanePlan } from "@/lib/lanes";
import { useConnectionsQuery } from "@/hooks/useConnections";
import { useDailyActionsQuery } from "@/hooks/useDailyActions";
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
import { currentFallback, racePeriod, sourceFromApi, weekBehindBoard, weekDaysFromApi } from "@/lib/week-source";
import { liveSpan } from "@/lib/week-polling";
import {
  DEMO_DAYS,
  DEMO_ROSTER,
  DEMO_BREAKOUTS,
  DEMO_STREAMERS,
  DEMO_TODAY,
  demoAssignment,
  demoBoard,
  demoDailyActions,
  demoScoreHistory,
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
import type { DailyActionsData } from "@/types/daily-actions";
import type { DailyScorePoint } from "@/types/matchup";
import type { ScheduledPickup, ScheduledPickupList } from "@/types/scheduled-pickup";
import type { LaneNotify, StreamLane, StreamLaneList, StreamLanePlan, StreamLaneUpdateRequest } from "@/types/stream-lane";
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

/** Today's moves (the strip in the tape), and how to read them again. */
export interface TodayActions {
  data: DailyActionsData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * How an add and/or drop went: made; refused, with the server's (or ESPN's)
 * sentence; or stale, the board it was pinned to having moved on ESPN (the
 * fresh one is cached, and nothing was made).
 */
export type TransactOutcome = { status: "ok" } | { status: "stale" } | { status: "refused"; message: string };

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
  /** The week, given today's ESPN lineup and each day's (who is on the roster that day). */
  makeSource: (board: LineupState | null, boards?: ReadonlyArray<LineupState | undefined>) => WeekSource | null;
  /** Each day's ESPN lineup and the lineup writes (ESPN teams). */
  lineup: DayLineups;
  /**
   * The queries whose last answer the status line reports ("Updated 2 min ago").
   * It subscribes to them itself, so a poll re-renders the line, not the desk.
   */
  updatedFrom: readonly QueryKey[];
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
  /** Add and/or drop on the provider, pinned to `board`. */
  transact: (add: number | null, drop: number | null, board: LineupState) => Promise<TransactOutcome>;
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
  /** Stream lanes (ESPN teams): the open ones (up to four, one per spot, oldest first) and those ended this week. */
  lanes: StreamLaneList;
  /** What a lane on this player's spot would do (a dry run); `firstDay` is the demo's first open day. */
  planLane: (playerId: number, firstDay: number) => Promise<StreamLanePlan>;
  /** Start one. Resolves "ok", or "refused" with `laneError` set. */
  startLane: (playerId: number, notify: LaneNotify, plan: StreamLanePlan) => Promise<"ok" | "refused">;
  startingLane: boolean;
  laneError: string | null;
  clearLaneError: () => void;
  /** Pause, resume, or change how it tells you. */
  updateLane: (laneId: number, body: StreamLaneUpdateRequest) => void;
  stopLane: (laneId: number) => Promise<"ok" | "refused">;
  /** A lane change (pause, resume, notify, stop) while that request is out. */
  laneBusy: boolean;
  /** Today's moves (ESPN teams); null where there are none to read. */
  actions: TodayActions | null;
  /** The matchup's nightly score snapshots (the edge's race); null while there is no week to ask about. */
  history: { points: DailyScorePoint[] | null; loading: boolean } | null;
}

/** The demo's status line watches no query (and a signed-out desk has none to watch). */
const NOTHING_WATCHED: readonly QueryKey[] = [];

export function WeekPage({ demo, view, market }: { demo: boolean; view?: WeekView; market?: MarketMode }) {
  return demo ? <DemoWeek view={view} market={market} /> : <LiveWeek view={view} market={market} />;
}

// ---------------------------------------------------------------------------
// Demo: a made-up week, writes applied locally
// ---------------------------------------------------------------------------

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function DemoWeek({ view, market }: { view?: WeekView; market?: MarketMode }) {
  const [roster, setRoster] = useState(DEMO_ROSTER);
  // The roster as the last transaction left it: a send reads its days again (and writes
  // them) right after a drop, before the render that would hand it the new roster.
  const latest = useRef(DEMO_ROSTER);
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
  const [lanes, setLanes] = useState<StreamLaneList>({ open: [], recent: [] });
  const nextLaneId = useRef(1);

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
      return { lineup: boardFor(latest.current, day, Date.now()), verified: true };
    },
    [boardFor]
  );

  const lineup: DayLineups = {
    boards,
    todayDay: DEMO_TODAY,
    boardDate: DEMO_DAYS[DEMO_TODAY]?.date ?? null,
    periodOf: (day) => demoPeriod(day),
    loading: false,
    apply,
    // The demo's boards are built from its own edits on every render: nothing to read again.
    settle: () => {},
    refresh: async (day) => (day >= DEMO_TODAY ? boardFor(latest.current, day, Date.now()) : null),
    planToday: async () => demoPlan(boards[DEMO_TODAY]!),
    applying,
  };

  const transact = useCallback(async (add: number | null, drop: number | null) => {
    setTransacting(true);
    await wait(450);
    latest.current = demoTransact(latest.current, add, drop);
    setRoster(latest.current);
    setVersion((v) => v + 10);
    setTransacting(false);
    return { status: "ok" } as const;
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
  const pool = useMemo(() => DEMO_STREAMERS.filter((x) => !rosterIds.has(x.player_id)), [rosterIds]);
  const planLane = useCallback(
    async (playerId: number, firstDay: number) => {
      await wait(450);
      // The open lanes keep their free agents and their adds, a paused one's too (the demo never
      // re-plans, so a resumed lane picks up its old plan): a new demo lane plans around them.
      const open = lanes.open;
      const taken = new Set(open.flatMap((l) => (l.projection?.days ?? []).map((d) => d.player.player_id)));
      const adds = Math.max(0, 3 - open.reduce((n, l) => n + (l.projection?.adds ?? 0), 0));
      const free = pool.filter((p) => !taken.has(p.player_id));
      const plan = demoLanePlan(source, playerId, free, firstDay, adds, demoPeriod, new Date(`${DEMO_DAYS[DEMO_TODAY].date}T19:00:00Z`));
      if (!plan) throw new Error("The matchup has no day left a pickup could count for");
      return plan;
    },
    [source, pool, lanes.open]
  );
  const startLane = useCallback(async (playerId: number, notify: LaneNotify, plan: StreamLanePlan) => {
    await wait(350);
    const now = new Date(`${DEMO_DAYS[DEMO_TODAY].date}T19:05:00Z`).toISOString();
    const id = nextLaneId.current++;
    const lane: StreamLane = {
      id,
      team_id: 1,
      status: "active",
      notify,
      holder: plan.holder,
      original: plan.holder,
      start_period: plan.start_period,
      end_period: plan.end_period,
      end_date: plan.end_date,
      next_period: plan.start_period,
      next_decision_at: plan.first_decision_at,
      reason: null,
      detail: null,
      projection: plan.projection,
      events: [{
        id: id * 100, action: "started", nba_date: plan.projection.days[0]?.nba_date ?? null,
        scoring_period_id: plan.start_period, add: null, drop: null, projected: null, reason: null, detail: null,
        pickup_id: null, pickup_status: null, created_at: now,
      }],
      created_at: now,
      ended_at: null,
    };
    setLanes((prev) => ({ open: [...prev.open, lane], recent: prev.recent }));
    toast.success(`Streaming ${plan.holder.name}'s spot (demo: nothing runs)`);
    void playerId;
    return "ok" as const;
  }, []);
  const updateLane = useCallback((laneId: number, body: StreamLaneUpdateRequest) => {
    setLanes((prev) => ({
      ...prev,
      open: prev.open.map((l) =>
        l.id !== laneId ? l : { ...l, status: body.status ?? l.status, notify: body.notify ?? l.notify, reason: body.status === "paused" ? "paused_by_user" : body.status === "active" ? null : l.reason }
      ),
    }));
    toast.success(body.status === "paused" ? "Stream lane paused (demo)" : body.status === "active" ? "Stream lane resumed (demo)" : "Stream lane updated (demo)");
  }, []);
  const stopLane = useCallback(async (laneId: number) => {
    setLanes((prev) => {
      const lane = prev.open.find((l) => l.id === laneId);
      return lane
        ? { open: prev.open.filter((l) => l.id !== laneId), recent: [{ ...lane, status: "ended", reason: "stopped", ended_at: new Date().toISOString() }, ...prev.recent] }
        : prev;
    });
    toast.success("Stream lane stopped (demo)");
    return "ok" as const;
  }, []);

  const todayBoard = boards[DEMO_TODAY];
  const actions = useMemo(
    () => (todayBoard ? demoDailyActions(todayBoard, demoDailyStreamers(DEMO_TODAY)) : null),
    [todayBoard]
  );
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
    updatedFrom: NOTHING_WATCHED,
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
    lanes,
    planLane,
    startLane,
    startingLane: false,
    laneError: null,
    clearLaneError: () => {},
    updateLane,
    stopLane,
    laneBusy: false,
    actions: { data: actions, loading: false, error: null, refetch: () => {} },
    history: { points: demoScoreHistory(source), loading: false },
  };

  return <WeekTerminal data={data} initialView={view} initialMarket={market} />;
}

// ---------------------------------------------------------------------------
// Live: the selected team's week from the API
// ---------------------------------------------------------------------------

const START_PROVIDER: AddStart = { step: "provider" };
/** Re-reads of a week still behind the board: at once, then 30 s, 60 s and 90 s after each answer. */
const REREADS = 4;
const REREAD_STEP_MS = 30_000;
// Stable stand-ins for lists not loaded yet: a fresh [] each render would re-rank the market.
const NO_STREAMERS: StreamerPlayer[] = [];
const NO_BREAKOUTS: BreakoutCandidateResp[] = [];

function LiveWeek({ view, market }: { view?: WeekView; market?: MarketMode }) {
  const { isSignedIn, isLoaded, getToken } = useAuth();
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
  const weekDays = useMemo(() => (week.data ? weekDaysFromApi(week.data) : null), [week.data]);
  const lineup = useDayBoards(teamId, selected.provider, weekDays);
  const todayBoard = lineup.todayDay != null ? lineup.boards[lineup.todayDay] ?? null : null;
  // ESPN rolls its day at 3 AM ET and the board's poll follows it; the week,
  // read only on arrival and focus, would go on calling the day just played
  // today. Read it again when the board's day passes the week's, and a few
  // times more, further apart, while a read fails or still comes back behind.
  const queryClient = useQueryClient();
  const weekBehind = weekBehindBoard(week.data, lineup.boardDate);
  const reread = useRef({ key: "", tries: 0 });
  const refetchWeek = week.refetch;
  const weekSettled = Math.max(week.dataUpdatedAt, week.errorUpdatedAt);
  useEffect(() => {
    if (!weekBehind || teamId == null || lineup.boardDate == null) return;
    const key = `${teamId}:${lineup.boardDate}`;
    if (reread.current.key !== key) reread.current = { key, tries: 0 };
    const { tries } = reread.current;
    if (tries >= REREADS) return;
    const timer = setTimeout(() => {
      reread.current.tries = tries + 1;
      void refetchWeek();
      void queryClient.invalidateQueries({ queryKey: matchupKeys.live(teamId) });
    }, tries * REREAD_STEP_MS);
    return () => clearTimeout(timer);
  }, [weekBehind, teamId, lineup.boardDate, weekSettled, refetchWeek, queryClient]);
  // Your games tonight, from today's board: the live poll runs fast around them
  // (and while any rostered player's box score is live).
  const span = useMemo(() => liveSpan(todayBoard), [todayBoard]);
  const live = useLiveMatchupQuery(teamId, span);
  // The current matchup is live without tonight's overlay: read only as live's stand-in.
  const liveFailed = currentFallback(live);
  const matchup = useMatchupQuery(teamId, "season", { enabled: liveFailed });

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
  // Today's moves wait for the week: it is what the desk paints first, and this is the heaviest read.
  const actions = useDailyActionsQuery(teamId, selected.provider, { enabled: week.data !== undefined, board: todayBoard });
  const history = useMatchupScoreHistoryQuery(teamId, racePeriod(week.data));
  const pickupSchedule = useSchedulePickupMutation(teamId ?? 0);
  const pickupCancel = useCancelPickupMutation(teamId ?? 0);
  const lanes = useStreamLanesQuery(selected.provider === "espn" ? teamId : null);
  const laneStart = useStartStreamLaneMutation(teamId ?? 0);
  const laneUpdate = useUpdateStreamLaneMutation(teamId ?? 0);
  const laneStop = useStopStreamLaneMutation(teamId ?? 0);

  const weekData = week.data;
  const liveData = live.data;
  const matchupData = matchup.data;
  const makeSource = useCallback(
    (board: LineupState | null, boards?: ReadonlyArray<LineupState | undefined>) =>
      weekData ? sourceFromApi({ week: weekData, live: liveData, matchup: matchupData, board, boards }) : null,
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
      if (board.scoring_period_id == null || teamId == null) {
        return { status: "refused", message: "This day can't be edited" } as const;
      }
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
        return { status: "ok" } as const;
      } catch (err) {
        if (!staleLineup(err)) return { status: "refused", message: userMessage(err) } as const;
        // A stale board was swapped in by the mutation; the preview no longer applies.
        rereadLaterDays();
        return { status: "stale" } as const;
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
  const planLane = useCallback(
    (playerId: number) => (teamId == null ? Promise.reject(new Error("No team")) : apiClient.planStreamLane(getToken, teamId, playerId)),
    [getToken, teamId]
  );
  const startLaneAsync = laneStart.mutateAsync;
  const startLane = useCallback(
    async (playerId: number, notify: LaneNotify) => {
      try {
        await startLaneAsync({ player_id: playerId, notify });
        return "ok" as const;
      } catch {
        return "refused" as const;
      }
    },
    [startLaneAsync]
  );
  const updateLaneMutate = laneUpdate.mutate;
  const stopLaneAsync = laneStop.mutateAsync;
  const stopLane = useCallback(
    async (laneId: number) => {
      try {
        await stopLaneAsync(laneId);
        return "ok" as const;
      } catch {
        return "refused" as const;
      }
    },
    [stopLaneAsync]
  );

  const connectionData = connections.data;
  const teams = useMemo<TeamOption[]>(
    () =>
      selected.teams.map((t) => {
        const c = connectionForTeam(connectionData ?? [], t.team_id);
        return {
          id: t.team_id,
          name: teamName(t),
          tag: teamTag(t),
          warn: c?.status === "expired" ? `${providerLabel(c.provider)} rejected the ${connectionTitle(c)}'s ${c.provider === "yahoo" ? "login" : "cookies"}` : null,
        };
      }),
    [selected.teams, connectionData]
  );
  const expired = teamId != null ? connectionForTeam(connectionData ?? [], teamId) : null;
  const updatedFrom = useMemo(
    () => (teamId != null ? [matchupKeys.week(teamId), matchupKeys.live(teamId)] : NOTHING_WATCHED),
    [teamId]
  );
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
    updatedFrom,
    refetch: () => {
      void week.refetch();
      void live.refetch();
      if (liveFailed) void matchup.refetch();
    },
    streamers: streamers.data?.streamers ?? NO_STREAMERS,
    streamersLoading: wantStreamers && streamers.isLoading,
    requestStreamers: () => setWantStreamers(true),
    daily: dailyDay != null ? daily.data?.streamers ?? NO_STREAMERS : NO_STREAMERS,
    dailyLoading: dailyDay != null && daily.isLoading,
    dailyDay,
    setDailyDay,
    breakouts: breakouts.data?.candidates ?? NO_BREAKOUTS,
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
    lanes: lanes.data,
    planLane,
    startLane,
    startingLane: laneStart.isPending,
    laneError: laneStart.error ? userMessage(laneStart.error) : null,
    clearLaneError: laneStart.reset,
    updateLane: (laneId, body) => updateLaneMutate({ laneId, body }),
    stopLane,
    laneBusy: laneUpdate.isPending || laneStop.isPending,
    actions:
      selected.provider === "espn"
        ? {
            data: actions.data ?? null,
            loading: actions.isLoading,
            error: actions.error ? userMessage(actions.error, "Couldn't work out today's moves") : null,
            refetch: () => void actions.refetch(),
          }
        : null,
    history: week.data ? { points: history.data?.history ?? null, loading: history.isLoading } : null,
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
