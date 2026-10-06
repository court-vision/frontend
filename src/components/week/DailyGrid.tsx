"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
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
import { Lock } from "lucide-react";
import { slotName } from "@/lib/lineup-editor";
import { isOutStatus, type Seat, type SlotRowDef, type WeekGrid as Grid } from "@/lib/week-grid";
import type { LineupPlayer } from "@/types/lineup-editor";
import { Headshot } from "./Headshot";
import { DayCell, type Cursor, type DropTarget } from "./WeekGrid";
import { monthDay, oppShort, pts, shortName, signed } from "./format";
import s from "./week.module.css";

/** Rearranging the board day's lineup: one day column takes drags and drops. */
export interface SeatDragApi {
  day: number;
  /** Valid drop spots (slot row keys) for the player in `rowKey` that day. */
  targetsFor: (rowKey: string) => Map<string, DropTarget> | null;
  onDrop: (fromKey: string, toKey: string) => void;
}

interface DailyGridProps {
  grid: Grid;
  todayIndex: number | null;
  boardById: ReadonlyMap<number, LineupPlayer>;
  /** `key` is a slot row, `col` a day index. */
  cursor: Cursor | null;
  onCursor: (c: Cursor) => void;
  heat: boolean;
  youName: string;
  oppName: string;
  onSeat: (playerId: number, day: number, el: HTMLElement) => void;
  drag: SeatDragApi | null;
}

const SEAT_SPRING = { type: "spring", stiffness: 520, damping: 44, mass: 0.7 } as const;
const dndId = (day: number, rowKey: string) => `${day}:${rowKey}`;
const rowOf = (id: string) => id.split(":")[1].split("#")[0];

export function DailyGrid({
  grid,
  todayIndex,
  boardById,
  cursor,
  onCursor,
  heat,
  youName,
  oppName,
  onSeat,
  drag,
}: DailyGridProps) {
  const { slots, seats } = grid.lineups;
  const days = grid.days;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hotDay, setHotDay] = useState<number | null>(null);
  // Fixed minimums, so the week fits the screen instead of growing to its longest name.
  const cols = `56px repeat(${days.length}, minmax(108px, 1.35fr) minmax(60px, 0.8fr))`;
  const minWidth = 56 + days.length * (108 + 60);
  const peak = Math.max(1, ...seats.flatMap((day) => day.map((st) => (st?.cell.counts ? st.cell.value ?? 0 : 0))));

  // ---- drag ----
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [targets, setTargets] = useState<Map<string, DropTarget> | null>(null);
  const dragSeat = drag && dragKey ? seats[drag.day][slots.findIndex((r) => r.key === dragKey)] : null;
  const overTarget = overKey && targets ? targets.get(overKey) ?? null : null;

  const onDragStart = (e: DragStartEvent) => {
    const key = rowOf(String(e.active.id));
    setDragKey(key);
    setTargets(drag?.targetsFor(key) ?? new Map());
  };
  const onDragOver = (e: DragOverEvent) => setOverKey(e.over ? rowOf(String(e.over.id)) : null);
  const endDrag = () => {
    setDragKey(null);
    setOverKey(null);
    setTargets(null);
  };
  const onDragEnd = (e: DragEndEvent) => {
    const to = e.over ? rowOf(String(e.over.id)) : null;
    if (dragKey && to && targets?.has(to)) drag?.onDrop(dragKey, to);
    endDrag();
  };
  const dropState = (day: number, key: string) => {
    if (!dragKey || !drag || day !== drag.day) return undefined;
    if (key === dragKey) return "source";
    if (!targets?.has(key)) return "invalid";
    return key === overKey ? "over" : "valid";
  };

  useEffect(() => {
    if (!cursor) return;
    wrapRef.current
      ?.querySelector<HTMLElement>(`[data-slotkey="${cursor.key}"] [data-day="${cursor.col}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [cursor]);

  // Per day: who plays in a lineup spot, and spots where nobody plays.
  const dayStats = days.map((d, i) => {
    let playing = 0;
    let idle = 0;
    slots.forEach((def, r) => {
      if (def.group !== "active") return;
      const st = seats[i][r];
      if (st && st.cell.state !== "none" && st.cell.state !== "out" && st.cell.state !== "dnp") playing++;
      else idle++;
    });
    return { playing, idle, past: d.kind === "past" };
  });

  return (
    <DndContext
      id="daily-grid" // a fixed id keeps its aria ids the same on the server and the client
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
        aria-label="Daily lineups for the week"
        onMouseLeave={() => setHotDay(null)}
      >
        <div className={s.grid} style={{ ["--cols" as string]: cols, minWidth }}>
          <div className={s.head} role="row">
            <div className={s.slotCell} role="columnheader">
              <span className={s.label}>Slot</span>
            </div>
            {days.map((d, i) => (
              <div
                key={d.date}
                className={s.dayHead}
                role="columnheader"
                data-today={d.index === todayIndex}
                data-hotcol={hotDay === i}
                data-board={drag?.day === i}
                onMouseEnter={() => setHotDay(i)}
                title={
                  dayStats[i].past
                    ? "ESPN lineups for past days aren't recorded, so the spots show today's lineup"
                    : drag?.day === i
                      ? "Drag players in this column to change your ESPN lineup; later days follow it"
                      : undefined
                }
              >
                <span className={s.headDow}>
                  {d.index === todayIndex ? <span className={s.todayTag}>TODAY </span> : null}
                  {d.dow.toUpperCase()} {monthDay(d.date)}
                </span>
                <span className={s.headSub}>
                  {dayStats[i].past
                    ? `${dayStats[i].playing} played`
                    : `${dayStats[i].playing} playing${dayStats[i].idle ? ` · ${dayStats[i].idle} idle` : ""}`}
                </span>
              </div>
            ))}
          </div>

          <LayoutGroup>
            {slots.map((def, r) => {
              const starts = def.group !== "active" && (r === 0 || slots[r - 1].group !== def.group);
              return (
                <Fragment key={def.key}>
                  {starts ? (
                    <div className={s.groupRow} role="presentation">
                      <div className={s.groupLabel}>
                        <span className={s.label} style={{ color: "var(--text-2)" }}>
                          {def.group === "bench" ? "Bench" : "IR"}
                        </span>
                      </div>
                      <div className={s.groupFill}>
                        <span className={s.sub} style={{ paddingLeft: 10 }}>
                          {def.group === "bench" ? "games here don't count" : "doesn't score"}
                        </span>
                      </div>
                    </div>
                  ) : null}
                  <div className={s.row} role="row" data-group={def.group} data-slotkey={def.key}>
                    <div className={s.slotCell} role="rowheader">
                      <span className={s.slotChip} data-group={def.group}>
                        {def.slot}
                      </span>
                    </div>
                    {days.map((d, i) => (
                      <SeatPair
                        key={d.date}
                        def={def}
                        seat={seats[i][r]}
                        day={i}
                        today={d.index === todayIndex}
                        hot={hotDay === i}
                        cursor={cursor?.key === def.key && cursor.col === i}
                        heat={heat}
                        peak={peak}
                        board={seats[i][r] ? boardById.get(seats[i][r]!.player.id) : undefined}
                        draggable={!!drag && drag.day === i}
                        droppable={!!drag && drag.day === i}
                        drop={dropState(i, def.key)}
                        onHot={setHotDay}
                        onCursor={onCursor}
                        onSeat={onSeat}
                      />
                    ))}
                  </div>
                </Fragment>
              );
            })}
          </LayoutGroup>

          <div className={s.foot}>
            {(["you", "opp", "edge"] as const).map((line) => (
              <div key={line} className={s.footRow} role="row">
                <div className={s.slotCell} role="rowheader" title={line === "you" ? youName : line === "opp" ? oppName : "You minus them"}>
                  <span className={s.footLabel}>{line === "you" ? "YOU" : line === "opp" ? "OPP" : "EDGE"}</span>
                </div>
                {days.map((d, i) => {
                  if (line === "edge") {
                    const m = (grid.you[i].projected ?? 0) - (grid.opp[i].projected ?? 0);
                    return (
                      <div key={d.date} className={s.footPair} data-today={d.index === todayIndex} role="gridcell">
                        <span className={`${s.footMain} ${m > 0.05 ? s.pos : m < -0.05 ? s.neg : ""}`}>{signed(m)}</span>
                      </div>
                    );
                  }
                  const t = line === "you" ? grid.you[i] : grid.opp[i];
                  return (
                    <div key={d.date} className={s.footPair} data-today={d.index === todayIndex} role="gridcell">
                      <span className={s.footMain}>{pts(t.projected)}</span>
                      {d.index === todayIndex && t.actual != null ? <span className={s.footSub}>now {pts(t.actual)}</span> : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragSeat ? (
          <div className={s.dragChip}>
            <Headshot nbaId={dragSeat.player.nbaId} name={dragSeat.player.name} size={32} />
            <span className={s.who}>
              <span className={s.name}>{dragSeat.player.name}</span>
              <span className={s.dropHint}>
                {overTarget
                  ? `→ ${slotName(overTarget.slotId)}${overTarget.swapWith ? ` · swap with ${shortName(overTarget.swapWith)}` : ""}`
                  : targets && targets.size > 0
                    ? `${targets.size} spot${targets.size === 1 ? "" : "s"} he can take`
                    : "nowhere he can go"}
              </span>
            </span>
            {overTarget ? (
              <span className={`${s.chip} ${overTarget.delta > 0.05 ? s.up : overTarget.delta < -0.05 ? s.down : s.flat}`}>
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
// One day's spot: who sits there, and his points
// ---------------------------------------------------------------------------

interface SeatPairProps {
  def: SlotRowDef;
  seat: Seat | null;
  day: number;
  today: boolean;
  hot: boolean;
  cursor: boolean;
  heat: boolean;
  peak: number;
  board: LineupPlayer | undefined;
  draggable: boolean;
  droppable: boolean;
  drop: string | undefined;
  onHot: (day: number) => void;
  onCursor: (c: Cursor) => void;
  onSeat: (playerId: number, day: number, el: HTMLElement) => void;
}

function SeatPair({
  def,
  seat,
  day,
  today,
  hot,
  cursor,
  heat,
  peak,
  board,
  draggable,
  droppable,
  drop,
  onHot,
  onCursor,
  onSeat,
}: SeatPairProps) {
  const p = seat?.player ?? null;
  const locked = today && !!board?.locked;
  const canDrag = draggable && !!p && !!board && !locked && !seat?.incoming;
  const nameRef = useRef<HTMLDivElement | null>(null);
  const drag = useDraggable({
    id: dndId(day, def.key),
    disabled: !canDrag,
    attributes: { role: "gridcell", tabIndex: -1, roleDescription: "draggable player" },
  });
  const dropName = useDroppable({ id: dndId(day, def.key), disabled: !droppable });
  const dropValue = useDroppable({ id: `${dndId(day, def.key)}#v`, disabled: !droppable });
  const { setNodeRef: setDragRef } = drag;
  const { setNodeRef: setDropRef } = dropName;
  // Stable refs: a new callback each render would hand the drag library null mid-drag.
  const nameRefCb = useCallback(
    (el: HTMLDivElement | null) => {
      nameRef.current = el;
      setDragRef(el);
      setDropRef(el);
    },
    [setDragRef, setDropRef]
  );
  const cell = seat?.cell ?? { state: "none" as const, value: null, opp: null, note: null, counts: false, tag: null };

  return (
    <>
      <div
        ref={nameRefCb}
        {...drag.attributes}
        {...(canDrag ? drag.listeners : {})}
        className={s.seatName}
        data-day={day}
        data-today={today}
        data-hotcol={hot}
        data-cursor={cursor}
        data-staged={seat?.staged}
        data-incoming={seat?.incoming}
        data-draggable={canDrag}
        data-drop={drop}
        onMouseEnter={() => onHot(day)}
        onClick={() => {
          onCursor({ key: def.key, col: day });
          if (p && nameRef.current && !seat?.incoming) onSeat(p.id, day, nameRef.current);
        }}
        title={p ? `${p.name} · ${p.team}` : undefined}
      >
        {p ? (
          // Keyed by day and player, so a move slides him to his new spot in that day's column.
          <motion.span
            layoutId={`seat-${day}-${p.id}`}
            transition={SEAT_SPRING}
            style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}
          >
            <Headshot nbaId={p.nbaId} name={p.name} size={22} />
            <span className={s.who}>
              <span className={s.seatNameText}>{shortName(p.name)}</span>
              <span className={s.seatSub}>
                <span>
                  {p.team}
                  {cell.opp ? ` ${oppShort(cell.opp)}` : ""}
                </span>
                {p.injury ? (
                  <span className={`${s.inj} ${isOutStatus(p.injury) ? "" : s.injSoft}`}>{p.injury.replace("_", " ")}</span>
                ) : null}
                {seat?.incoming ? <span style={{ color: "var(--preview)" }}>IN</span> : null}
              </span>
            </span>
            {locked ? <Lock size={11} className={s.lock} aria-label="Locked: his game has started" /> : null}
          </motion.span>
        ) : def.group === "active" ? (
          <span className={s.openSlot}>OPEN</span>
        ) : (
          <span className={s.sub}>—</span>
        )}
      </div>
      <DayCell
        cell={cell}
        col={day}
        incoming={!!seat?.incoming}
        today={today}
        hot={hot}
        cursor={false}
        heat={heat && cell.counts && cell.value != null ? Math.min(0.32, (cell.value / peak) * 0.32) : 0}
        onEnter={onHot}
        onClick={() => onCursor({ key: def.key, col: day })}
        className={s.seatValue}
        hideOpp
        drop={drop}
        cellRef={dropValue.setNodeRef}
      />
    </>
  );
}
