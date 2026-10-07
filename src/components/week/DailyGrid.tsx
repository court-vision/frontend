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
import { Lock, X } from "lucide-react";
import { slotName } from "@/lib/lineup-editor";
import {
  healthOf,
  type GridCell,
  type Seat,
  type SlotRowDef,
  type StatLine,
  type WeekGrid as Grid,
} from "@/lib/week-grid";
import type { PickupView } from "@/lib/pickups";
import type { LineupState } from "@/types/lineup-editor";
import { Headshot } from "@/components/desk/Headshot";
import { type Cursor, type DropTarget } from "./WeekGrid";
import { monthDay, oppShort, pts, shortName, signed, tip, weekdayTime } from "./format";
import dk from "@/components/desk/desk.module.css";
import s from "./week.module.css";

/** Rearranging a day's ESPN lineup: every editable day column takes drags and drops. */
export interface SeatDragApi {
  /** Per day index: whether that day's lineup can be changed. */
  editable: boolean[];
  /** Valid drop spots (slot row keys) on `day` for the player in `rowKey`. */
  targetsFor: (day: number, rowKey: string) => Map<string, DropTarget> | null;
  onDrop: (day: number, fromKey: string, toKey: string) => void;
}

interface DailyGridProps {
  grid: Grid;
  todayIndex: number | null;
  /** Each day's ESPN lineup (locks are per day). */
  boards: ReadonlyArray<LineupState | undefined>;
  /** The day shown in full (whole names and the box score); null = every day collapsed. */
  focusDay: number | null;
  onFocusDay: (day: number) => void;
  /** `key` is a slot row, `col` a day index. */
  cursor: Cursor | null;
  onCursor: (c: Cursor) => void;
  heat: boolean;
  youName: string;
  oppName: string;
  onSeat: (playerId: number, day: number, el: HTMLElement) => void;
  drag: SeatDragApi | null;
  /** A free agent is picked: clicking a roster player makes him the drop. */
  picking?: boolean;
  /** Scheduled pickups: a row each above the lineup, the free agent from his day on. */
  pickups?: PickupView[];
  /** Hovering a pending pickup previews it in the grid. */
  onPreviewPickup?: (id: number | null) => void;
  onCancelPickup?: (id: number) => void;
  /** The pickup being cancelled, while that request is out. */
  cancelling?: number | null;
}

/** The focused day's box score, in this order (FPTS follows). */
const STATS: Array<{ key: string; label: string; get: (l: StatLine) => string }> = [
  { key: "min", label: "MIN", get: (l) => (l.min != null ? String(l.min) : "—") },
  { key: "pts", label: "P", get: (l) => String(l.pts) },
  { key: "reb", label: "R", get: (l) => String(l.reb) },
  { key: "ast", label: "A", get: (l) => String(l.ast) },
  { key: "blk", label: "BLK", get: (l) => String(l.blk) },
  { key: "stl", label: "STL", get: (l) => String(l.stl) },
  { key: "fg", label: "FG", get: (l) => `${l.fgm}/${l.fga}` },
  { key: "ft", label: "FT", get: (l) => `${l.ftm}/${l.fta}` },
  { key: "3pm", label: "3PM", get: (l) => String(l.fg3m) },
  { key: "tov", label: "TO", get: (l) => String(l.tov) },
];
// Eleven equal cells, the ten stats and FPTS, so the spacing is even.
const STAT_CELL = 34;
const STAT_TRACKS = `repeat(${STATS.length + 1}, minmax(0, 1fr))`;
const STAT_WIDTH = STAT_CELL * (STATS.length + 1) + 16;
const FOCUS_NAME = "minmax(140px, 168px)";
const FOCUS_NAME_MIN = 140;
const DAY_NAME_MIN = 76;
const DAY_VALUE = 58;

const SEAT_SPRING = { type: "spring", stiffness: 520, damping: 44, mass: 0.7 } as const;
const dndId = (day: number, rowKey: string) => `${day}:${rowKey}`;
const parseId = (id: string) => {
  const [day, rest] = id.split(":");
  return { day: Number(day), key: rest.split("#")[0] };
};

export function DailyGrid({
  grid,
  todayIndex,
  boards,
  focusDay,
  onFocusDay,
  cursor,
  onCursor,
  heat,
  youName,
  oppName,
  onSeat,
  drag,
  picking = false,
  pickups = [],
  onPreviewPickup,
  onCancelPickup,
  cancelling = null,
}: DailyGridProps) {
  const { slots, seats } = grid.lineups;
  const days = grid.days;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hotDay, setHotDay] = useState<number | null>(null);
  // A focused day gets a whole name and the box score; the other days share what's left.
  // With no focused day, every day is collapsed and they share the whole width.
  const cols =
    focusDay == null
      ? `56px repeat(${days.length}, minmax(${DAY_NAME_MIN}px, 1.5fr) minmax(${DAY_VALUE}px, 1fr))`
      : `56px ${days
          .map((_, i) => (i === focusDay ? `${FOCUS_NAME} ${STAT_WIDTH}px` : `minmax(${DAY_NAME_MIN}px, 1fr) ${DAY_VALUE}px`))
          .join(" ")}`;
  const minWidth =
    focusDay == null
      ? 56 + days.length * (DAY_NAME_MIN + DAY_VALUE)
      : 56 + (days.length - 1) * (DAY_NAME_MIN + DAY_VALUE) + FOCUS_NAME_MIN + STAT_WIDTH;
  const peak = Math.max(1, ...seats.flatMap((day) => day.map((st) => (st?.cell.counts ? st.cell.value ?? 0 : 0))));

  // ---- drag ----
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [dragAt, setDragAt] = useState<{ day: number; key: string } | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [targets, setTargets] = useState<Map<string, DropTarget> | null>(null);
  const dragSeat = dragAt ? seats[dragAt.day]?.[slots.findIndex((r) => r.key === dragAt.key)] ?? null : null;
  const overTarget = overKey && targets ? targets.get(overKey) ?? null : null;

  const onDragStart = (e: DragStartEvent) => {
    const at = parseId(String(e.active.id));
    setDragAt(at);
    setTargets(drag?.targetsFor(at.day, at.key) ?? new Map());
  };
  const onDragOver = (e: DragOverEvent) => {
    const over = e.over ? parseId(String(e.over.id)) : null;
    setOverKey(over && dragAt && over.day === dragAt.day ? over.key : null);
  };
  const endDrag = () => {
    setDragAt(null);
    setOverKey(null);
    setTargets(null);
  };
  const onDragEnd = (e: DragEndEvent) => {
    const over = e.over ? parseId(String(e.over.id)) : null;
    if (dragAt && over && over.day === dragAt.day && targets?.has(over.key)) drag?.onDrop(dragAt.day, dragAt.key, over.key);
    endDrag();
  };
  const dropState = (day: number, key: string) => {
    if (!dragAt || day !== dragAt.day) return undefined;
    if (key === dragAt.key) return "source";
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

  // One lineup spot across the week (the group's label first when it starts a group).
  const renderRow = (def: SlotRowDef, r: number) => {
    const starts = def.group !== "active" && (r === 0 || slots[r - 1].group !== def.group);
    return (
      <Fragment key={def.key}>
        {starts ? (
          <div className={s.groupRow} role="presentation">
            <div className={s.groupLabel}>
              <span className={dk.label} style={{ color: def.group === "drop" ? "var(--down)" : "var(--text-2)" }}>
                {def.group === "bench" ? "Bench" : def.group === "ir" ? "IR" : "Dropping"}
              </span>
            </div>
            <div className={s.groupFill}>
              <span className={dk.sub} style={{ paddingLeft: 10 }}>
                {def.group === "bench"
                  ? "games here don't count"
                  : def.group === "ir"
                    ? "doesn't score"
                    : "leaves the roster for the free agent: his games stop counting"}
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
              focused={i === focusDay}
              today={d.index === todayIndex}
              hot={hotDay === i}
              cursor={cursor?.key === def.key && cursor.col === i}
              heat={heat}
              peak={peak}
              locked={!!seats[i][r] && !!boards[i]?.players.find((p) => p.player_id === seats[i][r]!.player.id)?.locked}
              dnd={!!drag?.editable[i] && def.group !== "drop"}
              drop={dropState(i, def.key)}
              onHot={setHotDay}
              onCursor={onCursor}
              onSeat={onSeat}
            />
          ))}
        </div>
      </Fragment>
    );
  };

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
        <div className={s.grid} style={{ ["--cols" as string]: cols, minWidth }} data-picking={picking}>
          <div className={s.head} role="row">
            <div className={s.slotCell} role="columnheader">
              <span className={dk.label}>Slot</span>
            </div>
            {days.map((d, i) => {
              const focused = i === focusDay;
              const stats = dayStats[i];
              const sub = stats.past
                ? `${stats.playing} played`
                : focused
                  ? `${stats.playing} playing${stats.idle ? ` · ${stats.idle} idle` : ""}`
                  : `${stats.playing} on${stats.idle ? ` · ${stats.idle} idle` : ""}`;
              return (
                <Fragment key={d.date}>
                  <button
                    type="button"
                    className={s.dayHead}
                    data-focus={focused}
                    data-today={d.index === todayIndex}
                    data-hotcol={hotDay === i}
                    data-editable={!!drag?.editable[i]}
                    onMouseEnter={() => setHotDay(i)}
                    onClick={() => onFocusDay(i)}
                    title={
                      stats.past
                        ? "ESPN lineups for past days aren't recorded, so the spots show today's lineup"
                        : drag?.editable[i]
                          ? "Drag players to change this day's ESPN lineup; it carries into later days until one has its own edit"
                          : undefined
                    }
                  >
                    <span className={s.headDow}>
                      {d.index === todayIndex ? <span className={s.todayTag}>TODAY </span> : null}
                      {d.dow.toUpperCase()} {monthDay(d.date)}
                    </span>
                    <span className={s.headSub}>{sub}</span>
                  </button>
                  {focused ? (
                    <div className={s.statHead} role="columnheader" data-today={d.index === todayIndex}>
                      <span className={s.statRow} style={{ gridTemplateColumns: STAT_TRACKS }}>
                        {STATS.map((x) => (
                          <span key={x.key}>{x.label}</span>
                        ))}
                        <span>FPTS</span>
                      </span>
                    </div>
                  ) : null}
                </Fragment>
              );
            })}
          </div>

          {/* Scheduled pickups lead, like a calendar's all-day lane: a preview below never moves them. */}
          {pickups.length ? (
            <div className={s.pickupLane}>
              <div className={s.groupRow} role="presentation">
                <div className={s.groupLabel}>
                  <span className={dk.label} style={{ color: "var(--preview)" }}>
                    Scheduled
                  </span>
                </div>
                <div className={s.groupFill}>
                  <span className={dk.sub} style={{ paddingLeft: 10 }}>
                    pickups made for you before that day&apos;s games · hover one to see it below
                  </span>
                </div>
              </div>
              {pickups.map((pk) => (
                <PickupRow
                  key={pk.id}
                  pickup={pk}
                  days={days}
                  focusDay={focusDay}
                  todayIndex={todayIndex}
                  cancelling={cancelling === pk.id}
                  onPreview={onPreviewPickup}
                  onCancel={onCancelPickup}
                />
              ))}
            </div>
          ) : null}

          <LayoutGroup>
            {slots.map((def, r) => (def.group === "drop" ? null : renderRow(def, r)))}
          </LayoutGroup>

          <div className={s.foot}>
            {/* A previewed add's outgoing player stays in view, pinned above the totals. */}
            {slots.map((def, r) => (def.group === "drop" ? renderRow(def, r) : null))}
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
// A scheduled pickup: empty before its day, the free agent from that day on
// ---------------------------------------------------------------------------

const STATUS_TAG: Record<PickupView["status"], string> = {
  pending: "SCHEDULED",
  executed: "ADDED",
  skipped: "SKIPPED",
  failed: "FAILED",
  expired: "EXPIRED",
  cancelled: "CANCELLED",
};

function PickupRow({
  pickup,
  days,
  focusDay,
  todayIndex,
  cancelling,
  onPreview,
  onCancel,
}: {
  pickup: PickupView;
  days: Grid["days"];
  focusDay: number | null;
  todayIndex: number | null;
  cancelling: boolean;
  onPreview?: (id: number | null) => void;
  onCancel?: (id: number) => void;
}) {
  const pending = pickup.status === "pending";
  const forWhom = pickup.drop ? `for ${shortName(pickup.drop.name)}` : "into an open spot";
  const first = pending && pickup.notBefore ? `first try ${weekdayTime(pickup.notBefore)}` : null;
  const title = [
    `${pickup.add.name}${pickup.drop ? `, dropping ${pickup.drop.name}` : ""}`,
    first,
    pickup.note,
  ]
    .filter(Boolean)
    .join(" · ");
  const cancel = pending && onCancel ? (
    <button
      type="button"
      className={s.pickupCancel}
      onClick={(e) => {
        e.stopPropagation();
        onCancel(pickup.id);
      }}
      disabled={cancelling}
      aria-label={`Cancel the pickup of ${pickup.add.name}`}
      title="Cancel this pickup"
    >
      <X size={12} />
    </button>
  ) : null;
  const status = (
    <span className={s.pickupStatus} data-status={pickup.status}>
      {cancelling ? "CANCELLING" : STATUS_TAG[pickup.status]}
    </span>
  );
  return (
    <div
      className={s.row}
      role="row"
      data-group="pickup"
      data-status={pickup.status}
      title={title}
      onMouseEnter={() => pending && onPreview?.(pickup.id)}
      onMouseLeave={() => pending && onPreview?.(null)}
    >
      <div className={s.slotCell} role="rowheader">
        <span className={s.slotChip} data-group="pickup">
          ADD
        </span>
      </div>
      {pickup.day == null ? (
        // Another week's day: one line across the days.
        <div className={s.pickupSpan} role="gridcell">
          <span className={s.pickupName}>+ {pickup.add.name}</span>
          <span className={dk.sub}>
            {forWhom} · {monthDay(pickup.date)}
            {first ? ` · ${first}` : ""}
          </span>
          {status}
          {cancel}
        </div>
      ) : (
        days.map((d, i) => {
          const focused = i === focusDay;
          const at = i === pickup.day;
          const after = i > pickup.day!;
          return (
            <Fragment key={d.date}>
              <div
                className={s.pickupCell}
                role="gridcell"
                data-at={at}
                data-after={after}
                data-today={d.index === todayIndex}
                data-status={at ? pickup.status : undefined}
              >
                {at ? (
                  <>
                    {focused ? <Headshot nbaId={pickup.add.nba_player_id ?? null} name={pickup.add.name} size={24} /> : null}
                    <span className={s.who}>
                      <span className={s.pickupName}>{focused ? `+ ${pickup.add.name}` : shortName(pickup.add.name)}</span>
                      {focused ? <span className={s.seatSub}>{forWhom}</span> : null}
                    </span>
                  </>
                ) : after && pickup.status !== "skipped" && pickup.status !== "failed" && pickup.status !== "expired" ? (
                  <span className={s.pickupGhost}>{focused ? pickup.add.name : shortName(pickup.add.name)}</span>
                ) : null}
              </div>
              <div
                className={focused ? s.pickupStat : s.pickupValue}
                role="gridcell"
                data-at={at}
                data-today={d.index === todayIndex}
              >
                {at ? (
                  focused ? (
                    <>
                      {status}
                      <span className={s.pickupNote}>{pickup.note ?? first ?? ""}</span>
                      {cancel}
                    </>
                  ) : (
                    cancel ?? status
                  )
                ) : null}
              </div>
            </Fragment>
          );
        })
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// One day's spot: who sits there, and his game
// ---------------------------------------------------------------------------

interface SeatPairProps {
  def: SlotRowDef;
  seat: Seat | null;
  day: number;
  focused: boolean;
  today: boolean;
  hot: boolean;
  cursor: boolean;
  heat: boolean;
  peak: number;
  locked: boolean;
  /** This day's lineup takes drags and drops. */
  dnd: boolean;
  drop: string | undefined;
  onHot: (day: number) => void;
  onCursor: (c: Cursor) => void;
  onSeat: (playerId: number, day: number, el: HTMLElement) => void;
}

const EMPTY_CELL: GridCell = { state: "none", value: null, opp: null, note: null, counts: false, tag: null };

const SeatPair = memo(function SeatPair({
  def,
  seat,
  day,
  focused,
  today,
  hot,
  cursor,
  heat,
  peak,
  locked,
  dnd,
  drop,
  onHot,
  onCursor,
  onSeat,
}: SeatPairProps) {
  const p = seat?.player ?? null;
  const canDrag = dnd && !!p && !locked && !seat?.incoming && !seat?.outgoing;
  const nameRef = useRef<HTMLDivElement | null>(null);
  const dragger = useDraggable({
    id: dndId(day, def.key),
    disabled: !canDrag,
    attributes: { role: "gridcell", tabIndex: -1, roleDescription: "draggable player" },
  });
  const dropName = useDroppable({ id: dndId(day, def.key), disabled: !dnd });
  const dropValue = useDroppable({ id: `${dndId(day, def.key)}#v`, disabled: !dnd });
  const { setNodeRef: setDragRef } = dragger;
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
  const cell = seat?.cell ?? EMPTY_CELL;
  const health = p ? healthOf(p.injury) : undefined;
  const statusTitle = p?.injury ? p.injury.replace(/_/g, " ").toLowerCase() : "active";
  const heatLevel = heat && cell.counts && cell.value != null ? Math.min(0.32, (cell.value / peak) * 0.32) : 0;

  return (
    <>
      <div
        ref={nameRefCb}
        {...dragger.attributes}
        {...(canDrag ? dragger.listeners : {})}
        className={s.seatName}
        data-day={day}
        data-focus={focused}
        data-today={today}
        data-hotcol={hot}
        data-cursor={cursor}
        data-staged={seat?.staged}
        data-incoming={seat?.incoming}
        data-shifted={seat?.shifted || undefined}
        data-outgoing={seat?.outgoing || undefined}
        data-draggable={canDrag}
        data-drop={drop}
        data-health={health}
        onMouseEnter={() => onHot(day)}
        onClick={() => {
          onCursor({ key: def.key, col: day });
          if (p && nameRef.current && !seat?.incoming && !seat?.outgoing) onSeat(p.id, day, nameRef.current);
        }}
        title={
          p
            ? seat?.shifted
              ? `${p.name} moves here to make room for the free agent`
              : seat?.outgoing
                ? `${p.name} is dropped for the free agent`
                : `${p.name} · ${p.team} · ${statusTitle}`
            : undefined
        }
      >
        {p ? (
          // Keyed by day and player, so a move slides him to his new spot in that day's column.
          <motion.span layoutId={`seat-${day}-${p.id}`} transition={SEAT_SPRING} className={s.seatWho}>
            {focused ? <Headshot nbaId={p.nbaId} name={p.name} size={24} /> : null}
            <span className={s.who}>
              <span className={s.seatNameText}>{focused ? p.name : shortName(p.name)}</span>
              {focused ? (
                <span className={s.seatSub}>
                  <span>{p.team}</span>
                  {cell.opp ? <span>{oppShort(cell.opp)}</span> : null}
                  {cell.state === "live" ? <span style={{ color: "var(--live)" }}>{cell.note}</span> : null}
                  {cell.state === "upcoming" && cell.note ? <span>{tip(cell.note)}</span> : null}
                  {seat?.incoming ? <span style={{ color: "var(--preview)" }}>FREE AGENT</span> : null}
                  {seat?.shifted ? <span style={{ color: "var(--preview)" }}>MOVES</span> : null}
                  {seat?.outgoing ? <span style={{ color: "var(--down)" }}>DROPPED</span> : null}
                </span>
              ) : null}
            </span>
            {locked ? <Lock size={11} className={s.lock} aria-label="Locked: his game has started" /> : null}
          </motion.span>
        ) : def.group === "active" ? (
          <span className={s.openSlot}>OPEN</span>
        ) : (
          <span className={dk.sub}>—</span>
        )}
      </div>
      {focused ? (
        <div
          ref={dropValue.setNodeRef}
          className={s.statCell}
          data-day={day}
          data-today={today}
          data-hotcol={hot}
          data-state={cell.state}
          data-counts={cell.counts}
          data-tag={cell.tag ?? undefined}
          data-drop={drop}
          data-incoming={seat?.incoming}
          onMouseEnter={() => onHot(day)}
          onClick={() => onCursor({ key: def.key, col: day })}
          title={cellTitle(cell)}
        >
          {heatLevel > 0 ? <span className={s.heat} style={{ opacity: heatLevel }} /> : null}
          <FocusStats cell={cell} hasPlayer={!!p} />
        </div>
      ) : (
        <div
          ref={dropValue.setNodeRef}
          className={`${s.cell} ${s.seatValue}`}
          role="gridcell"
          data-day={day}
          data-state={cell.state}
          data-counts={cell.counts}
          data-tag={cell.tag ?? undefined}
          data-today={today}
          data-hotcol={hot}
          data-drop={drop}
          onMouseEnter={() => onHot(day)}
          onClick={() => onCursor({ key: def.key, col: day })}
          title={cellTitle(cell)}
        >
          {heatLevel > 0 ? <span className={s.heat} style={{ opacity: heatLevel }} /> : null}
          <CompactValue cell={cell} />
        </div>
      )}
    </>
  );
});

/** What a cell's styling means, for the tooltip (the grid itself carries no status words). */
function cellTitle(cell: GridCell): string | undefined {
  if (cell.tag === "BENCH") return "On the bench: this game doesn't count";
  if (cell.tag === "SITS") return "No room in the best lineup that day";
  if (cell.tag === "IR") return "On IR";
  if (cell.tag === "DROP") return "Being replaced in the preview";
  if (cell.state === "out") return "Out for this game";
  if (cell.state === "dnp") return "Didn't play";
  return undefined;
}

/** A narrow day: points if the game has started, else the opponent and tip. */
function CompactValue({ cell }: { cell: GridCell }) {
  switch (cell.state) {
    case "none":
      return <span className={s.cellMain} style={{ textAlign: "center", opacity: 0.5 }}>·</span>;
    case "out":
    case "dnp":
      return <span className={s.cellMain} style={{ color: "var(--text-3)" }}>—</span>;
    case "upcoming":
      return (
        <span className={s.upcoming}>
          <span>{oppShort(cell.opp)}</span>
          <span className={dk.sub}>{tip(cell.note)}</span>
        </span>
      );
    case "live":
      return (
        <span className={s.cellMain} style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
          <span className={dk.liveDot} style={{ width: 5, height: 5 }} />
          {pts(cell.value)}
        </span>
      );
    default:
      return <span className={s.cellMain}>{pts(cell.value)}</span>;
  }
}

/** The focused day: the box score so far, or the matchup and projection ahead. */
function FocusStats({ cell, hasPlayer }: { cell: GridCell; hasPlayer: boolean }) {
  if (!hasPlayer) return null;
  if (cell.state === "none") return <span className={s.statNote}>no game</span>;
  if (cell.state === "out") return <span className={s.statNote}>out</span>;
  if (cell.state === "dnp") return <span className={s.statNote}>didn&apos;t play</span>;
  if (cell.state === "upcoming") {
    return (
      <span className={s.statRow} style={{ gridTemplateColumns: STAT_TRACKS }}>
        <span className={s.statAhead} style={{ gridColumn: `1 / ${STATS.length + 1}` }}>
          {cell.opp} · {tip(cell.note)} · projected
        </span>
        <span className={s.statFpts}>{pts(cell.value)}</span>
      </span>
    );
  }
  const line = cell.line;
  return (
    <span className={s.statRow} style={{ gridTemplateColumns: STAT_TRACKS }}>
      {STATS.map((x) => (
        <span key={x.key}>{line ? x.get(line) : "—"}</span>
      ))}
      <span className={s.statFpts}>{pts(cell.value)}</span>
    </span>
  );
}
