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
  normalize,
  planToStaged,
  slotCapacity,
  slotName,
  stage as stagePure,
  stageMoves as stageMovesPure,
  swapPartner,
  validateStaged,
  type Staged,
} from "@/lib/lineup-editor";
import type { LineupMove, LineupPlayer, LineupState, MoveError } from "@/types/lineup-editor";
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
import { Bar, EmptyState, LoadingGrid, StatusLine, Tape, Toolbar } from "./Chrome";
import { ConfirmDialog, Dock, type PendingDay, type PendingSwap } from "./Dock";
import { MoveMenu, ReplaceMenu, type MoveTarget, type ReplaceOption } from "./Menus";
import { WeekGrid, type Cursor, type DragApi, type DropTarget } from "./WeekGrid";
import { DailyGrid, type SeatDragApi } from "./DailyGrid";
import type { TerminalData } from "./WeekPage";
import { monthDay, shortName, signed } from "./format";
import s from "./week.module.css";

const THEME_KEY = "cv.week.theme";
const NO_STAGING: Staged = {};
const MAX_REPLACE_OPTIONS = 80;

/** `day` is the day the menu acts on (a column in the daily view, the selected day in the player view). */
type Menu = { type: "move" | "replace"; rowKey: string; anchor: HTMLElement; day: number };
type View = "daily" | "players";
type PreviewRef = { faId: number; replaces: number };
type Planned = DropTarget & { moves: Array<{ player_id: number; to_slot_id: number }> };

export function WeekTerminal({ data }: { data: TerminalData }) {
  const lineup = data.lineup;
  const boards = lineup.boards;
  const todayDay = lineup.todayDay;
  // Today's lineup anchors eligibility, slots and the add/drop; any day's will do before it loads.
  const board: LineupState | null = (todayDay != null ? boards[todayDay] : undefined) ?? boards.find((b) => !!b) ?? null;
  const [root, setRoot] = useState<HTMLDivElement | null>(null);

  // ---- view switches ----
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      // Storage blocked: stay dark.
    }
  }, []);
  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // Not persisted; fine.
      }
      return next;
    });
  }, []);
  const [heat, setHeat] = useState(false);
  // "espn": each day as set on ESPN; "best": the best fit for each day's games.
  const [mode, setMode] = useState<LineupMode>("espn");
  const toggleMode = useCallback(() => setMode((m) => (m === "espn" ? "best" : "espn")), []);
  // "daily": every day's lineup side by side; "players": one row per player across the week.
  const [view, setView] = useState<View>("daily");

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
  // The daily view's expanded day: any day, past ones included; today (or ESPN's day) by default.
  const [focusPick, setFocusDay] = useState<number | null>(null);
  const dayCount = source?.days.length ?? 0;
  const focusDay = focusPick != null && focusPick < dayCount ? focusPick : todayIndex ?? todayDay ?? viewDay;

  // ---- free-agent preview: a highlighted one (in the menu) wins over a kept one ----
  const [hover, setHover] = useState<PreviewRef | null>(null);
  const [pinned, setPinned] = useState<PreviewRef | null>(null);
  const preview = hover ?? pinned;
  const previewFa = preview ? data.streamers.find((f) => f.player_id === preview.faId) ?? null : null;
  const { setScheduleTeam } = data;
  useEffect(() => setScheduleTeam(previewFa?.team ?? null), [previewFa?.team, setScheduleTeam]);

  const incoming: Incoming | null = useMemo(
    () =>
      source && preview && previewFa
        ? { player: sourceFromStreamer(previewFa, source.days, data.schedule), replaces: preview.replaces }
        : null,
    [source, preview, previewFa, data.schedule]
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

  // A streamer is worth what he adds when he starts on his game days, so free
  // agents are judged against the best lineup each day, whichever view is on.
  const gridBest = useMemo(
    () => (source ? build(source, { incoming: null, mode: "best" }) : null),
    [source, build]
  );
  const bestGain = gridBest && gridNoPreview && mode === "espn" ? gridBest.projected.you - gridNoPreview.projected.you : 0;
  const faGain = useCallback(
    (fa: StreamerPlayer, replaces: number) => {
      if (!source || !gridBest) return 0;
      const g = build(source, {
        incoming: { player: sourceFromStreamer(fa, source.days, null), replaces },
        mode: "best",
      });
      return g.projected.you - gridBest.projected.you;
    },
    [source, gridBest, build]
  );
  const previewDelta = preview && previewFa ? faGain(previewFa, preview.replaces) : null;

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
  const [confirm, setConfirm] = useState<"moves" | "swap" | null>(null);

  const toggleView = useCallback(() => {
    setView((v) => (v === "daily" ? "players" : "daily"));
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
      setMenu({ type: "move", rowKey: key, anchor, day: day ?? viewDay });
    },
    [rowByKey, anchorFor, viewDay]
  );
  const openSeat = useCallback(
    (playerId: number, day: number, el: HTMLElement) => openMove(`player-${playerId}`, el, day),
    [openMove]
  );
  const { requestStreamers } = data;
  const openReplace = useCallback(
    (key: string, el?: HTMLElement | null) => {
      const row = rowByKey(key);
      const anchor = el ?? anchorFor(key);
      if (!row?.player || row.kind !== "player" || !anchor) return;
      requestStreamers();
      if (view === "players") setCursor({ key, col: 0 });
      setMenu({ type: "replace", rowKey: key, anchor, day: viewDay });
    },
    [rowByKey, anchorFor, requestStreamers, view, viewDay]
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
      .map((fa) => ({ fa, gain: faGain(fa, menuPlayer.id) }))
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
  const autoslotDay = view === "daily" ? focusDay : viewDay;
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

  // ---- sending ----
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const sendMoves = useCallback(async () => {
    setSending(true);
    setSendError(null);
    const snapshot = { ...stagedByDay };
    let wrote = false;
    for (const p of pending) {
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
          setSendError(`${p.label}: ${reasons[0]?.message ?? userMessage(err)}`);
          setSending(false);
          return;
        }
      }
      setStagedByDay((prev) => {
        const out = { ...prev };
        delete out[p.day];
        return out;
      });
    }
    setSending(false);
    setConfirm(null);
    if (data.demo) toast.success("Lineup updated (demo)");
    else toast.success(`Lineup updated on ESPN for ${pending.map((p) => p.label).join(", ")}`);
  }, [stagedByDay, pending, boards, lineup, data.demo]);

  // ---- add / drop ----
  const swapOut = pinned ? source?.mine.find((p) => p.id === pinned.replaces) ?? null : null;
  const swapFa = pinned ? data.streamers.find((f) => f.player_id === pinned.faId) ?? null : null;
  const pinnedDelta = pinned && swapFa ? faGain(swapFa, pinned.replaces) : 0;
  const todayBoard = todayDay != null ? boards[todayDay] ?? null : null;

  let swap: PendingSwap | null = null;
  if (pinned && swapFa && swapOut) {
    let blocked: string | null = null;
    if (!todayBoard) blocked = "Add and drop from here need an ESPN team.";
    else if (todayBoard.players.find((p) => p.player_id === swapOut.id)?.locked) {
      blocked = `${swapOut.name} is locked until his game ends.`;
    } else if (swapFa.acquisition_status === "waivers") blocked = `${swapFa.name} is on waivers.`;
    else if (!data.demo && !todayBoard.can_write) blocked = writeBlockedCopy(todayBoard.write_blocked_reason);
    swap = { fa: swapFa, out: { id: swapOut.id, name: swapOut.name }, delta: pinnedDelta, blocked };
  }

  const sendSwap = useCallback(async () => {
    if (!pinned || !todayBoard) return;
    const outcome = await data.transact(pinned.faId, pinned.replaces, todayBoard);
    if (outcome === "ok") {
      setPinned(null);
      setConfirm(null);
    }
  }, [pinned, todayBoard, data]);

  // ---- keyboard ----
  useEffect(() => {
    if (!grid) return;
    const onKey = (e: KeyboardEvent) => {
      if (menu || confirm || e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Keys typed in a field or a menu belong to it (a menu's Enter also reaches
      // window after the menu has closed and this listener has re-subscribed).
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [cmdk-root], [role='dialog']")) return;
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

      if (view === "daily") {
        // The cursor is a lineup spot (row) on a day (column); [ and ] move the expanded day.
        const { slots, seats } = grid.lineups;
        const lastDay = grid.days.length - 1;
        const at = cursor ? Math.max(0, slots.findIndex((d) => d.key === cursor.key)) : -1;
        const day = cursor?.col ?? focusDay;
        const go = (r: number, c: number) => {
          const def = slots[Math.min(slots.length - 1, Math.max(0, r))];
          if (!def) return;
          const col = Math.min(lastDay, Math.max(0, c));
          setCursor({ key: def.key, col });
          setFocusDay(col);
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
            setFocusDay(Math.max(0, focusDay - 1));
            return;
          case "]":
            setFocusDay(Math.min(lastDay, focusDay + 1));
            return;
          case "Enter":
          case "m": {
            const seat = seatHere();
            if (!seat || seat.incoming || !cursor) return;
            e.preventDefault();
            openMove(`player-${seat.player.id}`, seatEl(), cursor.col);
            return;
          }
          case "r": {
            const seat = seatHere();
            if (seat && !seat.incoming) openReplace(`player-${seat.player.id}`, seatEl());
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
  }, [grid, menu, confirm, cursor, viewable, viewableList, viewDay, view, focusDay, root, openMove, openReplace, autoslot, toggleTheme, toggleMode, toggleView, pinned]);

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
    view === "daily"
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
        action={<Link href="/account" className={`${s.btn} ${s.btnPrimary}`} style={{ textDecoration: "none" }}>Sign in</Link>}
      />
    );
  } else if (data.status === "no-team") {
    body = (
      <EmptyState
        title="Add a team to see its week"
        body="Connect an ESPN or Yahoo team and its matchup week shows up here."
        action={<Link href="/manage-teams" className={`${s.btn} ${s.btnPrimary}`} style={{ textDecoration: "none" }}>Add a team</Link>}
      />
    );
  } else if (data.status === "loading") {
    body = <LoadingGrid />;
  } else if (data.status === "error") {
    body = (
      <EmptyState
        title="Couldn't load this week"
        body={data.message ?? "Something went wrong reading the matchup."}
        action={<button type="button" className={s.btn} onClick={data.refetch}>Try again</button>}
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
          viewDay={viewDay}
          viewable={viewable}
          todayIndex={todayIndex}
          onViewDay={setViewDay}
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
          onView={toggleView}
        />
        {view === "daily" ? (
          <DailyGrid
            grid={grid}
            todayIndex={todayIndex}
            boards={boards}
            focusDay={focusDay}
            onFocusDay={setFocusDay}
            cursor={cursor}
            onCursor={setCursor}
            heat={heat}
            youName={source.you.name}
            oppName={source.opp.name}
            onSeat={openSeat}
            drag={seatDrag}
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
        <Dock
          pending={pending}
          playerById={boardById}
          stagedDelta={stagedDelta}
          canSendMoves={data.demo || !blockedBoard}
          movesBlocked={movesBlocked}
          onDiscardMoves={() => setStagedByDay({})}
          onReviewMoves={() => {
            setSendError(null);
            setConfirm("moves");
          }}
          swap={swap}
          onCancelSwap={() => setPinned(null)}
          onReviewSwap={() => {
            data.clearTransactError();
            setConfirm("swap");
          }}
        />
      </>
    );
  }

  return (
    <div ref={setRoot} className={s.root} data-theme={theme}>
      <Bar
        teams={data.teams}
        teamId={data.teamId}
        onTeam={data.selectTeam}
        period={source?.period ?? null}
        days={source?.days ?? []}
        oppName={source?.opp.name ?? null}
        liveGames={liveMine}
        demo={data.demo}
        theme={theme}
        onTheme={toggleTheme}
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
          onPick={(slot) => {
            stageOneOn(moveInfo.day, menuPlayer.id, slot);
            closeMenu();
          }}
          onReplace={() => {
            const key = menu.rowKey;
            const anchor = menu.anchor;
            closeMenu();
            openReplace(key, anchor);
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
          onHighlight={(id) => setHover(id != null ? { faId: id, replaces: menuPlayer.id } : null)}
          onPick={(fa) => {
            setPinned({ faId: fa.player_id, replaces: menuPlayer.id });
            closeMenu();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={confirm === "moves"}
        onOpenChange={(open) => !open && setConfirm(null)}
        container={root}
        title={`Send ${moveCount} lineup move${moveCount === 1 ? "" : "s"} to ESPN`}
        body={
          data.demo
            ? "Demo: the moves apply here only."
            : pending.length > 1
              ? "One change per day, sent in day order. Each day's edit carries into later days until a day has its own."
              : "One change to that day's lineup. It carries into later days until a day has its own edit."
        }
        lines={pending.flatMap((p) =>
          p.moves.map((m: LineupMove) => ({
            key: `${p.day}-${m.player_id}`,
            left: (
              <span style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <span className={s.sub} style={{ width: 70 }}>{p.label}</span>
                {boardById.get(m.player_id)?.name ?? `#${m.player_id}`}
              </span>
            ),
            right: (
              <span className={s.mono} style={{ color: "var(--text-2)" }}>
                {slotName(m.from_slot_id)} → {slotName(m.to_slot_id)}
              </span>
            ),
          }))
        )}
        confirmLabel="Send to ESPN"
        busy={sending || lineup.applying}
        error={sendError}
        onConfirm={() => void sendMoves()}
      />
      <ConfirmDialog
        open={confirm === "swap" && !!swap}
        onOpenChange={(open) => !open && setConfirm(null)}
        container={root}
        title={swap ? `Add ${shortName(swap.fa.name)}, drop ${shortName(swap.out.name)}` : ""}
        body={
          data.demo
            ? "Demo: the add and drop apply here only."
            : "One add/drop on ESPN. He joins your bench; move him into a slot afterwards."
        }
        lines={
          swap
            ? [
                { key: "add", left: <><span style={{ color: "var(--up)" }}>+</span> {swap.fa.name}</>, right: <span className={s.sub}>{swap.fa.team} · {swap.fa.games_remaining} games left</span> },
                { key: "drop", left: <><span style={{ color: "var(--down)" }}>−</span> {swap.out.name}</>, right: <span className={`${s.chip} ${s.pv}`}>{signed(swap.delta)} week</span> },
              ]
            : []
        }
        confirmLabel="Send to ESPN"
        busy={data.transacting}
        error={data.transactError}
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
