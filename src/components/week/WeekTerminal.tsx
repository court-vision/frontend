"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLineupEditor } from "@/components/lineup/LineupEditorProvider";
import { userMessage } from "@/lib/api-error";
import {
  BENCH_SLOT_ID,
  IR_SLOT_ID,
  assignment as boardAssignment,
  isInjured,
  slotCapacity,
  slotName,
  stage as stagePure,
  stageMoves as stageMovesPure,
  swapPartner,
  type Staged,
} from "@/lib/lineup-editor";
import type { LineupPlayer } from "@/types/lineup-editor";
import type { StreamerPlayer } from "@/types/streamer";
import { writeBlockedCopy } from "@/types/lineup-editor";
import { buildWeekGrid, viewableDays, type Incoming, type LineupMode } from "@/lib/week-grid";
import { sourceFromStreamer } from "@/lib/week-source";
import { Bar, EmptyState, LoadingGrid, StatusLine, Tape, Toolbar } from "./Chrome";
import { ConfirmDialog, Dock, type PendingSwap } from "./Dock";
import { MoveMenu, ReplaceMenu, type MoveTarget, type ReplaceOption } from "./Menus";
import { WeekGrid, type Cursor, type DragApi, type DropTarget } from "./WeekGrid";
import type { TerminalData } from "./WeekPage";
import { shortName, signed } from "./format";
import s from "./week.module.css";

const THEME_KEY = "cv.week.theme";
const NO_STAGING: Staged = {};
const MAX_REPLACE_OPTIONS = 80;

type Menu = { type: "move" | "replace"; rowKey: string; anchor: HTMLElement };
type PreviewRef = { faId: number; replaces: number };

export function WeekTerminal({ data }: { data: TerminalData }) {
  const editor = useLineupEditor();
  const board = editor?.state ?? null;
  const staged = editor?.staged ?? NO_STAGING;
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
  // "espn": the lineup as set on ESPN, carried forward; "best": the best fit for each day's games.
  const [mode, setMode] = useState<LineupMode>("espn");
  const toggleMode = useCallback(() => setMode((m) => (m === "espn" ? "best" : "espn")), []);

  // ---- the week ----
  const { makeSource } = data;
  const source = useMemo(() => makeSource(board), [makeSource, board]);
  const viewableList = useMemo(() => (source ? viewableDays(source) : []), [source]);
  const viewable = useMemo(() => new Set(viewableList), [viewableList]);
  const [viewDayPick, setViewDay] = useState<number | null>(null);
  const viewDay = viewDayPick != null && viewable.has(viewDayPick) ? viewDayPick : viewableList[0] ?? 0;
  const todayIndex = source?.todayIndex ?? null;

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

  const grid = useMemo(
    () => (source ? buildWeekGrid({ source, board, staged, incoming, viewDay, mode }) : null),
    [source, board, staged, incoming, viewDay, mode]
  );
  const gridNoPreview = useMemo(
    () => (source && incoming ? buildWeekGrid({ source, board, staged, incoming: null, viewDay, mode }) : grid),
    [source, board, staged, incoming, viewDay, mode, grid]
  );
  const hasStaging = Object.keys(staged).length > 0;
  const gridUnstaged = useMemo(
    () =>
      source && hasStaging
        ? buildWeekGrid({ source, board, staged: NO_STAGING, incoming: null, viewDay, mode })
        : gridNoPreview,
    [source, board, hasStaging, viewDay, mode, gridNoPreview]
  );
  const stagedDelta = gridNoPreview && gridUnstaged ? gridNoPreview.projected.you - gridUnstaged.projected.you : 0;

  // A streamer is worth what he adds when he starts on his game days, so free
  // agents are judged against the best lineup each day, whichever view is on.
  const gridBest = useMemo(
    () => (source ? buildWeekGrid({ source, board, staged, incoming: null, viewDay, mode: "best" }) : null),
    [source, board, staged, viewDay]
  );
  const bestGain = gridBest && gridNoPreview && mode === "espn" ? gridBest.projected.you - gridNoPreview.projected.you : 0;
  const faGain = useCallback(
    (fa: StreamerPlayer, replaces: number) => {
      if (!source || !gridBest) return 0;
      const g = buildWeekGrid({
        source,
        board,
        staged,
        incoming: { player: sourceFromStreamer(fa, source.days, null), replaces },
        viewDay,
        mode: "best",
      });
      return g.projected.you - gridBest.projected.you;
    },
    [source, gridBest, board, staged, viewDay]
  );
  const previewDelta = preview && previewFa ? faGain(previewFa, preview.replaces) : null;

  const boardById = useMemo(() => new Map((board?.players ?? []).map((p) => [p.player_id, p])), [board]);

  // ---- cursor and menus ----
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [confirm, setConfirm] = useState<"moves" | "swap" | null>(null);

  const rowByKey = useCallback((key: string) => grid?.rows.find((r) => r.key === key) ?? null, [grid]);
  const anchorFor = useCallback(
    (key: string) => root?.querySelector<HTMLElement>(`[data-rowkey="${key}"] [data-col="0"]`) ?? null,
    [root]
  );

  const openMove = useCallback(
    (key: string, el?: HTMLElement | null) => {
      const row = rowByKey(key);
      const anchor = el ?? anchorFor(key);
      if (!row?.player || row.kind !== "player" || !anchor) return;
      setCursor({ key, col: 0 });
      setMenu({ type: "move", rowKey: key, anchor });
    },
    [rowByKey, anchorFor]
  );
  const { requestStreamers } = data;
  const openReplace = useCallback(
    (key: string, el?: HTMLElement | null) => {
      const row = rowByKey(key);
      const anchor = el ?? anchorFor(key);
      if (!row?.player || row.kind !== "player" || !anchor) return;
      requestStreamers();
      setCursor({ key, col: 0 });
      setMenu({ type: "replace", rowKey: key, anchor });
    },
    [rowByKey, anchorFor, requestStreamers]
  );
  const closeMenu = useCallback(() => {
    setMenu(null);
    setHover(null);
  }, []);

  const menuRow = menu ? rowByKey(menu.rowKey) : null;
  const menuPlayer = menuRow?.player ?? null;

  // Move targets for the player in the menu, each with its effect on the week
  // (a lineup move carries forward on ESPN until it is changed again).
  const moveInfo = useMemo(() => {
    if (!menu || menu.type !== "move" || !menuPlayer || !grid) return null;
    const b = boardById.get(menuPlayer.id);
    let blocked: string | null = null;
    if (!editor || !board) blocked = "Lineup changes from here need an ESPN team.";
    else if (mode === "best" && viewDay !== todayIndex) {
      blocked = "This view is the best fit for that day's games. Switch to “As set on ESPN” to move players.";
    } else if (b?.locked) blocked = "Locked: his game has started.";
    let targets: MoveTarget[] = [];
    if (!blocked && editor && board && source && gridNoPreview) {
      const base = gridNoPreview.projected.you;
      targets = editor.eligibleTargetsFor(menuPlayer.id).map((slot) => {
        const next = stagePure(board, staged, menuPlayer.id, slot);
        const g = buildWeekGrid({ source, board, staged: next, incoming: null, viewDay, mode });
        return {
          slotId: slot,
          partner: swapPartner(board, staged, menuPlayer.id, slot)?.name ?? null,
          delta: g.projected.you - base,
        };
      });
    }
    return { blocked, targets };
  }, [menu, menuPlayer, grid, boardById, editor, board, viewDay, todayIndex, mode, source, gridNoPreview, staged]);

  // Free agents for the replace menu, best change to the week first.
  const replaceOptions = useMemo<ReplaceOption[]>(() => {
    if (!menu || menu.type !== "replace" || !menuPlayer) return [];
    return data.streamers
      .slice(0, MAX_REPLACE_OPTIONS)
      .map((fa) => ({ fa, gain: faGain(fa, menuPlayer.id) }))
      .sort((a, b) => b.gain - a.gain);
  }, [menu, menuPlayer, data.streamers, faGain]);

  // ---- drag to rearrange today's lineup ----
  const editorStageMoves = editor?.stageMoves;
  const drag = useMemo<DragApi | null>(() => {
    if (!editorStageMoves || !board || !source || !grid || !gridNoPreview) return null;
    // The best-lineup view of a later day is a plan, not something to drag.
    if (mode === "best" && viewDay !== todayIndex) return null;
    type Planned = DropTarget & { moves: Array<{ player_id: number; to_slot_id: number }> };
    let last: { key: string; targets: Map<string, Planned> } | null = null;

    const targetsFor = (fromKey: string): Map<string, Planned> | null => {
      const from = grid.rows.find((r) => r.key === fromKey);
      const mover = from?.player ? boardById.get(from.player.id) : undefined;
      if (!mover || mover.locked || from?.kind !== "player") return null;
      const assign = boardAssignment(board, staged);
      const current = assign.get(mover.player_id) ?? mover.lineup_slot_id;
      const base = gridNoPreview.projected.you;
      const out = new Map<string, Planned>();
      for (const row of grid.rows) {
        if (row.key === fromKey || row.slotId == null || row.kind === "incoming") continue;
        const slot = row.slotId;
        if (slot === current || !canSit(mover, slot)) continue;
        const holders = board.players.filter((p) => assign.get(p.player_id) === slot).length;
        const spare = holders < slotCapacity(board, slot);
        const other = row.player ? boardById.get(row.player.id) : undefined;
        let moves: Planned["moves"];
        if (!other || spare) moves = [{ player_id: mover.player_id, to_slot_id: slot }];
        else if (!other.locked && canSit(other, current)) {
          // Dropped on a specific player: he is the one who swaps back.
          moves = [
            { player_id: mover.player_id, to_slot_id: slot },
            { player_id: other.player_id, to_slot_id: current },
          ];
        } else continue;
        const next = stageMovesPure(board, staged, moves);
        const g = buildWeekGrid({ source, board, staged: next, incoming: null, viewDay, mode });
        out.set(row.key, {
          slotId: slot,
          swapWith: moves.length > 1 && other ? other.name : null,
          delta: g.projected.you - base,
          moves,
        });
      }
      last = { key: fromKey, targets: out };
      return out;
    };

    return {
      targetsFor,
      onDrop: (fromKey, toKey) => {
        const plan = last?.key === fromKey ? last.targets.get(toKey) : targetsFor(fromKey)?.get(toKey);
        if (plan) editorStageMoves(plan.moves);
      },
    };
  }, [editorStageMoves, board, source, grid, gridNoPreview, todayIndex, viewDay, mode, boardById, staged]);

  // ---- writes ----
  const autoslot = useCallback(() => {
    if (!editor || !board) return;
    if (todayIndex != null) setViewDay(todayIndex);
    void editor.loadPlan();
  }, [editor, board, todayIndex]);

  const swapOut = pinned ? source?.mine.find((p) => p.id === pinned.replaces) ?? null : null;
  const swapFa = pinned ? data.streamers.find((f) => f.player_id === pinned.faId) ?? null : null;
  const pinnedDelta = pinned && swapFa ? faGain(swapFa, pinned.replaces) : 0;

  let swap: PendingSwap | null = null;
  if (pinned && swapFa && swapOut) {
    let blocked: string | null = null;
    if (!board) blocked = "Add and drop from here need an ESPN team.";
    else if (boardById.get(swapOut.id)?.locked) blocked = `${swapOut.name} is locked until his game ends.`;
    else if (swapFa.acquisition_status === "waivers") blocked = `${swapFa.name} is on waivers.`;
    else if (!data.demo && !board.can_write) blocked = writeBlockedCopy(board.write_blocked_reason);
    swap = { fa: swapFa, out: { id: swapOut.id, name: swapOut.name }, delta: pinnedDelta, blocked };
  }

  const movesBlocked = editor && !editor.canWrite && !data.demo ? writeBlockedCopy(editor.blockedReason) : null;

  // Close the moves dialog once they're sent (the board re-read clears the staging).
  const moveCount = editor?.moves.length ?? 0;
  useEffect(() => {
    if (confirm === "moves" && moveCount === 0) setConfirm(null);
  }, [confirm, moveCount]);

  const sendSwap = useCallback(async () => {
    if (!pinned || !board) return;
    const outcome = await data.transact(pinned.faId, pinned.replaces, board);
    if (outcome === "ok") {
      setPinned(null);
      setConfirm(null);
    }
  }, [pinned, board, data]);

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
        case "a":
          autoslot();
          return;
        case "[":
          stepDay(-1);
          return;
        case "]":
          stepDay(1);
          return;
        case "l":
          toggleMode();
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
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [grid, menu, confirm, cursor, viewable, viewableList, viewDay, openMove, openReplace, autoslot, toggleTheme, toggleMode, pinned]);

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
    mode === "best"
      ? viewDay !== todayIndex
        ? "Planned: the best lineup for that day's games"
        : "Later days show the best lineup for their games"
      : todayIndex == null
        ? "Your ESPN lineup, carried into every day until you change it"
        : "Your ESPN lineup carries forward until you change it";

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
          canAutoslot={!!editor && !!board}
          mode={mode}
          onMode={toggleMode}
          bestGain={bestGain}
          autoslotting={editor?.planStatus === "loading"}
          onAutoslot={autoslot}
          heat={heat}
          onHeat={() => setHeat((h) => !h)}
          note={toolbarNote}
        />
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
        <Dock
          moves={editor?.moves ?? []}
          playerById={editor?.playerById ?? boardById}
          stagedDelta={stagedDelta}
          problems={[...(editor?.validation ?? []), ...(editor?.moveErrors ?? [])]}
          canSendMoves={!!editor && (editor.canWrite || data.demo)}
          movesBlocked={movesBlocked}
          onDiscardMoves={() => editor?.reset()}
          onReviewMoves={() => setConfirm("moves")}
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
          currentSlot={menuRow?.slot ?? ""}
          targets={moveInfo.targets}
          blocked={moveInfo.blocked}
          onPick={(slot) => {
            editor?.stage(menuPlayer.id, slot);
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
            : "They go to ESPN together as one change to your lineup, which carries forward until you change it again."
        }
        lines={(editor?.moves ?? []).map((m) => ({
          key: String(m.player_id),
          left: editor?.playerById.get(m.player_id)?.name ?? `#${m.player_id}`,
          right: (
            <span className={s.mono} style={{ color: "var(--text-2)" }}>
              {slotName(m.from_slot_id)} → {slotName(m.to_slot_id)}
            </span>
          ),
        }))}
        confirmLabel="Send to ESPN"
        busy={!!editor?.applying}
        error={editor?.applyError && editor.moveErrors.length === 0 ? userMessage(editor.applyError) : editor?.moveErrors[0]?.message ?? null}
        onConfirm={() => void editor?.apply()}
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
