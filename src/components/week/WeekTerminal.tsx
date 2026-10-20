"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ROSTER_MOVE_INVALID, toApiError, userMessage } from "@/lib/api-error";
import {
  BENCH_SLOT_ID,
  IR_SLOT_ID,
  assignment as boardAssignment,
  diff,
  eligibleTargets,
  isActiveSlot,
  isInjured,
  moveRole,
  normalize,
  planToStaged,
  slotCapacity,
  stage as stagePure,
  stageMoves as stageMovesPure,
  swapPartner,
  unstage as unstagePure,
  validateStaged,
  type Staged,
} from "@/lib/lineup-editor";
import type { LineupPlayer, LineupState, MoveError } from "@/types/lineup-editor";
import type { StreamerPlayer } from "@/types/streamer";
import { writeBlockedCopy } from "@/types/lineup-editor";
import {
  buildWeekGrid,
  isOutStatus,
  planDay,
  viewableDays,
  type DayBoard,
  type GridInput,
  type Incoming,
  type IncomingPreview,
  type LineupMode,
  type WeekSource,
} from "@/lib/week-grid";
import { sourceFromStreamer } from "@/lib/week-source";
import { pickupTiming, pickupViews } from "@/lib/pickups";
import { eventLine, laneCells, laneReason, laneRoomRefusal, laneStretches, passedDates, projectedSource } from "@/lib/lanes";
import type { LaneNotify, LanePlayer } from "@/types/stream-lane";
import { LaneSheet } from "./LaneSheet";
import type { LaneRowModel } from "./LaneRow";
import {
  boardMismatch,
  isAddStaged,
  isRowStaged,
  isTransactionAction,
  rowButton,
  sortActions,
  stageAllFold,
  stageRow,
  streamersHint,
  unstageRow,
  unstagedLineupActions,
} from "@/lib/daily-actions";
import { Bar, EmptyState, LoadingGrid, StatusLine, Tape, Toolbar, type WeekView } from "./Chrome";
import { MatchupView } from "./MatchupView";
import { MarketPane, type MarketMode, type MarketPick } from "./Market";
import { NO_DROP, addsCountFrom, dropCandidates, gainOf, openSpots, rosterRoom } from "@/lib/market";
import { dropBlockedReason, unstageEverywhere, withoutDropped, type DropLeave } from "@/lib/drops";
import { ConfirmDialog } from "./ConfirmDialog";
import { Tray, type PendingDay, type SwapTiming, type TrayDay, type TraySwap } from "./Tray";
import { TodayStrip, type TodayRow } from "./TodayStrip";
import { sendLineupDays } from "./lineup-send";
import { EdgeTick } from "./EdgeTick";
import { tickOf, type TapeBox } from "./TickBox";
import { keyStaysIn } from "./tape-box";
import { buildRace, categoryRace, categoryRacePoints } from "@/lib/matchup-race";
import { MoveMenu, ReplaceMenu, type MoveTarget, type ReplaceOption } from "./Menus";
import { WeekGrid, type Cursor, type DragApi, type DropTarget } from "./WeekGrid";
import { DailyGrid, type SeatDragApi } from "./DailyGrid";
import type { TerminalData } from "./WeekPage";
import { monthDay, shortName, signed, whenTime } from "./format";
import dk from "@/components/desk/desk.module.css";
import s from "./week.module.css";
import { useDeskTheme } from "@/components/desk/useDeskTheme";

const NO_STAGING: Staged = {};
const MAX_REPLACE_OPTIONS = 80;
/** The tray column an add / drop made now sits in when today is not on the board. */
const NOW_DAY = -1;

/**
 * `day` is the day the menu acts on (a column in the daily view, the selected
 * day in the player view). A replace menu on a later day of the daily view
 * schedules the pickup for that day (`from`).
 */
type Menu = { type: "move" | "replace"; rowKey: string; anchor: HTMLElement; day: number; from: number | null };
type View = WeekView;
/**
 * A free agent in the preview: who he replaces, and the day it's scheduled for
 * (null: made now). `pickup` is the scheduled pickup a hover came from. `held`:
 * the staged drop this add took over by dropping the same player, given back
 * to the tray when the add is let go.
 */
type PreviewRef = { faId: number; replaces: number; from: number | null; pickup?: number; held?: number };
type Planned = DropTarget & { moves: Array<{ player_id: number; to_slot_id: number }> };

export function WeekTerminal({
  data,
  initialView = "daily",
  initialMarket,
}: {
  data: TerminalData;
  initialView?: View;
  /** Open the market on arrival, in this mode. */
  initialMarket?: MarketMode;
}) {
  const lineup = data.lineup;
  const rawBoards = lineup.boards;
  const todayDay = lineup.todayDay;
  // Today's lineup as ESPN holds it: what an add / drop is pinned to.
  const rawToday = todayDay != null ? rawBoards[todayDay] ?? null : null;
  const [root, setRoot] = useState<HTMLDivElement | null>(null);

  // ---- drops made now: players staged to leave the roster, and the boards as they'll stand after ----
  const [drops, setDrops] = useState<number[]>([]);
  // The free agent kept in the preview (and the tray): an add / drop, made now or scheduled.
  const [pinned, setPinned] = useState<PreviewRef | null>(null);
  // An add into an open spot on a full roster rides on a staged drop: made now they go to ESPN as
  // one add / drop, scheduled the drop becomes the pickup's, so neither happens without the other.
  // A player on IR frees no spot.
  const paired = useMemo(() => {
    if (!pinned || pinned.replaces !== NO_DROP || !rawToday || rosterRoom(rawToday) > 0) return null;
    const onBoard = (id: number) => rawToday.players.find((p) => p.player_id === id);
    return drops.find((id) => !!onBoard(id) && onBoard(id)!.lineup_slot_id !== IR_SLOT_ID) ?? null;
  }, [pinned, rawToday, drops]);
  // Drops made now leave from today; one a scheduled pickup carries leaves on the pickup's day.
  const pairedFrom = paired != null ? pinned?.from ?? null : null;
  const leaves = useMemo<DropLeave[]>(
    () => (todayDay == null ? [] : drops.map((id) => ({ id, from: id === paired && pairedFrom != null ? pairedFrom : todayDay }))),
    [drops, paired, pairedFrom, todayDay]
  );
  // Lineup moves are staged on these: each day's lineup without the players gone by then.
  const boards = useMemo(() => withoutDropped(rawBoards, leaves), [rawBoards, leaves]);
  // Today's lineup anchors eligibility, slots and the add/drop; any day's will do before it loads.
  const board: LineupState | null = (todayDay != null ? boards[todayDay] : undefined) ?? boards.find((b) => !!b) ?? null;
  const rawBoard: LineupState | null = rawToday ?? rawBoards.find((b) => !!b) ?? null;

  // ---- view switches ----
  const toggleTheme = useDeskTheme((st) => st.toggle);
  const [heat, setHeat] = useState(false);
  // "espn": each day as set on ESPN; "best": the best fit for each day's games.
  const [mode, setMode] = useState<LineupMode>("espn");
  const toggleMode = useCallback(() => setMode((m) => (m === "espn" ? "best" : "espn")), []);
  // "daily": every day's lineup side by side; "players": one row per player across the week;
  // "matchup": one day, your lineup against the opponent's, box scores live.
  const [view, setView] = useState<View>(initialView);

  // ---- staging: moves per day, kept only while they still differ from that day's lineup ----
  const [stagedByDay, setStagedByDay] = useState<Record<number, Staged>>({});
  const staging = useMemo(
    () => boards.map((b, i) => (b ? normalize(b, stagedByDay[i] ?? NO_STAGING) : NO_STAGING)),
    [boards, stagedByDay]
  );
  const dayBoards = useMemo<Array<DayBoard | null>>(
    () => boards.map((b, i) => (b ? { board: b, staged: staging[i] } : null)),
    [boards, staging]
  );
  const unstagedBoards = useMemo<Array<DayBoard | null>>(
    () => rawBoards.map((b) => (b ? { board: b, staged: NO_STAGING } : null)),
    [rawBoards]
  );
  const staged = todayDay != null ? staging[todayDay] : NO_STAGING;
  const anyStaging = staging.some((st) => Object.keys(st).length > 0) || drops.length > 0;

  // ---- the week ----
  const { makeSource } = data;
  // The week reads the roster as ESPN holds it: a player staged to drop is still on it, leaving.
  const source = useMemo(() => makeSource(rawBoard), [makeSource, rawBoard]);
  const viewableList = useMemo(() => (source ? viewableDays(source) : []), [source]);
  const viewable = useMemo(() => new Set(viewableList), [viewableList]);
  const [viewDayPick, setViewDay] = useState<number | null>(null);
  const viewDay = viewDayPick != null && viewable.has(viewDayPick) ? viewDayPick : viewableList[0] ?? 0;
  const todayIndex = source?.todayIndex ?? null;
  // The daily view's expanded day: any day, past ones included; today (or ESPN's day) by
  // default. "none" collapses every day (clicking the focused day again).
  const [focusPick, setFocusPick] = useState<number | "none" | null>(null);
  const dayCount = source?.days.length ?? 0;
  const defaultFocus = todayIndex ?? todayDay ?? viewDay;
  const focusDay: number | null =
    focusPick === "none" ? null : focusPick != null && focusPick < dayCount ? focusPick : defaultFocus;
  const onFocusDay = useCallback(
    (day: number) => setFocusPick(day === focusDay ? "none" : day),
    [focusDay]
  );

  // ---- free-agent preview: a highlighted one (in the menu) wins over a kept one ----
  const [hover, setHover] = useState<PreviewRef | null>(null);
  /**
   * Keep an add / drop in the tray, or let it go (null). One that drops a
   * player staged to drop takes that drop over, and a let-go one gives back the
   * drop it took (his moves taken back again, as staging a drop does).
   */
  const pin = useCallback(
    (next: PreviewRef | null) => {
      let list = drops;
      const back = pinned?.held;
      if (back != null && !list.includes(back)) {
        list = [...list, back];
        setStagedByDay((prev) => unstageEverywhere(boards, prev, back));
      }
      let ref: PreviewRef | null = next ? { ...next, held: undefined } : null;
      if (ref && ref.replaces !== NO_DROP && list.includes(ref.replaces)) {
        const id = ref.replaces;
        list = list.filter((x) => x !== id);
        ref = { ...ref, held: id };
      }
      if (list !== drops) setDrops(list);
      setPinned(ref);
    },
    [drops, pinned, boards]
  );
  // A hovered pickup that was cancelled (or ran) under the pointer previews nothing.
  const hoverLive =
    hover && (hover.pickup == null || data.pickups.pending.some((p) => p.id === hover.pickup)) ? hover : null;
  const preview = hoverLive ?? pinned;
  // After today's first tip an add counts from tomorrow; the previews and the market both obey.
  const addFrom = useMemo(() => (source ? addsCountFrom(source, rawBoard) : null), [source, rawBoard]);
  // Free agents the desk has loaded: today's moves' pickups, the one-day search, and
  // the rest-of-week pool (later wins: the pool knows his whole week).
  const actionsData = data.actions?.data ?? null;
  const actionPickups = useMemo(
    () => (actionsData?.actions ?? []).flatMap((a) => (a.transaction ? [a.transaction.pickup as StreamerPlayer] : [])),
    [actionsData]
  );
  const faById = useMemo(
    () => new Map([...actionPickups, ...data.daily, ...data.streamers].map((f) => [f.player_id, f])),
    [actionPickups, data.daily, data.streamers]
  );
  const previewFa = preview ? faById.get(preview.faId) ?? null : null;
  const { setScheduleTeam } = data;
  useEffect(() => setScheduleTeam(previewFa?.team ?? null), [previewFa?.team, setScheduleTeam]);

  // ---- the stream lanes: up to four open, one per spot; hovering a lane's row previews its projection ----
  const openLanes = data.lanes.open;
  const [laneHover, setLaneHover] = useState<number | null>(null);
  const hoveredLane = laneHover != null ? openLanes.find((l) => l.id === laneHover) ?? null : null;
  const laneCellsById = useMemo(
    () => new Map(source ? openLanes.map((l) => [l.id, laneCells(l, source.days)] as const) : []),
    [openLanes, source]
  );
  const laneIncoming: Incoming[] | null = useMemo(() => {
    const lane = hoveredLane;
    const cells = lane ? laneCellsById.get(lane.id) : undefined;
    if (!source || !lane || !cells || lane.status !== "active" || !lane.projection) return null;
    // The lane replaces its holder, who must be on the roster the grid knows.
    if (!source.mine.some((p) => p.id === lane.holder.player_id)) return null;
    const projection = lane.projection;
    const sourceOf = (player: LanePlayer, from: number) => {
      const fa = faById.get(player.player_id);
      return fa ? sourceFromStreamer(fa, source.days, null, from) : projectedSource(player, projection, source.days);
    };
    // A day it already passed on (a pickup that failed, say) keeps him, whatever the projection said.
    const passed = passedDates(cells, source.days);
    const stretches = laneStretches(projection, lane.holder.player_id, source.days, sourceOf, passed);
    return stretches.length ? stretches : null;
  }, [source, hoveredLane, laneCellsById, faById]);

  const incoming: IncomingPreview | null = useMemo(
    () =>
      source && preview && previewFa
        ? incomingFor(sourceFromStreamer(previewFa, source.days, data.schedule, preview.from ?? addFrom), preview.replaces, preview.from)
        : laneIncoming,
    [source, preview, previewFa, data.schedule, addFrom, laneIncoming]
  );

  // The week without any preview. Nothing built from it depends on the hovered
  // free agent, so a highlight in the replace menu (or the market) rebuilds only
  // the grid on screen, not every option's gain.
  const build = useCallback(
    (src: WeekSource, over: Partial<GridInput> = {}) =>
      buildWeekGrid({ source: src, board, staged, dayBoards, incoming: null, dropping: leaves, viewDay, mode, ...over }),
    [board, staged, dayBoards, leaves, viewDay, mode]
  );
  const gridNoPreview = useMemo(() => (source ? build(source) : null), [source, build]);
  const grid = useMemo(
    () => (source && incoming ? build(source, { incoming }) : gridNoPreview),
    [source, incoming, build, gridNoPreview]
  );
  // The week as ESPN holds it: no moves, no drops.
  const gridUnstaged = useMemo(
    () =>
      source && anyStaging
        ? build(source, { board: rawBoard, staged: NO_STAGING, dayBoards: unstagedBoards, dropping: [] })
        : gridNoPreview,
    [source, anyStaging, build, rawBoard, unstagedBoards, gridNoPreview]
  );
  /**
   * The projected week with these drops and this staging, each day's moves
   * staged on its lineup as it stands after the drops: what a drop (or taking
   * one back) does to the week.
   */
  const weekFor = useCallback(
    (leavesX: readonly DropLeave[], stagedX: Readonly<Record<number, Staged>>, incomingX: Incoming | null = null) => {
      if (!source) return 0;
      const bs = withoutDropped(rawBoards, leavesX);
      const dbs = bs.map((b, i) => (b ? { board: b, staged: normalize(b, stagedX[i] ?? NO_STAGING) } : null));
      const b0 = (todayDay != null ? bs[todayDay] : undefined) ?? bs.find((b) => !!b) ?? null;
      const st0 = todayDay != null ? dbs[todayDay]?.staged ?? NO_STAGING : NO_STAGING;
      return build(source, { board: b0, staged: st0, dayBoards: dbs, dropping: leavesX, incoming: incomingX }).projected.you;
    },
    [source, rawBoards, todayDay, build]
  );
  const stagedDelta = gridNoPreview && gridUnstaged ? gridNoPreview.projected.you - gridUnstaged.projected.you : 0;

  const gridBest = useMemo(() => (source ? build(source, { mode: "best" }) : null), [source, build]);
  const bestGain = gridBest && gridNoPreview && mode === "espn" ? gridBest.projected.you - gridNoPreview.projected.you : 0;
  // What an add does to the week on screen: the lineup view in force (as set,
  // or the best each day) with him seated where he helps most. The market, the
  // replace menu, the preview and the tray all read this one number.
  const faGain = useCallback(
    (fa: StreamerPlayer, replaces: number, from: number | null = null) => {
      if (!source || !gridNoPreview) return 0;
      const g = build(source, {
        incoming: incomingFor(sourceFromStreamer(fa, source.days, null, from ?? addFrom), replaces, from),
      });
      return g.projected.you - gridNoPreview.projected.you;
    },
    [source, gridNoPreview, build, addFrom]
  );
  const previewDelta =
    preview && previewFa
      ? faGain(previewFa, preview.replaces, preview.from)
      : laneIncoming && grid && gridNoPreview
        ? grid.projected.you - gridNoPreview.projected.you
        : null;

  // ---- scheduling: a pickup made for you before a later day's games ----
  const { periodOf } = lineup;
  /** A day a pickup can be scheduled for: after today, and one ESPN has a day number for. */
  const canSchedule = useCallback(
    (day: number) => !!source && source.days[day]?.kind === "future" && periodOf(day) != null,
    [source, periodOf]
  );
  // After today's first tip an add made now would count from tomorrow, so it is made as a
  // pickup scheduled for tomorrow instead. On the matchup's last day tomorrow isn't on the
  // board to schedule for, and the add stays one made now (ESPN puts it on tomorrow).
  const nowFrom = addFrom != null && canSchedule(addFrom) ? addFrom : null;
  /** The day a replace from `day`'s spot is scheduled for: that day in the daily view when it can be, else now. */
  const replaceFrom = useCallback(
    (day: number | null | undefined) => (view === "daily" && day != null && canSchedule(day) ? day : nowFrom),
    [view, canSchedule, nowFrom]
  );
  const pendingPickups = data.pickups.pending;
  const pickupDay = useCallback(
    (date: string) => source?.days.find((d) => d.date === date) ?? null,
    [source]
  );
  const pickupDayLabel = useCallback(
    (date: string) => {
      const d = pickupDay(date);
      return d ? d.dow : monthDay(date);
    },
    [pickupDay]
  );
  const scheduledFa = useMemo(
    () => new Map(pendingPickups.map((p) => [p.add.player_id, pickupDayLabel(p.nba_date)])),
    [pendingPickups, pickupDayLabel]
  );
  // The open lanes' pickups show in their own rows, not here (with a source, their rows are drawn).
  const shownLanes = useMemo(() => openLanes.map((l) => l.id), [openLanes]);
  const pickupRows = useMemo(
    () => (source ? pickupViews(data.pickups, source.days, shownLanes) : []),
    [data.pickups, source, shownLanes]
  );

  // ---- the market: free agents ranked by what they add to this week ----
  const [marketOpen, setMarketOpen] = useState(initialMarket != null);
  // Closing the market lets go of any hover; a free agent picked in it is staged in the tray and stays.
  const closeMarket = useCallback(() => {
    setMarketOpen(false);
    setHover(null);
  }, []);
  const toggleMarket = useCallback(() => {
    if (marketOpen) closeMarket();
    else setMarketOpen(true);
  }, [marketOpen, closeMarket]);
  const [marketMode, setMarketMode] = useState<MarketMode>(initialMarket ?? "week");
  // The same measure as `faGain`, but built without any preview in the grid, so
  // hovering a row never re-ranks the list.
  const gainBuild = useCallback(
    (src: WeekSource, over: Partial<GridInput> = {}) =>
      buildWeekGrid({ source: src, board, staged, dayBoards, incoming: null, dropping: leaves, viewDay: todayIndex ?? 0, mode, ...over }),
    [board, staged, dayBoards, leaves, todayIndex, mode]
  );
  const marketBase = useMemo(() => (source && marketOpen ? gainBuild(source) : null), [source, marketOpen, gainBuild]);
  const evaluate = useCallback(
    (fa: StreamerPlayer, dropIds: number[], from: number | null = null) => {
      if (!source || !marketBase) return [];
      const player = sourceFromStreamer(fa, source.days, null, from ?? addFrom);
      return dropIds.map((id) => gainOf(marketBase, gainBuild(source, { incoming: incomingFor(player, id, from) }), id));
    },
    [source, marketBase, gainBuild, addFrom]
  );
  const marketOpenSpots = useMemo(() => (marketBase ? openSpots(marketBase) : []), [marketBase]);
  // The one-day search follows the expanded day, never a day already played.
  const firstOpenDay = addFrom ?? source?.days.find((d) => d.kind !== "past")?.index ?? 0;
  const marketDay = Math.max(focusDay ?? defaultFocus, firstOpenDay);
  // Players staged to drop are already leaving: the market offers the spot they free instead.
  const keptSource = useMemo(
    () => (source && drops.length ? { ...source, mine: source.mine.filter((p) => !drops.includes(p.id)) } : source),
    [source, drops]
  );
  const marketDrops = useMemo(() => (keptSource ? dropCandidates(keptSource, board) : []), [keptSource, board]);
  // The detail offers a few more, never the stars: a week's gain can't see what a player is worth
  // the rest of the season (an injured star projects nothing this week, and is still no drop).
  const marketAllDrops = useMemo(() => (keptSource ? dropCandidates(keptSource, board, 7) : []), [keptSource, board]);
  const avgOf = useCallback((id: number) => source?.mine.find((p) => p.id === id)?.avg ?? null, [source]);
  // Open spots once every staged drop is made (one an add rides on included, whenever it lands).
  const marketRoom = useMemo(() => {
    const b = rawToday ?? board;
    return rosterRoom(b && drops.length ? { ...b, players: b.players.filter((p) => !drops.includes(p.player_id)) } : b);
  }, [rawToday, board, drops]);
  const nameOf = useCallback((id: number) => source?.mine.find((p) => p.id === id)?.name ?? `#${id}`, [source]);
  const { setDailyDay, requestBreakouts, requestStreamers: requestPool } = data;
  useEffect(() => {
    if (marketOpen) requestPool();
  }, [marketOpen, requestPool]);
  useEffect(() => {
    setDailyDay(marketOpen && marketMode === "day" ? marketDay : null);
  }, [marketOpen, marketMode, marketDay, setDailyDay]);
  useEffect(() => {
    if (marketOpen && marketMode === "breakouts") requestBreakouts();
  }, [marketOpen, marketMode, requestBreakouts]);

  const boardById = useMemo(() => new Map((rawBoard?.players ?? []).map((p) => [p.player_id, p])), [rawBoard]);
  const dayLabel = useCallback(
    (day: number) => {
      const d = source?.days[day];
      return d ? `${d.dow} ${monthDay(d.date)}` : `day ${day + 1}`;
    },
    [source]
  );
  const editableOn = useCallback((day: number) => !!grid?.lineups.editable[day], [grid]);

  // ---- staging operations ----
  const setDay = useCallback((day: number, next: Staged) => {
    setStagedByDay((prev) => ({ ...prev, [day]: next }));
  }, []);
  const stageMovesOn = useCallback(
    (day: number, moves: ReadonlyArray<{ player_id: number; to_slot_id: number }>) => {
      const b = boards[day];
      if (b) setDay(day, stageMovesPure(b, staging[day], moves));
    },
    [boards, staging, setDay]
  );
  const stageOneOn = useCallback(
    (day: number, playerId: number, slot: number) => {
      const b = boards[day];
      if (b) setDay(day, stagePure(b, staging[day], playerId, slot));
    },
    [boards, staging, setDay]
  );

  // Pending moves per day, in day order, and what's wrong with them before ESPN is asked.
  const pending: PendingDay[] = useMemo(
    () =>
      boards.flatMap((b, day) => {
        if (!b) return [];
        const moves = diff(b, staging[day]);
        if (moves.length === 0) return [];
        return [{ day, label: dayLabel(day), moves, problems: validateStaged(b, staging[day]) }];
      }),
    [boards, staging, dayLabel]
  );
  const moveCount = pending.reduce((n, p) => n + p.moves.length, 0);
  const blockedBoard = pending.map((p) => boards[p.day]).find((b) => b && !b.can_write) ?? null;
  const movesBlocked = !data.demo && blockedBoard ? writeBlockedCopy(blockedBoard.write_blocked_reason) : null;

  // ---- today's moves: the strip in the tape, staged from there ----
  // One box open in the tape at a time: today's moves (D) or the edge's race (E).
  const [tapeBox, setTapeBox] = useState<TapeBox>(null);
  const movesTick = tickOf(tapeBox, "moves", setTapeBox);
  const edgeTick = tickOf(tapeBox, "edge", setTapeBox);
  const todayBoardNow = todayDay != null ? boards[todayDay] ?? null : null;
  const todayStaging = todayDay != null ? staging[todayDay] : NO_STAGING;
  // Rows worked out against an older board (a send, another day) are read again, once per pair of boards.
  const actionsStale = !!actionsData && boardMismatch(actionsData, todayBoardNow);
  const refetchActions = data.actions?.refetch;
  const askedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!actionsStale || !actionsData || !todayBoardNow || !refetchActions) return;
    const key = `${actionsData.roster_version}:${actionsData.scoring_period_id}>${todayBoardNow.roster_version}:${todayBoardNow.scoring_period_id}`;
    if (askedFor.current === key) return;
    askedFor.current = key;
    refetchActions();
  }, [actionsStale, actionsData, todayBoardNow, refetchActions]);
  const todayRows = useMemo<TodayRow[]>(() => {
    const cannot = !todayBoardNow
      ? "Today isn't on this week's grid"
      : actionsStale
        ? "Your lineup changed since these were worked out: reading them again"
        : null;
    return sortActions(actionsData?.actions ?? []).map((a) => {
      const staged = isTransactionAction(a) ? isAddStaged(a, pinned, NO_DROP, nowFrom) : isRowStaged(todayStaging, a);
      const drop = a.transaction?.drop_player_id ?? null;
      const gone = drop != null && !source?.mine.some((p) => p.id === drop) ? "The player to drop is no longer on your roster" : null;
      return { action: a, button: rowButton(a, { staged, cannot: cannot ?? gone }) };
    });
  }, [actionsData, todayBoardNow, actionsStale, pinned, nowFrom, todayStaging, source]);
  const onTodayButton = useCallback(
    (row: TodayRow) => {
      const a = row.action;
      if (row.button.intent === "none" || todayDay == null) return;
      if (a.transaction) {
        // An add is staged in the tray: it previews in the grid and is sent from there with the day.
        if (row.button.intent === "unstage") pin(null);
        else {
          setHover(null);
          pin({ faId: a.transaction.pickup.player_id, replaces: a.transaction.drop_player_id ?? NO_DROP, from: nowFrom });
        }
        return;
      }
      const b = boards[todayDay];
      if (!b) return;
      // One player can be named by two rows (a start benches him, the IR row sends him to IR): a press on one keeps the other.
      if (row.button.intent === "unstage") setDay(todayDay, unstageRow(b, staging[todayDay], a, actionsData?.actions ?? []));
      else setDay(todayDay, stageRow(b, staging[todayDay], a));
    },
    [todayDay, boards, staging, setDay, actionsData, pin, nowFrom]
  );
  // Stage all takes the rows that fit together; one that would overfill a slot keeps its own button.
  const stageAll = useMemo(
    () =>
      todayBoardNow && !actionsStale
        ? stageAllFold(todayBoardNow, todayStaging, unstagedLineupActions(actionsData?.actions ?? [], todayStaging))
        : null,
    [todayBoardNow, actionsStale, actionsData, todayStaging]
  );
  const stageAllCount = stageAll?.rows.length ?? 0;

  // ---- the edge's race: the margin across the week ----
  const historyPoints = data.history?.points ?? null;
  const raceColumns = useMemo(
    () =>
      grid && source?.format === "categories" && source.categories?.length
        ? categoryRace(source.categories, grid.days, historyPoints, source.weekCategories)
        : [],
    [grid, source, historyPoints]
  );
  const race = useMemo(() => {
    if (!grid || !source) return null;
    if (source.format === "categories" && source.categories?.length) return categoryRacePoints(raceColumns);
    return buildRace({ days: grid.days, you: grid.you, opp: grid.opp, now: grid.now, history: historyPoints });
  }, [grid, source, raceColumns, historyPoints]);

  const stageAllToday = useCallback(() => {
    if (todayDay == null || !stageAll) return;
    setDay(todayDay, stageAll.staged);
  }, [todayDay, stageAll, setDay]);

  // ---- cursor and menus ----
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  // The lane whose stop is being confirmed.
  const [confirm, setConfirm] = useState<{ stopLane: number } | null>(null);
  // The spot a stream lane is being set up on.
  const [laneFor, setLaneFor] = useState<{ id: number; name: string } | null>(null);

  const toggleView = useCallback(() => {
    setView((v) => (v === "daily" ? "players" : v === "players" ? "matchup" : "daily"));
    setCursor(null);
  }, []);
  const chooseView = useCallback((v: View) => {
    setView(v);
    setCursor(null);
  }, []);

  const rowByKey = useCallback((key: string) => grid?.rows.find((r) => r.key === key) ?? null, [grid]);
  const anchorFor = useCallback(
    (key: string) => root?.querySelector<HTMLElement>(`[data-rowkey="${key}"] [data-col="0"]`) ?? null,
    [root]
  );

  // The daily view keeps its own cursor (a spot and a day); only the player view moves it here.
  const openMove = useCallback(
    (key: string, el?: HTMLElement | null, day?: number) => {
      const row = rowByKey(key);
      const anchor = el ?? anchorFor(key);
      if (!row?.player || row.kind !== "player" || !anchor) return;
      if (day === undefined) setCursor({ key, col: 0 });
      setMenu({ type: "move", rowKey: key, anchor, day: day ?? viewDay, from: null });
    },
    [rowByKey, anchorFor, viewDay]
  );
  const openSeat = useCallback(
    (playerId: number, day: number, el: HTMLElement) => openMove(`player-${playerId}`, el, day),
    [openMove]
  );
  const { requestStreamers } = data;
  // In the daily view a later day's column schedules the pickup for that day.
  const openReplace = useCallback(
    (key: string, el?: HTMLElement | null, day?: number) => {
      const row = rowByKey(key);
      const anchor = el ?? anchorFor(key);
      if (!row?.player || row.kind !== "player" || !anchor) return;
      requestStreamers();
      if (view === "players") setCursor({ key, col: 0 });
      setMenu({ type: "replace", rowKey: key, anchor, day: day ?? viewDay, from: replaceFrom(day) });
    },
    [rowByKey, anchorFor, requestStreamers, view, viewDay, replaceFrom]
  );
  const closeMenu = useCallback(() => {
    setMenu(null);
    setHover(null);
  }, []);

  const menuRow = menu ? rowByKey(menu.rowKey) : null;
  const menuPlayer = menuRow?.player ?? null;

  /** The projected week if `day` had `next` staged instead. */
  const weekWith = useCallback(
    (day: number, next: Staged) => {
      if (!source || !boards[day]) return 0;
      const over = dayBoards.map((db, i) => (i === day ? { board: boards[day]!, staged: next } : db));
      return build(source, { dayBoards: over, staged: day === todayDay ? next : staged }).projected.you;
    },
    [source, boards, dayBoards, build, todayDay, staged]
  );

  // Move targets for the player in the menu on its day, each with its effect on the week.
  const moveInfo = useMemo(() => {
    if (!menu || menu.type !== "move" || !menuPlayer || !grid || !gridNoPreview) return null;
    const day = menu.day;
    // Staged to drop, he has no spot to move from: the menu offers the drop back instead.
    if (drops.includes(menuPlayer.id)) return { blocked: null, targets: [], day };
    const b = boards[day];
    const onDay = b?.players.find((p) => p.player_id === menuPlayer.id);
    let blocked: string | null = null;
    if (!board) blocked = "Lineup changes from here need an ESPN team.";
    else if (!editableOn(day)) {
      blocked =
        source?.days[day]?.kind === "past"
          ? "That day has been played."
          : mode === "best"
            ? "This day shows its best lineup. Switch to “As set on ESPN” to move players."
            : "This day's ESPN lineup hasn't loaded yet.";
    } else if (onDay?.locked) blocked = "Locked: his game has started.";
    let targets: MoveTarget[] = [];
    if (!blocked && b) {
      const base = gridNoPreview.projected.you;
      targets = eligibleTargets(b, staging[day], menuPlayer.id).map((slot) => ({
        slotId: slot,
        partner: swapPartner(b, staging[day], menuPlayer.id, slot)?.name ?? null,
        delta: weekWith(day, stagePure(b, staging[day], menuPlayer.id, slot)) - base,
      }));
    }
    return { blocked, targets, day };
  }, [menu, menuPlayer, grid, gridNoPreview, drops, boards, board, editableOn, source, mode, staging, weekWith]);

  // Free agents for the replace menu, best change to the week first.
  const replaceOptions = useMemo<ReplaceOption[]>(() => {
    if (!menu || menu.type !== "replace" || !menuPlayer) return [];
    return data.streamers
      .slice(0, MAX_REPLACE_OPTIONS)
      .map((fa) => ({ fa, gain: faGain(fa, menuPlayer.id, menu.from) }))
      .sort((a, b) => b.gain - a.gain);
  }, [menu, menuPlayer, data.streamers, faGain]);

  // ---- dragging: a move on one day's lineup ----
  /**
   * Moving `mover` into `slot` on `day`, dropped on `other` (who sits there, if
   * anyone): into spare room it's one move, onto a player it's a swap with him.
   * Null when ESPN wouldn't take it.
   */
  const planMove = useCallback(
    (day: number, moverId: number, slot: number, otherId: number | undefined): Planned | null => {
      const b = boards[day];
      if (!b || !gridNoPreview) return null;
      const mover = b.players.find((p) => p.player_id === moverId);
      const other = otherId != null ? b.players.find((p) => p.player_id === otherId) : undefined;
      if (!mover || mover.locked) return null;
      const assign = boardAssignment(b, staging[day]);
      const current = assign.get(mover.player_id) ?? mover.lineup_slot_id;
      if (slot === current || !canSit(mover, slot)) return null;
      const holders = b.players.filter((p) => assign.get(p.player_id) === slot).length;
      const spare = holders < slotCapacity(b, slot);
      let moves: Planned["moves"];
      if (!other || spare) moves = [{ player_id: mover.player_id, to_slot_id: slot }];
      else if (!other.locked && canSit(other, current)) {
        moves = [
          { player_id: mover.player_id, to_slot_id: slot },
          { player_id: other.player_id, to_slot_id: current },
        ];
      } else return null;
      return {
        slotId: slot,
        swapWith: moves.length > 1 && other ? other.name : null,
        delta: weekWith(day, stageMovesPure(b, staging[day], moves)) - gridNoPreview.projected.you,
        moves,
      };
    },
    [boards, gridNoPreview, staging, weekWith]
  );

  const drag = useMemo<DragApi | null>(() => {
    if (view !== "players" || !grid || !editableOn(viewDay)) return null;
    let last: { key: string; targets: Map<string, Planned> } | null = null;
    const targetsFor = (fromKey: string): Map<string, Planned> | null => {
      const from = grid.rows.find((r) => r.key === fromKey);
      if (!from?.player || from.kind !== "player") return null;
      const out = new Map<string, Planned>();
      for (const row of grid.rows) {
        if (row.key === fromKey || row.slotId == null || row.kind === "incoming") continue;
        const plan = planMove(viewDay, from.player.id, row.slotId, row.player?.id);
        if (plan) out.set(row.key, plan);
      }
      last = { key: fromKey, targets: out };
      return out;
    };
    return {
      targetsFor,
      onDrop: (fromKey, toKey) => {
        const plan = last?.key === fromKey ? last.targets.get(toKey) : targetsFor(fromKey)?.get(toKey);
        if (plan) stageMovesOn(viewDay, plan.moves);
      },
    };
  }, [view, grid, editableOn, viewDay, planMove, stageMovesOn]);

  const seatDrag = useMemo<SeatDragApi | null>(() => {
    if (view !== "daily" || !grid) return null;
    const { slots, seats, editable } = grid.lineups;
    if (!editable.some(Boolean)) return null;
    let last: { day: number; key: string; targets: Map<string, Planned> } | null = null;
    const targetsFor = (day: number, fromKey: string): Map<string, Planned> | null => {
      const seat = seats[day]?.[slots.findIndex((d) => d.key === fromKey)];
      if (!seat || seat.incoming || !editable[day]) return null;
      const out = new Map<string, Planned>();
      slots.forEach((def, j) => {
        if (def.key === fromKey) return;
        const occupant = seats[day][j];
        if (occupant?.incoming) return;
        const plan = planMove(day, seat.player.id, def.slotId, occupant?.player.id);
        if (plan) out.set(def.key, plan);
      });
      last = { day, key: fromKey, targets: out };
      return out;
    };
    return {
      editable,
      targetsFor,
      onDrop: (day, fromKey, toKey) => {
        const plan =
          last?.day === day && last.key === fromKey ? last.targets.get(toKey) : targetsFor(day, fromKey)?.get(toKey);
        if (plan) stageMovesOn(day, plan.moves);
      },
    };
  }, [view, grid, planMove, stageMovesOn]);

  // ---- autoslot ----
  const [autoslotting, setAutoslotting] = useState(false);
  const autoslotDay = view === "players" ? viewDay : focusDay ?? defaultFocus;
  const autoslot = useCallback(async () => {
    const day = autoslotDay;
    const b = boards[day];
    if (!b || !source || !editableOn(day)) return;
    let next: Staged;
    if (day === todayDay) {
      // Today: the server's fill-only plan, which knows locks and ESPN's rules.
      setAutoslotting(true);
      const plan = await lineup.planToday();
      setAutoslotting(false);
      if (!plan) return;
      next = planToStaged(b, plan);
    } else {
      next = bestDayStaging(b, source, day);
    }
    if (diff(b, next).length === 0) {
      toast("Nothing to change", { description: `${dayLabel(day)}'s lineup already starts everyone who plays.` });
      return;
    }
    setDay(day, next);
  }, [autoslotDay, boards, source, editableOn, todayDay, lineup, dayLabel, setDay]);

  // ---- add / drop, now or scheduled ----
  const swapOut = pinned && pinned.replaces !== NO_DROP ? source?.mine.find((p) => p.id === pinned.replaces) ?? null : null;
  const swapFa = pinned ? faById.get(pinned.faId) ?? null : null;
  const swapFrom = pinned?.from ?? null;
  /**
   * What the add / drop does to the week, made at `from` (null: now). One riding
   * on a staged drop counts that drop with it, leaving when it does: the add
   * fills the spot he frees.
   */
  const swapGain = useCallback(
    (fa: StreamerPlayer, replaces: number, from: number | null) => {
      if (paired == null || !source || todayDay == null) return faGain(fa, replaces, from);
      const base = weekFor(leaves.filter((x) => x.id !== paired), stagedByDay);
      const moved = leaves.map((x) => (x.id === paired ? { id: x.id, from: from ?? todayDay } : x));
      const player = sourceFromStreamer(fa, source.days, null, from ?? addFrom);
      return weekFor(moved, stagedByDay, incomingFor(player, replaces, from)) - base;
    },
    [paired, source, todayDay, faGain, weekFor, leaves, stagedByDay, addFrom]
  );
  const pinnedDelta = pinned && swapFa ? swapGain(swapFa, pinned.replaces, swapFrom) : 0;
  // When to make it: now, or before any later day he plays (the day picked stays on offer).
  // After today's first tip an add made now is tomorrow's pickup, so Now isn't on offer.
  const timings = useMemo<SwapTiming[]>(() => {
    if (!pinned || !swapFa || !source) return [];
    const days = source.days.filter((d) => canSchedule(d.index) && swapFa.game_days.includes(d.index)).map((d) => d.index);
    if (pinned.from != null && !days.includes(pinned.from)) days.push(pinned.from);
    days.sort((a, b) => a - b);
    return [
      ...(nowFrom == null ? [{ day: null, label: "Now", delta: swapGain(swapFa, pinned.replaces, null) }] : []),
      ...days.map((d) => ({ day: d, label: source.days[d].dow, delta: swapGain(swapFa, pinned.replaces, d) })),
    ];
  }, [pinned, swapFa, source, canSchedule, swapGain, nowFrom]);

  // ---- drops: staged on their own, made now ----
  const laneHolders = useMemo(
    () => new Set(openLanes.filter((l) => l.status === "active").map((l) => l.holder.player_id)),
    [openLanes]
  );
  /** Why this player can't be dropped now, or null when he can. */
  const dropReason = useCallback(
    (id: number) => {
      const pickup = pendingPickups.find((p) => p.drop?.player_id === id);
      return dropBlockedReason({
        player: { id, name: nameOf(id) },
        board: rawToday,
        laneHolders,
        scheduled: pickup ? { add: pickup.add.name, day: pickupDayLabel(pickup.nba_date) } : null,
        pinnedDrops: pinned?.replaces === id,
        demo: data.demo,
      });
    },
    [pendingPickups, nameOf, rawToday, laneHolders, pickupDayLabel, pinned, data.demo]
  );
  // Why a staged drop's last send failed, by player.
  const [dropErrors, setDropErrors] = useState<Record<number, string>>({});
  /** Stage a drop: his staged moves on every day are taken back, swaps and all. */
  const stageDrop = useCallback(
    (id: number) => {
      setStagedByDay((prev) => unstageEverywhere(boards, prev, id));
      setDrops((prev) => (prev.includes(id) ? prev : [...prev, id]));
    },
    [boards]
  );
  const undrop = useCallback((id: number) => {
    setDrops((prev) => prev.filter((x) => x !== id));
    setDropErrors(({ [id]: _sent, ...rest }) => rest);
  }, []);
  /** The X key: stage his drop, or take it back; a drop that can't be made says why. */
  const toggleDrop = useCallback(
    (id: number) => {
      if (drops.includes(id)) return undrop(id);
      const why = dropReason(id);
      if (why) toast(why);
      else stageDrop(id);
    },
    [drops, undrop, dropReason, stageDrop]
  );
  // The drops that go to ESPN on their own (the one an add rides on goes with the add), and
  // what they do to the week: the week now, less the week without them.
  const loneDrops = useMemo(() => (paired == null ? drops : drops.filter((id) => id !== paired)), [drops, paired]);
  const weekNow = gridNoPreview?.projected.you ?? 0;
  const loneDropsDelta = useMemo(
    () => (loneDrops.length ? weekNow - weekFor(leaves.filter((x) => !loneDrops.includes(x.id)), stagedByDay) : 0),
    [loneDrops, weekNow, weekFor, leaves, stagedByDay]
  );
  // The move menu's Drop item: what dropping him now does to the week, or why he can't be dropped.
  const dropInfo = useMemo(() => {
    if (!menu || menu.type !== "move" || !menuPlayer) return null;
    const id = menuPlayer.id;
    if (drops.includes(id)) return { dropped: true, note: null, delta: 0 };
    const note = dropReason(id);
    if (note || todayDay == null) return { dropped: false, note, delta: 0 };
    const delta = weekFor([...leaves, { id, from: todayDay }], unstageEverywhere(boards, stagedByDay, id)) - weekNow;
    return { dropped: false, note: null, delta };
  }, [menu, menuPlayer, drops, dropReason, todayDay, weekFor, leaves, boards, stagedByDay, weekNow]);

  /** The staged add / drop as the tray shows it: in the column of the day it is made. */
  const swap = useMemo<(TraySwap & { blocked: string | null; delta: number; day: number }) | null>(() => {
    if (!pinned || !swapFa || !source || !(swapOut || pinned.replaces === NO_DROP)) return null;
    // Who leaves: the player it replaces, or the staged drop it rides on.
    const rides = paired != null ? { id: paired, name: nameOf(paired) } : null;
    const out = swapOut ? { id: swapOut.id, name: swapOut.name } : rides;
    const dup = swapFrom != null ? pendingPickups.find((p) => p.add.player_id === swapFa.player_id) : undefined;
    const already = out ? pendingPickups.find((p) => p.drop?.player_id === out.id) : undefined;
    // Scheduled, locks and waivers are the server's to wait out when the day comes.
    let blocked: string | null = null;
    if (!rawToday) blocked = swapFrom != null ? "Scheduling a pickup needs an ESPN team." : "Add and drop from here need an ESPN team.";
    else if (dup) blocked = `${swapFa.name} is already scheduled for ${pickupDayLabel(dup.nba_date)}.`;
    else if (already && out) blocked = `${out.name} is already being dropped for ${already.add.name} on ${pickupDayLabel(already.nba_date)}.`;
    else if (out && laneHolders.has(out.id)) blocked = "A stream lane is streaming his spot: stop it to drop him.";
    else if (swapFrom == null && out && rawToday.players.find((p) => p.player_id === out.id)?.locked) {
      blocked = `${out.name} is locked until his game ends.`;
    } else if (swapFrom == null && swapFa.acquisition_status === "waivers") blocked = `${swapFa.name} is on waivers.`;
    else if (!data.demo && !rawToday.can_write) blocked = writeBlockedCopy(rawToday.write_blocked_reason);
    else if (!out && rosterRoom(rawToday) === 0) blocked = "Your roster is full: pick someone to drop.";
    const fromDow = swapFrom != null ? source.days[swapFrom]?.dow ?? "" : "";
    const leaving = swapOut ?? (rides ? source.mine.find((p) => p.id === rides.id) ?? null : null);
    return {
      add: {
        id: swapFa.player_id,
        name: swapFa.name,
        team: swapFa.team,
        games:
          swapFrom != null
            ? `${swapFa.game_days.filter((d) => d >= swapFrom).length} games from ${fromDow}`
            : `${swapFa.games_remaining} games left`,
      },
      drop: out ? { ...out, staged: rides != null || undefined } : null,
      from: swapFrom,
      timings,
      timing: swapFrom != null ? pickupTiming(source.days, swapFrom, leaving, todayIndex, addFrom) : null,
      blocked,
      delta: pinnedDelta,
      // Made now, it sits in today's column (or one of its own when today isn't on the board).
      day: swapFrom ?? todayDay ?? NOW_DAY,
    };
  }, [pinned, swapFa, source, swapOut, paired, nameOf, swapFrom, pendingPickups, rawToday, laneHolders, data.demo, pickupDayLabel, timings, todayIndex, addFrom, pinnedDelta, todayDay]);

  const [swapError, setSwapError] = useState<string | null>(null);
  /**
   * Make (or schedule) the add / drop, pinned to `today` (today's board as ESPN
   * holds it now), with the staged drop it rides on, if any. "ok" takes it off
   * the tray; "stale" (the board moved on ESPN, so the preview no longer
   * applies) lets it go, giving back a drop it took over.
   */
  const sendSwap = useCallback(
    async (today: LineupState | null): Promise<"ok" | "stale" | "refused"> => {
      if (!pinned || !today) return "refused";
      const drop = pinned.replaces !== NO_DROP ? pinned.replaces : paired;
      let outcome: "ok" | "stale" | "refused";
      if (pinned.from != null) outcome = swapFa ? await data.schedulePickup(swapFa, drop, pinned.from) : "refused";
      else {
        const r = await data.transact(pinned.faId, drop, today);
        outcome = r.status;
        setSwapError(r.status === "refused" ? r.message : null);
      }
      if (outcome === "ok") {
        setPinned(null);
        if (paired != null) setDrops((prev) => prev.filter((x) => x !== paired));
      } else if (outcome === "stale") pin(null);
      return outcome;
    },
    [pinned, paired, data, swapFa, pin]
  );
  // A different add / drop starts without the last one's error.
  const swapKey = pinned ? `${pinned.faId}:${pinned.replaces}:${pinned.from}` : null;
  const { clearTransactError, clearScheduleError } = data;
  useEffect(() => {
    clearTransactError();
    clearScheduleError();
    setSwapError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapKey]);

  // ---- the tray: everything staged, by day, confirmed and sent from there ----
  const [sendingDay, setSendingDay] = useState<number | null>(null);
  const [trayHeight, setTrayHeight] = useState(0);
  const [dayErrors, setDayErrors] = useState<Record<number, string>>({});
  // The column drops made now sit in: today's, or one of their own when today isn't on the board.
  const nowColumn = todayDay ?? NOW_DAY;
  const dropDay = useCallback((day: number) => {
    setStagedByDay((prev) => {
      const out = { ...prev };
      delete out[day];
      return out;
    });
  }, []);
  /**
   * Write the chosen days' lineups, earliest first; stop at the first one ESPN refuses
   * (`sendLineupDays`). After a roster change made now the boards on screen are behind
   * the roster: every day is read again before its write. While drops are still staged
   * (`waiting`), a day whose moves don't fit the roster with them on it waits for them.
   */
  const sendDays = useCallback(
    async (chosen: number[], rosterChanged: boolean, waiting: readonly number[]) => {
      const order = pending.filter((p) => chosen.includes(p.day));
      if (order.length === 0) return;
      setDayErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([d]) => !chosen.includes(Number(d)))));
      const snapshot = { ...stagedByDay };
      const fresh = new Map<number, LineupState | null>();
      if (rosterChanged) {
        await Promise.all(order.map(async (p) => fresh.set(p.day, await lineup.refresh(p.day).catch(() => null))));
      }
      // Each write is pinned to the lineup ESPN holds: read again, or as read before any drop.
      const boardOf = (day: number) => fresh.get(day) ?? rawBoards[day];
      const held = waiting.length
        ? order.filter((p) => {
            const b = boardOf(p.day);
            return !!b && validateStaged(b, normalize(b, snapshot[p.day] ?? NO_STAGING)).length > 0;
          })
        : [];
      if (held.length) {
        const who = waiting.map((id) => shortName(nameOf(id)));
        const note = who.length === 1 ? `Waits on ${who[0]}'s drop` : `Waits on the drops of ${who.join(" and ")}`;
        setDayErrors((prev) => ({ ...prev, ...Object.fromEntries(held.map((p) => [p.day, note])) }));
      }
      const go = order.filter((p) => !held.includes(p));
      if (go.length === 0) return;
      const { done, failed } = await sendLineupDays(go, {
        board: boardOf,
        moves: (day, b) => diff(b, normalize(b, snapshot[day] ?? NO_STAGING)),
        apply: lineup.apply,
        refresh: lineup.refresh,
        settle: lineup.settle,
        onSending: setSendingDay,
        onDone: dropDay,
      });
      const sent = done.map((p) => p.label);
      if (failed) {
        const e = toApiError(failed.error);
        const reasons = e.code === ROSTER_MOVE_INVALID ? ((e.data as { errors?: MoveError[] } | null)?.errors ?? []) : [];
        setDayErrors((prev) => ({ ...prev, [failed.step.day]: reasons[0]?.message ?? userMessage(failed.error) }));
        if (sent.length) toast.success(`Lineup updated for ${sent.join(", ")}; ${failed.step.label} was refused`);
        return;
      }
      if (sent.length === 0) return;
      if (data.demo) toast.success(`Lineup updated (demo): ${sent.join(", ")}`);
      else toast.success(`Lineup updated on ESPN for ${sent.join(", ")}`);
    },
    [pending, stagedByDay, rawBoards, lineup, data.demo, dropDay, nameOf]
  );
  /**
   * Send the confirmed days. Today's drops go first, one ESPN call each, then the
   * add / drop (with the drop it rides on), then the lineups in day order. Each
   * call after a roster change is pinned to today's board read again: a drop
   * moves the roster version the next request must match. A refused drop holds
   * back only what needs it: the add riding on it (sent together, they fail
   * together) and a day whose moves need his spot. A refused add / drop stops
   * the send, as a refused day does: the lineups confirmed with it stay in the
   * tray, with its error, for a retry. The tray stays locked from the first
   * write to the last, so nothing is sent twice or discarded under a send.
   */
  const sendAll = useCallback(
    async (chosen: number[]) => {
      const dropsFirst = chosen.includes(nowColumn) ? loneDrops : [];
      const first = swap && !swap.blocked && chosen.includes(swap.day) ? swap : null;
      setSendingDay(dropsFirst.length ? nowColumn : first ? first.day : chosen[0] ?? null);
      try {
        let today = rawToday;
        let moved = false;
        const readToday = async () => {
          if (moved && todayDay != null) today = (await lineup.refresh(todayDay).catch(() => null)) ?? today;
          moved = false;
        };
        let rosterChanged = false;
        let waiting = drops;
        if (dropsFirst.length) {
          const made: number[] = [];
          const errors: Record<number, string> = {};
          for (const id of dropsFirst) {
            await readToday();
            if (!today) break;
            const r = await data.transact(null, id, today);
            if (r.status === "ok") made.push(id);
            else errors[id] = r.status === "stale" ? "Your roster changed on ESPN: check it, then send again." : r.message;
            moved = r.status !== "refused";
          }
          rosterChanged = made.length > 0;
          waiting = waiting.filter((id) => !made.includes(id));
          setDrops((prev) => prev.filter((id) => !made.includes(id)));
          setDropErrors(errors);
        }
        if (first) {
          setSendingDay(first.day);
          await readToday();
          const outcome = await sendSwap(today);
          if (outcome === "refused") return;
          if (first.from == null) rosterChanged = true;
          // Only an add / drop made now frees the spot. Scheduled, the drop rides on the pickup and
          // he stays on ESPN's roster until its day, so a lineup that needs his spot still waits.
          if (outcome === "ok" && first.from == null && paired != null) waiting = waiting.filter((id) => id !== paired);
        }
        await sendDays(chosen, rosterChanged, waiting);
      } finally {
        setSendingDay(null);
      }
    },
    [rawToday, todayDay, lineup, drops, nowColumn, loneDrops, data, swap, sendSwap, paired, sendDays]
  );
  const trayDays = useMemo<TrayDay[]>(() => {
    const columns = new Map<number, TrayDay>();
    const column = (day: number): TrayDay => {
      const d = source?.days[day];
      return (
        columns.get(day) ?? {
          day,
          dow: d?.dow ?? "Now",
          date: d ? monthDay(d.date) : "",
          moves: [],
          drops: [],
          swap: null,
          delta: 0,
          problems: [],
          error: null,
        }
      );
    };
    for (const p of pending) {
      const d = source?.days[p.day];
      const names = new Map((boards[p.day]?.players ?? []).map((x) => [x.player_id, x.name]));
      columns.set(p.day, {
        day: p.day,
        dow: d?.dow ?? p.label,
        date: d ? monthDay(d.date) : "",
        moves: p.moves.map((m) => ({
          playerId: m.player_id,
          name: names.get(m.player_id) ?? `#${m.player_id}`,
          from: m.from_slot_id,
          to: m.to_slot_id,
          role: moveRole(m),
        })),
        drops: [],
        swap: null,
        // What this day's own moves add: the week with them, less the week without.
        delta: gridNoPreview ? gridNoPreview.projected.you - weekWith(p.day, NO_STAGING) : 0,
        problems: p.problems.map((e) => e.message),
        error: dayErrors[p.day] ?? null,
      });
    }
    if (loneDrops.length) {
      const col = column(nowColumn);
      const failed = loneDrops.map((id) => dropErrors[id]).find(Boolean) ?? null;
      columns.set(nowColumn, {
        ...col,
        drops: loneDrops.map((id) => ({ id, name: nameOf(id) })),
        delta: col.delta + loneDropsDelta,
        // A drop that can't be made now (his game started since, a lane took his spot) keeps the column back.
        problems: [...col.problems, ...loneDrops.map(dropReason).filter((r): r is string => r != null)],
        // Why a drop failed says more than the days waiting on it.
        error: failed ?? col.error,
      });
    }
    if (swap) {
      const col = column(swap.day);
      const { blocked, delta, day: _day, ...rest } = swap;
      columns.set(swap.day, {
        ...col,
        swap: rest,
        delta: col.delta + delta,
        problems: blocked ? [...col.problems, blocked] : col.problems,
        error: col.error ?? (swap.from != null ? data.scheduleError : swapError),
      });
    }
    return [...columns.values()].sort((a, b) => a.day - b.day);
  }, [pending, source, boards, gridNoPreview, weekWith, dayErrors, loneDrops, nowColumn, dropErrors, nameOf, loneDropsDelta, dropReason, swap, data.scheduleError, swapError]);

  // Hovering a pending pickup previews it (the pool has to know him first).
  const previewPickup = useCallback(
    (id: number | null) => {
      const p = id != null ? pendingPickups.find((x) => x.id === id) : null;
      const day = p ? pickupDay(p.nba_date) : null;
      if (!p || !day) {
        setHover(null);
        return;
      }
      requestPool();
      if (!faById.has(p.add.player_id)) return;
      setHover({ faId: p.add.player_id, replaces: p.drop?.player_id ?? NO_DROP, from: day.index, pickup: p.id });
    },
    [pendingPickups, pickupDay, requestPool, faById]
  );

  // ---- stream lanes: set one up on a spot, run each open one from its row ----
  const lastDow = source ? source.days[source.days.length - 1]?.dow ?? null : null;
  /** Why this player's spot can't be streamed, or null when it can. */
  const streamable = useCallback(
    (playerId: number): string | null => {
      if (!data.demo && !rawToday) return "Stream lanes need an ESPN team.";
      if (drops.includes(playerId)) return "He's staged to drop.";
      const room = laneRoomRefusal(openLanes, playerId);
      if (room) return room;
      if (boardById.get(playerId)?.lineup_slot_id === IR_SLOT_ID) return "A player on IR holds no spot to stream.";
      return null;
    },
    [data.demo, rawToday, drops, openLanes, boardById]
  );
  const { updateLane, clearLaneError } = data;
  const laneModels: LaneRowModel[] = useMemo(() => {
    if (!source) return [];
    const label = (date: string) => source.days.find((d) => d.date === date)?.dow ?? monthDay(date);
    return openLanes.flatMap((lane) => {
      const cells = laneCellsById.get(lane.id);
      if (!cells) return [];
      const proj = lane.projection;
      let summary: string;
      if (lane.status === "paused") summary = `paused: ${laneReason(lane.reason) ?? "paused"}`;
      else if (proj) {
        // Lanes planned together share the adds left.
        const others = (proj.lanes ?? 1) - 1;
        const shared = others > 0 ? `, shared with ${others} other lane${others === 1 ? "" : "s"}` : "";
        const adds = `${proj.adds} add${proj.adds === 1 ? "" : "s"} planned${proj.adds_left != null ? ` of ${proj.adds_left} left${shared}` : ""}`;
        const next = lane.next_decision_at ? ` · next decision ${whenTime(lane.next_decision_at)}` : "";
        summary = `${signed(proj.gain)} projected · ${adds} · as of ${whenTime(proj.as_of)}${next} · re-planned before each day`;
      } else summary = "waiting for its first decision";
      return [
        {
          lane,
          cells,
          summary,
          history: [...lane.events].sort((a, b) => b.id - a.id).map((e) => eventLine(e, label)),
          busy: data.laneBusy,
          container: root,
          onPreview: (on: boolean) => {
            if (on) requestPool();
            setLaneHover((cur) => (on ? lane.id : cur === lane.id ? null : cur));
          },
          onPause: () => updateLane(lane.id, { status: "paused" }),
          onResume: () => updateLane(lane.id, { status: "active" }),
          onNotify: (mode: LaneNotify) => updateLane(lane.id, { notify: mode }),
          onStop: () => setConfirm({ stopLane: lane.id }),
        },
      ];
    });
  }, [openLanes, source, laneCellsById, data.laneBusy, root, requestPool, updateLane]);
  const stoppingLane = confirm ? openLanes.find((l) => l.id === confirm.stopLane) ?? null : null;
  // A poll can end the lane under its dialog, which closes without onOpenChange: let go of the
  // confirmation so the desk keys work again.
  useEffect(() => {
    if (confirm && !stoppingLane) setConfirm(null);
  }, [confirm, stoppingLane]);
  const closeLaneSheet = useCallback(() => {
    setLaneFor(null);
    clearLaneError();
  }, [clearLaneError]);

  // ---- keyboard ----
  useEffect(() => {
    if (!grid) return;
    const onKey = (e: KeyboardEvent) => {
      if (menu || confirm || laneFor || e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Keys typed in a field or a menu belong to it (a menu's Enter also reaches
      // window after the menu has closed and this listener has re-subscribed).
      const target = e.target as HTMLElement | null;
      if (keyStaysIn(target, e.key)) return;
      if ((e.key === "Enter" || e.key === " ") && target?.closest("button, a")) return;

      // Keys that work the same in both views.
      switch (e.key) {
        case "a":
          void autoslot();
          return;
        case "l":
          toggleMode();
          return;
        case "v":
          toggleView();
          return;
        case "p":
          toggleMarket();
          return;
        case "h":
          setHeat((h) => !h);
          return;
        case "t":
          toggleTheme();
          return;
        case "d":
        case "e": {
          const tick = e.key === "d" ? "moves" : "edge";
          if (tick === "moves" && !data.actions) return;
          setTapeBox((b) => (b?.tick === tick && b.how !== "hover" ? null : { tick, how: "keyboard" }));
          return;
        }
        case "Escape":
          // A staged add / drop is the tray's to take back, like a staged lineup move.
          if (tapeBox) setTapeBox(null);
          else setCursor(null);
          return;
      }

      if (view === "matchup") {
        // One day at a time: the arrows and [ ] step it, shared with the daily view's expanded day.
        const lastDay = grid.days.length - 1;
        const at = focusDay ?? defaultFocus;
        if (e.key === "[" || e.key === "ArrowLeft") {
          e.preventDefault();
          setFocusPick(Math.max(0, at - 1));
        } else if (e.key === "]" || e.key === "ArrowRight") {
          e.preventDefault();
          setFocusPick(Math.min(lastDay, at + 1));
        }
        return;
      }

      if (view === "daily") {
        // The cursor is a lineup spot (row) on a day (column); [ and ] move the expanded day.
        const { slots, seats } = grid.lineups;
        const lastDay = grid.days.length - 1;
        const at = cursor ? Math.max(0, slots.findIndex((d) => d.key === cursor.key)) : -1;
        const day = cursor?.col ?? focusDay ?? defaultFocus;
        const go = (r: number, c: number) => {
          const def = slots[Math.min(slots.length - 1, Math.max(0, r))];
          if (!def) return;
          const col = Math.min(lastDay, Math.max(0, c));
          setCursor({ key: def.key, col });
          // The expanded day follows the cursor, unless every day is collapsed.
          if (focusDay != null) setFocusPick(col);
        };
        const seatHere = () => (cursor ? seats[cursor.col]?.[slots.findIndex((d) => d.key === cursor.key)] ?? null : null);
        const seatEl = () =>
          cursor ? root?.querySelector<HTMLElement>(`[data-slotkey="${cursor.key}"] [data-day="${cursor.col}"]`) ?? null : null;
        switch (e.key) {
          case "ArrowDown":
            e.preventDefault();
            go(at < 0 ? 0 : at + 1, day);
            return;
          case "ArrowUp":
            e.preventDefault();
            go(at < 0 ? 0 : at - 1, day);
            return;
          case "ArrowRight":
            e.preventDefault();
            go(Math.max(0, at), at < 0 ? day : day + 1);
            return;
          case "ArrowLeft":
            e.preventDefault();
            go(Math.max(0, at), day - 1);
            return;
          case "[":
            setFocusPick(Math.max(0, (focusDay ?? defaultFocus) - 1));
            return;
          case "]":
            setFocusPick(Math.min(lastDay, (focusDay ?? defaultFocus) + 1));
            return;
          case "Enter":
          case "m": {
            const seat = seatHere();
            // A player staged to drop opens his menu too: it takes the drop back.
            if (!seat || seat.incoming || (seat.outgoing && !seat.dropped) || !cursor) return;
            e.preventDefault();
            openMove(`player-${seat.player.id}`, seatEl(), cursor.col);
            return;
          }
          case "x": {
            const seat = seatHere();
            if (seat && !seat.incoming && (!seat.outgoing || seat.dropped)) toggleDrop(seat.player.id);
            return;
          }
          case "r": {
            const seat = seatHere();
            if (seat && !seat.incoming && !seat.outgoing && cursor) openReplace(`player-${seat.player.id}`, seatEl(), cursor.col);
            return;
          }
          case "s": {
            const seat = seatHere();
            if (seat && !seat.incoming && !seat.outgoing && streamable(seat.player.id) === null) {
              setLaneFor({ id: seat.player.id, name: seat.player.name });
            }
            return;
          }
        }
        return;
      }

      const rows = grid.rows;
      const lastCol = grid.days.length + 1;
      const at = cursor ? Math.max(0, rows.findIndex((r) => r.key === cursor.key)) : -1;
      const col = cursor?.col ?? 0;
      const go = (r: number, c: number) => {
        const row = rows[Math.min(rows.length - 1, Math.max(0, r))];
        if (row) setCursor({ key: row.key, col: Math.min(lastCol, Math.max(0, c)) });
      };
      const stepDay = (dir: number) => {
        const i = viewableList.indexOf(viewDay) + dir;
        if (i >= 0 && i < viewableList.length) setViewDay(viewableList[i]);
      };
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          go(at < 0 ? 0 : at + 1, col);
          return;
        case "ArrowUp":
          e.preventDefault();
          go(at < 0 ? 0 : at - 1, col);
          return;
        case "ArrowRight":
          e.preventDefault();
          go(Math.max(0, at), at < 0 ? 0 : col + 1);
          return;
        case "ArrowLeft":
          e.preventDefault();
          go(Math.max(0, at), col - 1);
          return;
        case "Enter":
          if (!cursor) return;
          e.preventDefault();
          if (cursor.col === 0) openMove(cursor.key);
          else if (cursor.col <= grid.days.length && viewable.has(cursor.col - 1)) setViewDay(cursor.col - 1);
          return;
        case "m":
          if (cursor) openMove(cursor.key);
          return;
        case "r":
          if (cursor) openReplace(cursor.key);
          return;
        case "x": {
          const row = cursor ? rows.find((r) => r.key === cursor.key) : null;
          if (row?.player && row.kind === "player" && (!row.outgoing || row.dropped)) toggleDrop(row.player.id);
          return;
        }
        case "[":
          stepDay(-1);
          return;
        case "]":
          stepDay(1);
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [grid, menu, confirm, cursor, viewable, viewableList, viewDay, view, focusDay, defaultFocus, root, openMove, openReplace, autoslot, toggleTheme, toggleMode, toggleView, toggleMarket, streamable, toggleDrop, laneFor, tapeBox, data.actions]);

  // ---- render ----
  const liveMine = grid && todayIndex != null ? grid.rows.filter((r) => r.player && r.cells[todayIndex]?.state === "live").length : 0;
  const tonight = useMemo(() => {
    if (!grid || todayIndex == null) return { live: 0, toTip: 0, nextTip: null };
    const cells = grid.rows.filter((r) => r.player && r.kind !== "incoming").map((r) => r.cells[todayIndex]);
    const tips = cells.filter((c) => c.state === "upcoming" && c.counts && c.note).map((c) => c.note!).sort();
    return {
      live: cells.filter((c) => c.state === "live" && c.counts).length,
      toTip: cells.filter((c) => c.state === "upcoming" && c.counts).length,
      nextTip: tips[0] ?? null,
    };
  }, [grid, todayIndex]);

  const toolbarNote =
    view === "matchup"
      ? todayIndex != null && (focusDay ?? defaultFocus) === todayIndex
        ? "Live box scores, refreshed every 30 s while games are on · the spot's leader is underlined"
        : "Spot against spot · the leader is underlined"
      : view === "daily"
      ? mode === "best"
        ? "Each day shows its best lineup for that day's games"
        : "Each day as set on ESPN · an edit carries into later days until a day has its own"
      : mode === "best"
        ? viewDay !== todayIndex
          ? "Planned: the best lineup for that day's games"
          : "Later days show the best lineup for their games"
        : "Each day as set on ESPN";

  let body: React.ReactNode;
  if (data.status === "signed-out") {
    body = (
      <EmptyState
        title="Sign in to see your week"
        body="The week grid reads your team's matchup, roster and schedule."
        action={<Link href="/account" className={`${dk.btn} ${dk.btnPrimary}`} style={{ textDecoration: "none" }}>Sign in</Link>}
      />
    );
  } else if (data.status === "no-team") {
    body = (
      <EmptyState
        title="Add a team to see its week"
        body="Add an ESPN or Yahoo team and its matchup week shows up here."
        action={
          data.addTeam ? (
            <button type="button" className={`${dk.btn} ${dk.btnPrimary}`} onClick={data.addTeam}>
              Add a team
            </button>
          ) : (
            <Link href="/account?add" className={`${dk.btn} ${dk.btnPrimary}`} style={{ textDecoration: "none" }}>
              Add a team
            </Link>
          )
        }
      />
    );
  } else if (data.status === "loading") {
    body = <LoadingGrid />;
  } else if (data.status === "error") {
    body = (
      <EmptyState
        title="Couldn't load this week"
        body={data.message ?? "Something went wrong reading the matchup."}
        action={<button type="button" className={dk.btn} onClick={data.refetch}>Try again</button>}
      />
    );
  } else if (data.status === "empty" || !grid || !source) {
    body = (
      <EmptyState
        title="No matchup week yet"
        body="Your league's first matchup period hasn't been scheduled. The grid fills in once it is."
      />
    );
  } else {
    body = (
      <>
        <Tape
          grid={grid}
          stagedDelta={stagedDelta}
          stagedCount={moveCount}
          dropCount={drops.length}
          previewDelta={previewDelta}
          tonight={tonight}
          edge={
            race ? (
              <EdgeTick
                race={race}
                format={source.format === "categories" && source.categories?.length ? "categories" : "points"}
                categories={source.categories ?? []}
                columns={raceColumns}
                days={grid.days}
                youName={source.you.name}
                oppName={source.opp.name}
                lineupNote={mode === "best" ? "best lineups" : "lineups as set"}
                open={edgeTick.open}
                onOpen={edgeTick.onOpen}
                container={root}
              />
            ) : null
          }
          today={
            data.actions ? (
              <TodayStrip
                status={actionsData ? "ready" : data.actions.error ? "error" : "loading"}
                rows={todayRows}
                error={data.actions.error}
                hint={actionsStale ? "Your lineup changed since these were worked out: reading them again." : actionsData ? streamersHint(actionsData) : null}
                dayLabel={todayDay != null ? dayLabel(todayDay) : "Today"}
                open={movesTick.open}
                onOpen={movesTick.onOpen}
                onButton={onTodayButton}
                onStageAll={stageAllCount >= 2 ? stageAllToday : null}
                stageAllCount={stageAllCount}
                onRetry={data.actions.refetch}
                container={root}
              />
            ) : null
          }
        />
        <Toolbar
          days={grid.days}
          todayIndex={todayIndex}
          rail={
            view === "players"
              ? { day: viewDay, enabled: viewable, onDay: setViewDay }
              : view === "matchup"
                ? { day: focusDay ?? defaultFocus, enabled: null, onDay: (d) => setFocusPick(d) }
                : null
          }
          canAutoslot={editableOn(autoslotDay)}
          autoslotLabel={dayLabel(autoslotDay)}
          mode={mode}
          onMode={toggleMode}
          bestGain={bestGain}
          autoslotting={autoslotting}
          onAutoslot={() => void autoslot()}
          heat={heat}
          onHeat={() => setHeat((h) => !h)}
          note={toolbarNote}
          view={view}
          onView={chooseView}
          market={marketOpen}
          onMarket={toggleMarket}
        />
        <div className={s.work}>
        {/* An open tray floats over the view's bottom; the view scrolls its last rows clear of it. */}
        <div
          className={s.workMain}
          data-tray-open={trayDays.length ? true : undefined}
          style={trayDays.length ? { ["--tray-h" as string]: `${trayHeight}px` } : undefined}
        >
        {view === "matchup" ? (
          <MatchupView
            grid={grid}
            source={source}
            day={focusDay ?? defaultFocus}
            todayIndex={todayIndex}
            onDay={(d) => setFocusPick(d)}
          />
        ) : view === "daily" ? (
          <DailyGrid
            grid={grid}
            todayIndex={todayIndex}
            boards={boards}
            focusDay={focusDay}
            onFocusDay={onFocusDay}
            cursor={cursor}
            onCursor={setCursor}
            heat={heat}
            youName={source.you.name}
            oppName={source.opp.name}
            onSeat={openSeat}
            drag={seatDrag}
            pickups={pickupRows}
            onPreviewPickup={previewPickup}
            onCancelPickup={data.cancelPickup}
            cancelling={data.cancelling}
            lanes={laneModels}
          />
        ) : (
          <WeekGrid
            grid={grid}
            todayIndex={todayIndex}
            viewable={viewable}
            boardById={boardById}
            cursor={cursor}
            onCursor={setCursor}
            heat={heat}
            youName={source.you.name}
            oppName={source.opp.name}
            onViewDay={setViewDay}
            onMove={openMove}
            onReplace={openReplace}
            drag={drag}
            mode={mode}
          />
        )}
        {trayDays.length ? (
          <Tray
            days={trayDays}
            blocked={movesBlocked}
            sendingDay={sendingDay}
            onUnstage={(day, playerId) => {
              const b = boards[day];
              if (b) setDay(day, unstagePure(b, staging[day], playerId));
            }}
            onUndrop={undrop}
            onDiscardDay={(day) => {
              dropDay(day);
              // Today's column holds the drops: they go with it (and the add riding on one stays, short a spot).
              if (day === nowColumn) {
                setDrops([]);
                setDropErrors({});
              }
              if (swap?.day === day) {
                if (day === nowColumn) setPinned(null);
                else pin(null);
              }
            }}
            onDiscardAll={() => {
              setStagedByDay({});
              setPinned(null);
              setDrops([]);
              setDropErrors({});
            }}
            onTiming={(day) => pinned && pin({ ...pinned, from: day })}
            onCancelSwap={() => pin(null)}
            onSend={sendAll}
            onHeight={setTrayHeight}
          />
        ) : null}
        </div>
        {marketOpen ? (
          <MarketPane
            days={grid.days}
            todayIndex={todayIndex}
            open={marketOpenSpots}
            addFrom={addFrom}
            lineupMode={mode}
            mode={marketMode}
            onMode={setMarketMode}
            day={marketDay}
            onDay={(d) => setFocusPick(d)}
            pool={data.streamers}
            poolLoading={data.streamersLoading}
            daily={data.daily}
            dailyLoading={data.dailyLoading}
            breakouts={data.breakouts}
            breakoutsLoading={data.breakoutsLoading}
            evaluate={evaluate}
            drops={marketDrops}
            allDrops={marketAllDrops}
            room={marketRoom}
            nameOf={nameOf}
            avgOf={avgOf}
            pinned={pinned}
            pinnedBlocked={swap?.blocked ?? null}
            scheduled={scheduledFa}
            // A pick keeps its day while it stays on the same free agent; a new one is made now.
            onHover={(pick: MarketPick | null) => setHover(pick ? { ...pick, from: pinned?.faId === pick.faId ? pinned.from : nowFrom } : null)}
            onPin={(pick: MarketPick | null) => {
              setHover(null);
              pin(pick ? { ...pick, from: pinned?.faId === pick.faId ? pinned.from : nowFrom } : null);
            }}
            onClose={closeMarket}
          />
        ) : null}
        </div>
      </>
    );
  }

  return (
    <div ref={setRoot} className={dk.desk}>
      <Bar
        teams={data.teams}
        teamId={data.teamId}
        onTeam={data.selectTeam}
        onAdd={data.addTeam ?? undefined}
        notice={data.notice}
        period={source?.period ?? null}
        days={source?.days ?? []}
        oppName={source?.opp.name ?? null}
        liveGames={liveMine}
        demo={data.demo}
        onRefresh={data.refetch}
        container={root}
      />
      {body}
      <StatusLine watch={data.updatedFrom} demo={data.demo} />

      {menu?.type === "move" && menuPlayer && moveInfo ? (
        <MoveMenu
          anchor={menu.anchor}
          container={root}
          onClose={closeMenu}
          player={menuPlayer}
          currentSlot={`${dayLabel(moveInfo.day)} · ${menuRow?.slot ?? ""}`}
          targets={moveInfo.targets}
          blocked={moveInfo.blocked}
          scheduleFor={(() => {
            const from = replaceFrom(menu.day);
            return from != null ? source?.days[from]?.dow ?? null : null;
          })()}
          drop={
            dropInfo
              ? {
                  name: shortName(menuPlayer.name),
                  delta: dropInfo.delta,
                  note: dropInfo.note,
                  staged: dropInfo.dropped,
                  onToggle: () => {
                    toggleDrop(menuPlayer.id);
                    closeMenu();
                  },
                }
              : null
          }
          onStream={
            streamable(menuPlayer.id) === null
              ? () => {
                  const who = { id: menuPlayer.id, name: menuPlayer.name };
                  closeMenu();
                  setLaneFor(who);
                }
              : undefined
          }
          streamThrough={lastDow}
          streamNote={streamable(menuPlayer.id)}
          onPick={(slot) => {
            stageOneOn(moveInfo.day, menuPlayer.id, slot);
            closeMenu();
          }}
          onReplace={() => {
            const key = menu.rowKey;
            const anchor = menu.anchor;
            const day = menu.day;
            closeMenu();
            openReplace(key, anchor, day);
          }}
        />
      ) : null}
      {menu?.type === "replace" && menuPlayer && source ? (
        <ReplaceMenu
          anchor={menu.anchor}
          container={root}
          onClose={closeMenu}
          player={menuPlayer}
          days={source.days}
          options={replaceOptions}
          loading={data.streamersLoading}
          highlighted={hover?.faId ?? null}
          from={menu.from}
          onHighlight={(id) => setHover(id != null ? { faId: id, replaces: menuPlayer.id, from: menu.from } : null)}
          onPick={(fa) => {
            pin({ faId: fa.player_id, replaces: menuPlayer.id, from: menu.from });
            closeMenu();
          }}
        />
      ) : null}

      <LaneSheet
        player={laneFor}
        container={root}
        demo={data.demo}
        onClose={closeLaneSheet}
        load={() => data.planLane(laneFor!.id, firstOpenDay)}
        onStart={(notify, plan) => data.startLane(laneFor!.id, notify, plan)}
        starting={data.startingLane}
        error={data.laneError}
      />
      <ConfirmDialog
        open={!!stoppingLane}
        onOpenChange={(open) => !open && setConfirm(null)}
        container={root}
        title={stoppingLane ? `Stop streaming ${shortName(stoppingLane.holder.name)}'s spot?` : ""}
        body={
          data.demo
            ? "Demo: the lane stops here only."
            : "The lane stops deciding. The player holding the spot stays on your roster, and a pickup the lane scheduled that hasn't run yet is cancelled."
        }
        lines={
          stoppingLane?.projection
            ? [{ key: "gain", left: <span className={dk.sub}>Its projection for the rest of the matchup</span>, right: <span className={`${dk.chip} ${dk.pv}`}>{signed(stoppingLane.projection.gain)}</span> }]
            : []
        }
        confirmLabel="Stop the lane"
        busy={data.laneBusy}
        error={null}
        onConfirm={() => {
          if (!stoppingLane) return;
          void data.stopLane(stoppingLane.id).then((outcome) => outcome === "ok" && setConfirm(null));
        }}
      />
    </div>
  );
}

/**
 * ESPN's seat rule, as the lineup editor applies it: the bench takes anyone,
 * any other slot must be in the player's list, and IR needs an injured player.
 */
function canSit(player: LineupPlayer, slot: number): boolean {
  if (slot === BENCH_SLOT_ID) return true;
  if (!player.eligible_slot_ids.includes(slot)) return false;
  return slot !== IR_SLOT_ID || isInjured(player);
}

/**
 * The best lineup for a later day, as staging on that day's ESPN lineup:
 * everyone healthy with a game seated to maximize projected points; players
 * who don't play keep a spot that's still free, else go to the bench (ESPN's
 * bench is unbounded, so a spot may stay empty); IR untouched.
 */
function bestDayStaging(board: LineupState, source: WeekSource, day: number): Staged {
  const avgOf = new Map(source.mine.map((p) => [p.id, p.avg]));
  const playing = board.players.filter((p) => {
    if (p.lineup_slot_id === IR_SLOT_ID) return false;
    const g = source.mine.find((m) => m.id === p.player_id)?.games[day];
    return !!g && !g.out && !isOutStatus(p.injury_status);
  });
  const slots = board.slots.filter((x) => isActiveSlot(x.slot_id) && x.count > 0).map((x) => ({ slotId: x.slot_id, count: x.count }));
  const plan = planDay(
    playing.map((p) => ({ id: p.player_id, avg: avgOf.get(p.player_id) ?? p.avg_points, eligible: p.eligible_slot_ids.filter(isActiveSlot) })),
    slots
  );
  // Players who don't play stay where they sit while it's free.
  const used = new Map<number, number>();
  for (const slot of plan.values()) used.set(slot, (used.get(slot) ?? 0) + 1);
  const free = (slot: number) => (board.slots.find((x) => x.slot_id === slot)?.count ?? 0) - (used.get(slot) ?? 0);
  const target: Staged = {};
  for (const [id, slot] of plan) target[id] = slot;
  const rest = board.players.filter((p) => !plan.has(p.player_id) && p.lineup_slot_id !== IR_SLOT_ID);
  for (const p of rest) {
    const keep = isActiveSlot(p.lineup_slot_id) && free(p.lineup_slot_id) > 0 ? p.lineup_slot_id : null;
    const slot = keep ?? BENCH_SLOT_ID;
    target[p.player_id] = slot;
    used.set(slot, (used.get(slot) ?? 0) + 1);
  }
  return normalize(board, target);
}

/** A previewed add: made now, or scheduled for `from` (the roster stands until then). */
function incomingFor(player: Incoming["player"], replaces: number, from: number | null | undefined): Incoming {
  return from != null ? { player, replaces, from } : { player, replaces };
}
