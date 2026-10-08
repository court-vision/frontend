"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  type LineupMode,
  type WeekSource,
} from "@/lib/week-grid";
import { sourceFromStreamer } from "@/lib/week-source";
import { pickupTiming, pickupViews } from "@/lib/pickups";
import { Bar, EmptyState, LoadingGrid, StatusLine, Tape, Toolbar, type WeekView } from "./Chrome";
import { MatchupView } from "./MatchupView";
import { MarketPane, type MarketMode, type MarketPick } from "./Market";
import { NO_DROP, addsCountFrom, dropCandidates, gainOf, openSpots, rosterRoom } from "@/lib/market";
import { ConfirmDialog, Dock, type PendingSwap, type SwapTiming } from "./Dock";
import { Tray, type PendingDay, type TrayDay } from "./Tray";
import { MoveMenu, ReplaceMenu, type MoveTarget, type ReplaceOption } from "./Menus";
import { WeekGrid, type Cursor, type DragApi, type DropTarget } from "./WeekGrid";
import { DailyGrid, type SeatDragApi } from "./DailyGrid";
import type { TerminalData } from "./WeekPage";
import { monthDay, shortName, signed } from "./format";
import dk from "@/components/desk/desk.module.css";
import s from "./week.module.css";
import { useDeskTheme } from "@/components/desk/useDeskTheme";

const NO_STAGING: Staged = {};
const MAX_REPLACE_OPTIONS = 80;

/**
 * `day` is the day the menu acts on (a column in the daily view, the selected
 * day in the player view). A replace menu on a later day of the daily view
 * schedules the pickup for that day (`from`).
 */
type Menu = { type: "move" | "replace"; rowKey: string; anchor: HTMLElement; day: number; from: number | null };
type View = WeekView;
/**
 * A free agent in the preview: who he replaces, and the day it's scheduled for
 * (null: made now). `pickup` is the scheduled pickup a hover came from.
 */
type PreviewRef = { faId: number; replaces: number; from: number | null; pickup?: number };
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
  const boards = lineup.boards;
  const todayDay = lineup.todayDay;
  // Today's lineup anchors eligibility, slots and the add/drop; any day's will do before it loads.
  const board: LineupState | null = (todayDay != null ? boards[todayDay] : undefined) ?? boards.find((b) => !!b) ?? null;
  const [root, setRoot] = useState<HTMLDivElement | null>(null);

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
    () => boards.map((b) => (b ? { board: b, staged: NO_STAGING } : null)),
    [boards]
  );
  const staged = todayDay != null ? staging[todayDay] : NO_STAGING;
  const anyStaging = staging.some((st) => Object.keys(st).length > 0);

  // ---- the week ----
  const { makeSource } = data;
  const source = useMemo(() => makeSource(board), [makeSource, board]);
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
  const [pinned, setPinned] = useState<PreviewRef | null>(null);
  // A hovered pickup that was cancelled (or ran) under the pointer previews nothing.
  const hoverLive =
    hover && (hover.pickup == null || data.pickups.pending.some((p) => p.id === hover.pickup)) ? hover : null;
  const preview = hoverLive ?? pinned;
  // After today's first tip an add counts from tomorrow; the previews and the market both obey.
  const addFrom = useMemo(() => (source ? addsCountFrom(source, board) : null), [source, board]);
  // Free agents the desk has loaded: the rest-of-week pool, and the one-day search.
  const faById = useMemo(
    () => new Map([...data.daily, ...data.streamers].map((f) => [f.player_id, f])),
    [data.daily, data.streamers]
  );
  const previewFa = preview ? faById.get(preview.faId) ?? null : null;
  const { setScheduleTeam } = data;
  useEffect(() => setScheduleTeam(previewFa?.team ?? null), [previewFa?.team, setScheduleTeam]);

  const incoming: Incoming | null = useMemo(
    () =>
      source && preview && previewFa
        ? incomingFor(sourceFromStreamer(previewFa, source.days, data.schedule, preview.from ?? addFrom), preview.replaces, preview.from)
        : null,
    [source, preview, previewFa, data.schedule, addFrom]
  );

  const build = useCallback(
    (src: WeekSource, over: Partial<GridInput> = {}) =>
      buildWeekGrid({ source: src, board, staged, dayBoards, incoming, viewDay, mode, ...over }),
    [board, staged, dayBoards, incoming, viewDay, mode]
  );
  const grid = useMemo(() => (source ? build(source) : null), [source, build]);
  const gridNoPreview = useMemo(
    () => (source && incoming ? build(source, { incoming: null }) : grid),
    [source, incoming, build, grid]
  );
  const gridUnstaged = useMemo(
    () =>
      source && anyStaging
        ? build(source, { incoming: null, staged: NO_STAGING, dayBoards: unstagedBoards })
        : gridNoPreview,
    [source, anyStaging, build, unstagedBoards, gridNoPreview]
  );
  const stagedDelta = gridNoPreview && gridUnstaged ? gridNoPreview.projected.you - gridUnstaged.projected.you : 0;

  const gridBest = useMemo(
    () => (source ? build(source, { incoming: null, mode: "best" }) : null),
    [source, build]
  );
  const bestGain = gridBest && gridNoPreview && mode === "espn" ? gridBest.projected.you - gridNoPreview.projected.you : 0;
  // What an add does to the week on screen: the lineup view in force (as set,
  // or the best each day) with him seated where he helps most. The market, the
  // replace menu, the preview and the dock all read this one number.
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
  const previewDelta = preview && previewFa ? faGain(previewFa, preview.replaces, preview.from) : null;

  // ---- scheduling: a pickup made for you before a later day's games ----
  const { periodOf } = lineup;
  /** A day a pickup can be scheduled for: after today, and one ESPN has a day number for. */
  const canSchedule = useCallback(
    (day: number) => !!source && source.days[day]?.kind === "future" && periodOf(day) != null,
    [source, periodOf]
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
  const pickupRows = useMemo(() => (source ? pickupViews(data.pickups, source.days) : []), [data.pickups, source]);

  // ---- the market: free agents ranked by what they add to this week ----
  const [marketOpen, setMarketOpen] = useState(initialMarket != null);
  // Closing the market lets go of the free agent picked in it, and of any hover.
  const closeMarket = useCallback(() => {
    setMarketOpen(false);
    setHover(null);
    setPinned(null);
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
      buildWeekGrid({ source: src, board, staged, dayBoards, incoming: null, viewDay: todayIndex ?? 0, mode, ...over }),
    [board, staged, dayBoards, todayIndex, mode]
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
  const marketDrops = useMemo(() => (source ? dropCandidates(source, board) : []), [source, board]);
  // The detail offers a few more, never the stars: a week's gain can't see what a player is worth
  // the rest of the season (an injured star projects nothing this week, and is still no drop).
  const marketAllDrops = useMemo(() => (source ? dropCandidates(source, board, 7) : []), [source, board]);
  const avgOf = useCallback((id: number) => source?.mine.find((p) => p.id === id)?.avg ?? null, [source]);
  const marketRoom = rosterRoom(todayDay != null ? boards[todayDay] ?? board : board);
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

  const boardById = useMemo(() => new Map((board?.players ?? []).map((p) => [p.player_id, p])), [board]);
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

  // ---- cursor and menus ----
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [confirm, setConfirm] = useState<"swap" | null>(null);

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
      // With a free agent picked, the roster player clicked becomes the one he replaces.
      if (pinned && row?.player && row.kind === "player") {
        if (row.player.id !== pinned.replaces) setPinned({ ...pinned, replaces: row.player.id });
        return;
      }
      const anchor = el ?? anchorFor(key);
      if (!row?.player || row.kind !== "player" || !anchor) return;
      if (day === undefined) setCursor({ key, col: 0 });
      setMenu({ type: "move", rowKey: key, anchor, day: day ?? viewDay, from: null });
    },
    [rowByKey, anchorFor, viewDay, pinned]
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
      const from = view === "daily" && day != null && canSchedule(day) ? day : null;
      setMenu({ type: "replace", rowKey: key, anchor, day: day ?? viewDay, from });
    },
    [rowByKey, anchorFor, requestStreamers, view, viewDay, canSchedule]
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
      return build(source, { incoming: null, dayBoards: over, staged: day === todayDay ? next : staged }).projected.you;
    },
    [source, boards, dayBoards, build, todayDay, staged]
  );

  // Move targets for the player in the menu on its day, each with its effect on the week.
  const moveInfo = useMemo(() => {
    if (!menu || menu.type !== "move" || !menuPlayer || !grid || !gridNoPreview) return null;
    const day = menu.day;
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
  }, [menu, menuPlayer, grid, gridNoPreview, boards, board, editableOn, source, mode, staging, weekWith]);

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

  // ---- the tray: staged moves by day, confirmed and sent from there ----
  const [sendingDay, setSendingDay] = useState<number | null>(null);
  const [trayHeight, setTrayHeight] = useState(0);
  const [dayErrors, setDayErrors] = useState<Record<number, string>>({});
  const dropDay = useCallback((day: number) => {
    setStagedByDay((prev) => {
      const out = { ...prev };
      delete out[day];
      return out;
    });
  }, []);
  /** Write the chosen days, earliest first; stop at the first one ESPN refuses. */
  const sendDays = useCallback(
    async (chosen: number[]) => {
      const order = pending.filter((p) => chosen.includes(p.day));
      if (order.length === 0) return;
      setDayErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([d]) => !chosen.includes(Number(d)))));
      const snapshot = { ...stagedByDay };
      const sent: string[] = [];
      let wrote = false;
      for (const p of order) {
        setSendingDay(p.day);
        // An earlier day's write may have changed this day (carry-forward): read it again.
        let b = boards[p.day];
        if (wrote) b = (await lineup.refresh(p.day)) ?? b;
        if (!b) continue;
        const moves = diff(b, normalize(b, snapshot[p.day] ?? NO_STAGING));
        if (moves.length > 0) {
          try {
            await lineup.apply(p.day, b, moves);
            wrote = true;
          } catch (err) {
            const e = toApiError(err);
            const reasons = e.code === ROSTER_MOVE_INVALID ? ((e.data as { errors?: MoveError[] } | null)?.errors ?? []) : [];
            setDayErrors((prev) => ({ ...prev, [p.day]: reasons[0]?.message ?? userMessage(err) }));
            setSendingDay(null);
            if (sent.length) toast.success(`Lineup updated for ${sent.join(", ")}; ${p.label} was refused`);
            return;
          }
        }
        sent.push(p.label);
        dropDay(p.day);
      }
      setSendingDay(null);
      if (data.demo) toast.success(`Lineup updated (demo): ${sent.join(", ")}`);
      else toast.success(`Lineup updated on ESPN for ${sent.join(", ")}`);
    },
    [pending, stagedByDay, boards, lineup, data.demo, dropDay]
  );
  const trayDays = useMemo<TrayDay[]>(
    () =>
      pending.map((p) => {
        const d = source?.days[p.day];
        const names = new Map((boards[p.day]?.players ?? []).map((x) => [x.player_id, x.name]));
        return {
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
          // What this day's own moves add: the week with them, less the week without.
          delta: gridNoPreview ? gridNoPreview.projected.you - weekWith(p.day, NO_STAGING) : 0,
          problems: p.problems.map((e) => e.message),
          error: dayErrors[p.day] ?? null,
        };
      }),
    [pending, source, boards, gridNoPreview, weekWith, dayErrors]
  );

  // ---- add / drop, now or scheduled ----
  const swapOut = pinned && pinned.replaces !== NO_DROP ? source?.mine.find((p) => p.id === pinned.replaces) ?? null : null;
  const swapFa = pinned ? faById.get(pinned.faId) ?? null : null;
  const swapFrom = pinned?.from ?? null;
  const pinnedDelta = pinned && swapFa ? faGain(swapFa, pinned.replaces, swapFrom) : 0;
  const todayBoard = todayDay != null ? boards[todayDay] ?? null : null;
  // When to make it: now, or before any later day he plays (the day picked stays on offer).
  const timings = useMemo<SwapTiming[]>(() => {
    if (!pinned || !swapFa || !source) return [];
    const days = source.days.filter((d) => canSchedule(d.index) && swapFa.game_days.includes(d.index)).map((d) => d.index);
    if (pinned.from != null && !days.includes(pinned.from)) days.push(pinned.from);
    days.sort((a, b) => a - b);
    return [
      { day: null, label: "Now", delta: faGain(swapFa, pinned.replaces, null) },
      ...days.map((d) => ({ day: d, label: source.days[d].dow, delta: faGain(swapFa, pinned.replaces, d) })),
    ];
  }, [pinned, swapFa, source, canSchedule, faGain]);

  let swap: PendingSwap | null = null;
  if (pinned && swapFa && source && (swapOut || pinned.replaces === NO_DROP)) {
    let blocked: string | null = null;
    if (swapFrom != null) {
      // Scheduled: locks and waivers are the server's to wait out when the day comes.
      const dup = pendingPickups.find((p) => p.add.player_id === swapFa.player_id);
      const dropping = swapOut ? pendingPickups.find((p) => p.drop?.player_id === swapOut.id) : undefined;
      if (!todayBoard) blocked = "Scheduling a pickup needs an ESPN team.";
      else if (dup) blocked = `${swapFa.name} is already scheduled for ${pickupDayLabel(dup.nba_date)}.`;
      else if (dropping && swapOut) {
        blocked = `${swapOut.name} is already being dropped for ${dropping.add.name} on ${pickupDayLabel(dropping.nba_date)}.`;
      } else if (!data.demo && !todayBoard.can_write) blocked = writeBlockedCopy(todayBoard.write_blocked_reason);
      else if (!swapOut && rosterRoom(todayBoard) === 0) blocked = "Your roster is full: pick someone to drop.";
    } else if (!todayBoard) blocked = "Add and drop from here need an ESPN team.";
    else if (swapOut && todayBoard.players.find((p) => p.player_id === swapOut.id)?.locked) {
      blocked = `${swapOut.name} is locked until his game ends.`;
    } else if (swapFa.acquisition_status === "waivers") blocked = `${swapFa.name} is on waivers.`;
    else if (!data.demo && !todayBoard.can_write) blocked = writeBlockedCopy(todayBoard.write_blocked_reason);
    else if (!swapOut && rosterRoom(todayBoard) === 0) blocked = "Your roster is full: pick someone to drop.";
    swap = {
      fa: swapFa,
      out: swapOut ? { id: swapOut.id, name: swapOut.name } : null,
      delta: pinnedDelta,
      blocked,
      from: swapFrom,
      timings,
      timing: swapFrom != null ? pickupTiming(source.days, swapFrom, swapOut, todayIndex, addFrom) : null,
    };
  }

  const sendSwap = useCallback(async () => {
    if (!pinned || !todayBoard) return;
    const drop = pinned.replaces === NO_DROP ? null : pinned.replaces;
    const outcome =
      pinned.from != null
        ? swapFa
          ? await data.schedulePickup(swapFa, drop, pinned.from)
          : "refused"
        : await data.transact(pinned.faId, drop, todayBoard);
    if (outcome === "ok") {
      setPinned(null);
      setConfirm(null);
    }
  }, [pinned, todayBoard, data, swapFa]);
  const reviewSwap = useCallback(() => {
    data.clearTransactError();
    data.clearScheduleError();
    setConfirm("swap");
  }, [data]);

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

  // ---- keyboard ----
  useEffect(() => {
    if (!grid) return;
    const onKey = (e: KeyboardEvent) => {
      if (menu || confirm || e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Keys typed in a field or a menu belong to it (a menu's Enter also reaches
      // window after the menu has closed and this listener has re-subscribed).
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [cmdk-root], [role='dialog'], [data-market], [data-tray]")) return;
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
        case "Escape":
          if (pinned) setPinned(null);
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
            if (!seat || seat.incoming || seat.outgoing || !cursor) return;
            e.preventDefault();
            openMove(`player-${seat.player.id}`, seatEl(), cursor.col);
            return;
          }
          case "r": {
            const seat = seatHere();
            if (seat && !seat.incoming && !seat.outgoing && cursor) openReplace(`player-${seat.player.id}`, seatEl(), cursor.col);
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
  }, [grid, menu, confirm, cursor, viewable, viewableList, viewDay, view, focusDay, defaultFocus, root, openMove, openReplace, autoslot, toggleTheme, toggleMode, toggleView, pinned, toggleMarket]);

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
        ? "Live box scores, refreshed every 30 s · the spot's leader is underlined"
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
        body="Connect an ESPN or Yahoo team and its matchup week shows up here."
        action={<Link href="/manage-teams" className={`${dk.btn} ${dk.btnPrimary}`} style={{ textDecoration: "none" }}>Add a team</Link>}
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
          previewDelta={previewDelta}
          tonight={tonight}
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
            picking={!!pinned}
            drag={seatDrag}
            pickups={pickupRows}
            onPreviewPickup={previewPickup}
            onCancelPickup={data.cancelPickup}
            cancelling={data.cancelling}
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
            picking={!!pinned}
            onReplace={openReplace}
            drag={drag}
            mode={mode}
          />
        )}
        {trayDays.length ? (
          <Tray
            days={trayDays}
            blocked={movesBlocked}
            demo={data.demo}
            sendingDay={sendingDay}
            onUnstage={(day, playerId) => {
              const b = boards[day];
              if (b) setDay(day, unstagePure(b, staging[day], playerId));
            }}
            onDiscardDay={dropDay}
            onDiscardAll={() => setStagedByDay({})}
            onSend={sendDays}
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
            onHover={(pick: MarketPick | null) => setHover(pick ? { ...pick, from: pinned?.faId === pick.faId ? pinned.from : null } : null)}
            onPin={(pick: MarketPick | null) => {
              setHover(null);
              setPinned(pick ? { ...pick, from: pinned?.faId === pick.faId ? pinned.from : null } : null);
            }}
            onAdd={(pick: MarketPick) => {
              setPinned({ ...pick, from: pinned?.faId === pick.faId ? pinned.from : null });
              setHover(null);
              reviewSwap();
            }}
            onClose={closeMarket}
          />
        ) : null}
        </div>
        <Dock
          swap={swap}
          onTiming={(day) => pinned && setPinned({ ...pinned, from: day })}
          onCancelSwap={() => setPinned(null)}
          onReviewSwap={reviewSwap}
        />
      </>
    );
  }

  return (
    <div ref={setRoot} className={dk.desk}>
      <Bar
        teams={data.teams}
        teamId={data.teamId}
        onTeam={data.selectTeam}
        period={source?.period ?? null}
        days={source?.days ?? []}
        oppName={source?.opp.name ?? null}
        liveGames={liveMine}
        demo={data.demo}
        onRefresh={data.refetch}
        container={root}
      />
      {body}
      <StatusLine updatedAt={data.updatedAt} demo={data.demo} />

      {menu?.type === "move" && menuPlayer && moveInfo ? (
        <MoveMenu
          anchor={menu.anchor}
          container={root}
          onClose={closeMenu}
          player={menuPlayer}
          currentSlot={`${dayLabel(moveInfo.day)} · ${menuRow?.slot ?? ""}`}
          targets={moveInfo.targets}
          blocked={moveInfo.blocked}
          scheduleFor={view === "daily" && canSchedule(menu.day) ? source?.days[menu.day]?.dow ?? null : null}
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
            setPinned({ faId: fa.player_id, replaces: menuPlayer.id, from: menu.from });
            closeMenu();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={confirm === "swap" && !!swap}
        onOpenChange={(open) => !open && setConfirm(null)}
        container={root}
        title={
          swap
            ? `${swap.from != null ? `Schedule for ${dayLabel(swap.from)}: add` : "Add"} ${shortName(swap.fa.name)}${swap.out ? `, drop ${shortName(swap.out.name)}` : ""}`
            : ""
        }
        body={
          swap?.from != null
            ? data.demo
              ? "Demo: the pickup is scheduled here only, and nothing runs."
              : `${swap.timing}, the earliest it counts for ${dayLabel(swap.from)}. If ${shortName(swap.fa.name)} is gone by then, nothing happens. You can cancel it until then, and you'll get an email with the result.`
            : data.demo
              ? "Demo: the add and drop apply here only."
              : "One add/drop on ESPN. He joins your bench; move him into a slot afterwards."
        }
        lines={
          swap
            ? [
                {
                  key: "add",
                  left: <><span style={{ color: "var(--up)" }}>+</span> {swap.fa.name}</>,
                  right: (
                    <span className={dk.sub}>
                      {swap.fa.team} ·{" "}
                      {swap.from != null
                        ? `${swap.fa.game_days.filter((d) => d >= swap.from!).length} games from ${dayLabel(swap.from).split(" ")[0]}`
                        : `${swap.fa.games_remaining} games left`}
                    </span>
                  ),
                },
                swap.out
                  ? { key: "drop", left: <><span style={{ color: "var(--down)" }}>−</span> {swap.out.name}</>, right: <span className={`${dk.chip} ${dk.pv}`}>{signed(swap.delta)} week</span> }
                  : { key: "room", left: <span className={dk.sub}>Into an open roster spot</span>, right: <span className={`${dk.chip} ${dk.pv}`}>{signed(swap.delta)} week</span> },
              ]
            : []
        }
        confirmLabel={swap?.from != null ? "Schedule pickup" : "Send to ESPN"}
        busy={swap?.from != null ? data.scheduling : data.transacting}
        error={swap?.from != null ? data.scheduleError : data.transactError}
        onConfirm={() => void sendSwap()}
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
 * everyone healthy with a game seated to maximize projected points, then the
 * spots left over filled with players who don't play (so the bench never holds
 * more than it can), IR untouched.
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
  // Seats left: fill them with non-players, keeping anyone already sitting there.
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
  // Too many on the bench: seat the overflow in any open active spot they fit.
  const benchRoom = board.slots.find((x) => x.slot_id === BENCH_SLOT_ID)?.count ?? 0;
  const benched = rest.filter((p) => target[p.player_id] === BENCH_SLOT_ID);
  for (const p of benched.slice(benchRoom)) {
    const open = p.eligible_slot_ids.find((slot) => isActiveSlot(slot) && free(slot) > 0);
    if (open != null) {
      target[p.player_id] = open;
      used.set(open, (used.get(open) ?? 0) + 1);
    }
  }
  return normalize(board, target);
}

/** A previewed add: made now, or scheduled for `from` (the roster stands until then). */
function incomingFor(player: Incoming["player"], replaces: number, from: number | null | undefined): Incoming {
  return from != null ? { player, replaces, from } : { player, replaces };
}
