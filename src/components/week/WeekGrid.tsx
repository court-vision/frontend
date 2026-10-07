"use client";

import { Fragment, memo, useCallback, useEffect, useRef, useState } from "react";
import { LayoutGroup, motion } from "motion/react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ArrowLeftRight, Lock, Repeat2 } from "lucide-react";
import { BENCH_SLOT_ID, IR_SLOT_ID, isActiveSlot, slotName } from "@/lib/lineup-editor";
import { healthOf, type GridCell, type GridRow, type LineupMode, type WeekGrid as Grid } from "@/lib/week-grid";
import type { LineupPlayer } from "@/types/lineup-editor";
import { Headshot } from "@/components/desk/Headshot";
import { monthDay, oppShort, pts, signed, tip } from "./format";
import dk from "@/components/desk/desk.module.css";
import s from "./week.module.css";

export interface Cursor {
  key: string;
  /** 0 = roster column, 1…n = days, n + 1 = week total. */
  col: number;
}

/** Where a dragged player may land: the row's slot, who swaps back, and the change to today. */
export interface DropTarget {
  slotId: number;
  swapWith: string | null;
  delta: number;
}

export interface DragApi {
  /** Valid drop rows for the player in `rowKey`, or null when he can't be dragged. Every row is a
   * drop zone (measured when the drag starts); validity is checked against this map. */
  targetsFor: (rowKey: string) => Map<string, DropTarget> | null;
  onDrop: (fromKey: string, toKey: string) => void;
}

interface WeekGridProps {
  grid: Grid;
  todayIndex: number | null;
  viewable: ReadonlySet<number>;
  boardById: ReadonlyMap<number, LineupPlayer>;
  cursor: Cursor | null;
  onCursor: (c: Cursor) => void;
  heat: boolean;
  youName: string;
  oppName: string;
  onViewDay: (day: number) => void;
  onMove: (rowKey: string, el: HTMLElement) => void;
  onReplace: (rowKey: string, el: HTMLElement) => void;
  /** Present when the lineup on screen can be rearranged (today, ESPN board). */
  drag: DragApi | null;
  mode: LineupMode;
}

type Group = "active" | "bench" | "ir" | "drop";

const ROW_SPRING = { type: "spring", stiffness: 520, damping: 44, mass: 0.7 } as const;

function slotGroup(slotId: number | null): Group {
  if (slotId === BENCH_SLOT_ID) return "bench";
  if (slotId === IR_SLOT_ID) return "ir";
  return "active";
}

/** Each row's group: by its slot on the selected day; a previewed add's outgoing player has his own, last. */
function rowGroups(rows: GridRow[]): Group[] {
  return rows.map((r) => (r.outgoing ? "drop" : slotGroup(r.slotId)));
}

export function WeekGrid({
  grid,
  todayIndex,
  viewable,
  boardById,
  cursor,
  onCursor,
  heat,
  youName,
  oppName,
  onViewDay,
  onMove,
  onReplace,
  drag,
  mode,
}: WeekGridProps) {
  const [hotCol, setHotCol] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const n = grid.days.length;
  const cols = `minmax(272px, 304px) repeat(${n}, minmax(88px, 1fr)) minmax(92px, 104px)`;
  const peak = Math.max(1, ...grid.rows.flatMap((r) => r.cells.map((c) => (c.counts ? c.value ?? 0 : 0))));
  const groups = rowGroups(grid.rows);
  const isToday = grid.viewDay === todayIndex;
  // Rows follow the ESPN board in the as-set view, and on today in either view.
  const onBoard = mode === "espn" || isToday;

  // ---- drag ----
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [targets, setTargets] = useState<Map<string, DropTarget> | null>(null);
  const dragRow = dragKey ? grid.rows.find((r) => r.key === dragKey) ?? null : null;
  const overTarget = overKey && targets ? targets.get(overKey) ?? null : null;

  const onDragStart = (e: DragStartEvent) => {
    const key = String(e.active.id);
    setDragKey(key);
    setTargets(drag?.targetsFor(key) ?? new Map());
  };
  const onDragOver = (e: DragOverEvent) => setOverKey(e.over ? String(e.over.id) : null);
  const endDrag = () => {
    setDragKey(null);
    setOverKey(null);
    setTargets(null);
  };
  const onDragEnd = (e: DragEndEvent) => {
    const to = e.over ? String(e.over.id) : null;
    if (dragKey && to && targets?.has(to)) drag?.onDrop(dragKey, to);
    endDrag();
  };

  const dropState = (key: string): "source" | "over" | "valid" | "invalid" | undefined => {
    if (!dragKey) return undefined;
    if (key === dragKey) return "source";
    if (!targets?.has(key)) return "invalid";
    return key === overKey ? "over" : "valid";
  };

  // Keep the cursor cell on screen as it moves.
  useEffect(() => {
    if (!cursor) return;
    const el = wrapRef.current?.querySelector<HTMLElement>(
      `[data-rowkey="${cursor.key}"] [data-col="${cursor.col}"]`
    );
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [cursor]);

  return (
    <DndContext
      id="week-grid" // a fixed id keeps its aria ids the same on the server and the client
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={endDrag}
    >
      <div
        ref={wrapRef}
        className={s.gridWrap}
        role="grid"
        aria-label="Your week, player by day"
        aria-rowcount={grid.rows.length + 4}
        onMouseLeave={() => setHotCol(null)}
      >
        <div className={s.grid} style={{ ["--cols" as string]: cols }}>
          <div className={s.head} role="row">
            <div className={s.rosterCell} role="columnheader">
              <span className={dk.label}>
                {onBoard
                  ? "ESPN lineup"
                  : `Best lineup · ${grid.days[grid.viewDay] ? `${grid.days[grid.viewDay].dow} ${monthDay(grid.days[grid.viewDay].date)}` : ""}`}
              </span>
              {drag ? <span className={dk.sub} style={{ marginLeft: "auto" }}>drag to rearrange</span> : null}
            </div>
            {grid.days.map((d, i) => {
              const canView = viewable.has(d.index);
              const games = grid.rows.filter((r) => r.player && r.cells[i].state !== "none").length;
              const inner = (
                <>
                  <span className={s.headDow}>
                    {d.index === todayIndex ? <span className={s.todayTag}>TODAY </span> : null}
                    {d.dow.toUpperCase()} {monthDay(d.date)}
                  </span>
                  <span className={s.headSub}>
                    {d.kind === "past"
                      ? `${games} played`
                      : d.kind === "today" || grid.you[i].starts === games
                        ? `${games} game${games === 1 ? "" : "s"}`
                        : `${grid.you[i].starts} of ${games} start`}
                  </span>
                </>
              );
              const common = {
                className: s.headCell,
                role: "columnheader",
                "data-today": d.index === todayIndex,
                "data-view": d.index === grid.viewDay,
                "data-hotcol": hotCol === i + 1,
                onMouseEnter: () => setHotCol(i + 1),
              };
              return canView ? (
                <button
                  key={d.date}
                  type="button"
                  {...common}
                  title={`Show the lineup for ${d.dow} ${monthDay(d.date)}`}
                  onClick={() => onViewDay(d.index)}
                >
                  {inner}
                </button>
              ) : (
                <div key={d.date} {...common}>
                  {inner}
                </div>
              );
            })}
            <div className={s.weekCell} role="columnheader" onMouseEnter={() => setHotCol(n + 1)}>
              <span className={s.headDow} style={{ color: "var(--text-2)" }}>WEEK</span>
              <span className={s.headSub}>projected</span>
            </div>
          </div>

          <LayoutGroup>
            {grid.rows.map((row, i) => {
              const group = groups[i];
              const starts = group !== "active" && (i === 0 || groups[i - 1] !== group);
              const count = groups.filter((g, j) => g === group && grid.rows[j].player && grid.rows[j].kind !== "incoming").length;
              return (
                <Fragment key={row.key}>
                  {starts ? <GroupRow group={group} count={count} onBoard={onBoard} /> : null}
                  <GridRowView
                    row={row}
                    group={group}
                    drop={dropState(row.key)}
                    droppable={!!drag}
                    draggable={!!drag && row.kind === "player" && !!row.player && !boardById.get(row.player.id)?.locked}
                    board={row.player ? boardById.get(row.player.id) : undefined}
                    isToday={isToday}
                    todayIndex={todayIndex}
                    cursor={cursor?.key === row.key ? cursor.col : null}
                    hotCol={hotCol}
                    heat={heat}
                    peak={peak}
                    lastCol={n + 1}
                    onCursor={onCursor}
                    onHotCol={setHotCol}
                    onMove={onMove}
                    onReplace={onReplace}
                  />
                </Fragment>
              );
            })}
          </LayoutGroup>

          <div className={s.foot}>
            <FootRow label={youName} sub="you" totals={grid.you} todayIndex={todayIndex} week={grid.projected.you} />
            <FootRow label={oppName} sub="opponent" totals={grid.opp} todayIndex={todayIndex} week={grid.projected.opp} />
            <div className={s.footRow} role="row">
              <div className={s.rosterCell} role="rowheader">
                <span className={s.footLabel}>EDGE</span>
              </div>
              {grid.days.map((d, i) => {
                const m = (grid.you[i].projected ?? 0) - (grid.opp[i].projected ?? 0);
                return (
                  <div key={d.date} className={s.footCell} data-today={i === todayIndex} role="gridcell">
                    <span className={`${s.footMain} ${m > 0.05 ? s.pos : m < -0.05 ? s.neg : ""}`}>{signed(m)}</span>
                  </div>
                );
              })}
              <div className={s.weekCell} role="gridcell">
                {(() => {
                  const m = grid.projected.you - grid.projected.opp;
                  return <span className={m > 0 ? s.pos : m < 0 ? s.neg : ""}>{signed(m)}</span>;
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragRow?.player ? (
          <div className={s.dragChip}>
            <Headshot nbaId={dragRow.player.nbaId} name={dragRow.player.name} size={32} />
            <span className={s.who}>
              <span className={s.name}>{dragRow.player.name}</span>
              <span className={s.dropHint}>
                {overTarget
                  ? `→ ${slotName(overTarget.slotId)}${overTarget.swapWith ? ` · swap with ${overTarget.swapWith}` : ""}`
                  : targets && targets.size > 0
                    ? `${targets.size} place${targets.size === 1 ? "" : "s"} he can go`
                    : "nowhere he can go today"}
              </span>
            </span>
            {overTarget ? (
              <span className={`${dk.chip} ${overTarget.delta > 0.05 ? dk.up : overTarget.delta < -0.05 ? dk.down : dk.flat}`}>
                {signed(overTarget.delta)} wk
              </span>
            ) : null}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

function GroupRow({ group, count, onBoard }: { group: Group; count: number; onBoard: boolean }) {
  const label = group === "bench" ? "Bench" : group === "drop" ? "Dropping" : "Injured reserve";
  const note =
    group === "bench"
      ? onBoard
        ? "games here don't count"
        : "no game, or no room that day"
      : group === "drop"
        ? "leaves the roster for the free agent"
        : "doesn't score";
  return (
    <motion.div layout="position" transition={ROW_SPRING} className={s.groupRow} role="presentation">
      <div className={s.groupLabel}>
        <span className={dk.label} style={{ color: "var(--text-2)" }}>{label}</span>
        <span className={dk.sub}>{count === 0 ? "empty" : `${count} · ${note}`}</span>
      </div>
      <div className={s.groupFill} />
    </motion.div>
  );
}

interface GridRowViewProps {
  row: GridRow;
  group: Group;
  drop: "source" | "over" | "valid" | "invalid" | undefined;
  droppable: boolean;
  draggable: boolean;
  board: LineupPlayer | undefined;
  isToday: boolean;
  todayIndex: number | null;
  /** The cursor's column when it is on this row. */
  cursor: number | null;
  hotCol: number | null;
  heat: boolean;
  peak: number;
  lastCol: number;
  onCursor: (c: Cursor) => void;
  onHotCol: (col: number) => void;
  onMove: (rowKey: string, el: HTMLElement) => void;
  onReplace: (rowKey: string, el: HTMLElement) => void;
}

function GridRowView({
  row,
  group,
  drop,
  droppable,
  draggable,
  board,
  isToday,
  todayIndex,
  cursor,
  hotCol,
  heat,
  peak,
  lastCol,
  onCursor,
  onHotCol,
  onMove,
  onReplace,
}: GridRowViewProps) {
  const { setNodeRef } = useDroppable({ id: row.key, disabled: !droppable });
  return (
    <motion.div
      ref={setNodeRef}
      layout="position"
      transition={ROW_SPRING}
      className={s.row}
      role="row"
      data-rowkey={row.key}
      data-kind={row.kind}
      data-group={group}
      data-drop={drop}
    >
      <RosterCell
        row={row}
        group={group}
        board={board}
        isToday={isToday}
        draggable={draggable}
        cursor={cursor === 0}
        onFocus={() => onCursor({ key: row.key, col: 0 })}
        onMove={(el) => onMove(row.key, el)}
        onReplace={(el) => onReplace(row.key, el)}
      />
      {row.cells.map((cell, i) => (
        <DayCell
          key={i}
          cell={cell}
          col={i + 1}
          incoming={row.kind === "incoming"}
          today={i === todayIndex}
          hot={hotCol === i + 1}
          cursor={cursor === i + 1}
          heat={heat && cell.counts && cell.value != null ? Math.min(0.32, (cell.value / peak) * 0.32) : 0}
          onEnter={onHotCol}
          onClick={() => onCursor({ key: row.key, col: i + 1 })}
        />
      ))}
      <div
        className={s.weekCell}
        role="gridcell"
        data-col={lastCol}
        data-cursor={cursor === lastCol}
        onMouseEnter={() => onHotCol(lastCol)}
        onClick={() => onCursor({ key: row.key, col: lastCol })}
        style={row.outgoing ? { color: "var(--text-3)", textDecoration: "line-through" } : row.kind === "incoming" ? { color: "var(--preview)" } : undefined}
      >
        {row.player ? pts(row.total) : ""}
      </div>
    </motion.div>
  );
}

function FootRow({
  label,
  sub,
  totals,
  todayIndex,
  week,
}: {
  label: string;
  sub: string;
  totals: Grid["you"];
  todayIndex: number | null;
  week: number;
}) {
  return (
    <div className={s.footRow} role="row">
      <div className={s.rosterCell} role="rowheader">
        <span className={s.footLabel}>{sub === "you" ? "YOU" : "OPP"}</span>
        <span className={s.name} style={{ color: "var(--text-2)", fontSize: 12 }}>{label}</span>
      </div>
      {totals.map((t, i) => (
        <div key={i} className={s.footCell} data-today={i === todayIndex} role="gridcell">
          <span className={s.footMain}>{pts(t.projected)}</span>
          {i === todayIndex && t.actual != null ? <span className={s.footSub}>now {pts(t.actual)}</span> : null}
        </div>
      ))}
      <div className={s.weekCell} role="gridcell">
        {pts(week)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

interface RosterCellProps {
  row: GridRow;
  group: Group;
  board: LineupPlayer | undefined;
  isToday: boolean;
  draggable: boolean;
  cursor: boolean;
  onFocus: () => void;
  onMove: (el: HTMLElement) => void;
  onReplace: (el: HTMLElement) => void;
}

const RosterCell = memo(function RosterCell({ row, group, board, isToday, draggable, cursor, onFocus, onMove, onReplace }: RosterCellProps) {
  const p = row.player;
  const cellRef = useRef<HTMLDivElement | null>(null);
  const { setNodeRef, listeners, attributes } = useDraggable({
    id: row.key,
    disabled: !draggable,
    attributes: { role: "rowheader", tabIndex: -1, roleDescription: "draggable player" },
  });
  // A stable ref: a new callback each render would hand the drag library null mid-drag.
  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      cellRef.current = el;
      setNodeRef(el);
    },
    [setNodeRef]
  );
  const chip = (
    <span
      className={s.slotChip}
      data-group={group}
      data-staged={row.staged}
      data-in={row.kind === "incoming"}
    >
      {row.slot}
    </span>
  );

  if (!p) {
    const ir = row.slotId === IR_SLOT_ID;
    return (
      <div ref={ref} {...attributes} className={s.rosterCell} data-col={0} data-cursor={cursor} onClick={onFocus}>
        {chip}
        {ir ? (
          <span className={dk.sub}>an OUT player can go here</span>
        ) : (
          <>
            <span className={s.openSlot}>OPEN</span>
            <span className={dk.sub}>nobody eligible plays · room to stream</span>
          </>
        )}
      </div>
    );
  }

  const positions = (board ? board.eligible_slot_ids.filter(isActiveSlot) : p.eligible)
    .filter((id) => id <= 4)
    .map(slotName)
    .join("/");
  const locked = isToday && !!board?.locked;

  return (
    <div
      ref={ref}
      {...attributes}
      {...(draggable ? listeners : {})}
      className={s.rosterCell}
      data-col={0}
      data-cursor={cursor}
      data-draggable={draggable}
      data-health={healthOf(p.injury)}
      title={`${p.name} · ${p.injury ? p.injury.replace(/_/g, " ").toLowerCase() : "active"}`}
      onClick={(e) => {
        onFocus();
        if ((e.target as HTMLElement).closest("button")) return;
        if (cellRef.current && row.kind !== "incoming") onMove(cellRef.current);
      }}
    >
      {chip}
      <Headshot nbaId={p.nbaId} name={p.name} />
      <span className={s.who}>
        <span className={`${s.name} ${row.outgoing ? s.nameOut : ""}`}>{p.name}</span>
        <span className={s.meta}>
          <span>{p.team}</span>
          {positions ? <span>{positions}</span> : null}
          {row.kind === "incoming" ? <span style={{ color: "var(--preview)" }}>FREE AGENT</span> : null}
        </span>
      </span>
      {locked ? (
        <span className={s.lock} title="Locked: his game has started">
          <Lock size={12} />
        </span>
      ) : null}
      {row.kind === "player" ? (
        <span className={s.rowActions}>
          <button
            type="button"
            className={dk.iconBtn}
            style={{ width: 26, height: 26 }}
            aria-label={`Move ${p.name}`}
            title="Move (M)"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => cellRef.current && onMove(cellRef.current)}
          >
            <ArrowLeftRight size={13} />
          </button>
          <button
            type="button"
            className={dk.iconBtn}
            style={{ width: 26, height: 26 }}
            aria-label={`Replace ${p.name} with a free agent`}
            title="Replace (R)"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => cellRef.current && onReplace(cellRef.current)}
          >
            <Repeat2 size={13} />
          </button>
        </span>
      ) : null}
    </div>
  );
});

interface DayCellProps {
  cell: GridCell;
  col: number;
  incoming: boolean;
  today: boolean;
  hot: boolean;
  cursor: boolean;
  heat: number;
  onEnter: (col: number) => void;
  onClick: () => void;
  className?: string;
  /** Drag state for the daily view's drop targets. */
  drop?: string;
  cellRef?: (el: HTMLDivElement | null) => void;
  /** Leave the opponent out of the top line (the daily view shows it beside the name). */
  hideOpp?: boolean;
}

const CELL_TITLES: Record<string, string | undefined> = {
  BENCH: "On the bench: this game doesn't count",
  SITS: "No room in the best lineup that day",
  IR: "On IR",
  DROP: "Being replaced in the preview",
  out: "Out for this game",
  dnp: "Didn't play",
};

export const DayCell = memo(function DayCell({
  cell,
  col,
  incoming,
  today,
  hot,
  cursor,
  heat,
  onEnter,
  onClick,
  className,
  drop,
  cellRef,
  hideOpp,
}: DayCellProps) {
  // A live value that moves flashes once.
  const prev = useRef(cell.value);
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    if (cell.state === "live" && prev.current != null && cell.value != null && cell.value !== prev.current) {
      setFlash((f) => f + 1);
    }
    prev.current = cell.value;
  }, [cell.value, cell.state]);

  let main: string;
  switch (cell.state) {
    case "none":
      main = "·";
      break;
    case "out":
    case "dnp":
      main = "—";
      break;
    default:
      main = pts(cell.value);
  }

  // Status is carried by styling (the bench outline, strike-throughs, the row's strip), not words.
  let right: React.ReactNode = null;
  if (cell.state === "live")
    right = (
      <span className={s.clock}>
        <span className={dk.liveDot} style={{ width: 5, height: 5 }} />
        {cell.note}
      </span>
    );
  else if (cell.state === "upcoming") right = <span>{tip(cell.note)}</span>;
  else if (cell.state === "final" && today) right = <span>F</span>;

  return (
    <div
      ref={cellRef}
      className={`${s.cell} ${incoming ? s.incomingCell : ""} ${className ?? ""}`}
      role="gridcell"
      data-col={col}
      data-drop={drop}
      data-state={cell.state}
      data-counts={cell.counts}
      data-tag={cell.tag ?? undefined}
      data-today={today}
      data-hotcol={hot}
      data-cursor={cursor}
      title={CELL_TITLES[cell.tag ?? cell.state]}
      onMouseEnter={() => onEnter(col)}
      onClick={onClick}
    >
      {heat > 0 ? <span className={s.heat} style={{ opacity: heat }} /> : null}
      {cell.state !== "none" ? (
        <span className={s.cellTop} style={{ position: "relative" }}>
          <span>{hideOpp ? "" : oppShort(cell.opp)}</span>
          {right}
        </span>
      ) : null}
      <span key={flash} className={`${s.cellMain} ${flash ? s.flash : ""}`} style={{ position: "relative" }}>
        {main}
      </span>
    </div>
  );
});
