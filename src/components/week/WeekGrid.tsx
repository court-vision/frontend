"use client";

import { memo, useEffect, useRef, useState } from "react";
import { LayoutGroup, motion } from "motion/react";
import { ArrowLeftRight, Lock, Repeat2 } from "lucide-react";
import { isActiveSlot, slotName } from "@/lib/lineup-editor";
import { isOutStatus, type GridCell, type GridRow, type WeekGrid as Grid } from "@/lib/week-grid";
import type { LineupPlayer } from "@/types/lineup-editor";
import { monthDay, oppShort, pts, signed, tip } from "./format";
import s from "./week.module.css";

export interface Cursor {
  key: string;
  /** 0 = roster column, 1…n = days, n + 1 = week total. */
  col: number;
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
}

const ROW_SPRING = { type: "spring", stiffness: 520, damping: 44, mass: 0.7 } as const;

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
}: WeekGridProps) {
  const [hotCol, setHotCol] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const n = grid.days.length;
  const cols = `minmax(248px, 280px) repeat(${n}, minmax(88px, 1fr)) minmax(92px, 104px)`;
  const peak = Math.max(1, ...grid.rows.flatMap((r) => r.cells.map((c) => (c.counts ? c.value ?? 0 : 0))));

  // Keep the cursor cell on screen as it moves.
  useEffect(() => {
    if (!cursor) return;
    const el = wrapRef.current?.querySelector<HTMLElement>(
      `[data-rowkey="${cursor.key}"] [data-col="${cursor.col}"]`
    );
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [cursor]);

  return (
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
            <span className={s.label}>Lineup · {grid.days[grid.viewDay] ? `${grid.days[grid.viewDay].dow} ${monthDay(grid.days[grid.viewDay].date)}` : ""}</span>
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
          {grid.rows.map((row) => (
            <motion.div
              key={row.key}
              layout="position"
              transition={ROW_SPRING}
              className={s.row}
              role="row"
              data-rowkey={row.key}
              data-kind={row.kind}
            >
              <RosterCell
                row={row}
                board={row.player ? boardById.get(row.player.id) : undefined}
                isToday={grid.viewDay === todayIndex}
                cursor={cursor?.key === row.key && cursor.col === 0}
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
                  cursor={cursor?.key === row.key && cursor.col === i + 1}
                  heat={heat && cell.counts && cell.value != null ? Math.min(0.32, (cell.value / peak) * 0.32) : 0}
                  onEnter={setHotCol}
                  onClick={() => onCursor({ key: row.key, col: i + 1 })}
                />
              ))}
              <div
                className={s.weekCell}
                role="gridcell"
                data-col={n + 1}
                data-cursor={cursor?.key === row.key && cursor.col === n + 1}
                onMouseEnter={() => setHotCol(n + 1)}
                onClick={() => onCursor({ key: row.key, col: n + 1 })}
                style={row.outgoing ? { color: "var(--text-3)", textDecoration: "line-through" } : row.kind === "incoming" ? { color: "var(--preview)" } : undefined}
              >
                {row.player ? pts(row.total) : ""}
              </div>
            </motion.div>
          ))}
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
  board: LineupPlayer | undefined;
  isToday: boolean;
  cursor: boolean;
  onFocus: () => void;
  onMove: (el: HTMLElement) => void;
  onReplace: (el: HTMLElement) => void;
}

const RosterCell = memo(function RosterCell({ row, board, isToday, cursor, onFocus, onMove, onReplace }: RosterCellProps) {
  const p = row.player;
  const cellRef = useRef<HTMLDivElement>(null);
  const slotClass =
    row.kind === "incoming"
      ? s.slotIn
      : row.staged
        ? s.slotStaged
        : row.slotId != null && isActiveSlot(row.slotId)
          ? s.slotActive
          : "";

  if (!p) {
    return (
      <div ref={cellRef} className={s.rosterCell} role="rowheader" data-col={0} data-cursor={cursor} onClick={onFocus}>
        <span className={`${s.slot} ${s.slotActive}`}>{row.slot}</span>
        <span className={s.openSlot}>OPEN</span>
        <span className={s.sub}>nobody eligible plays · room to stream</span>
      </div>
    );
  }

  const positions = (board ? board.eligible_slot_ids.filter(isActiveSlot) : p.eligible)
    .filter((id) => id <= 4)
    .map(slotName)
    .join("/");
  const injury = p.injury;
  const locked = isToday && !!board?.locked;

  return (
    <div
      ref={cellRef}
      className={s.rosterCell}
      role="rowheader"
      data-col={0}
      data-cursor={cursor}
      onClick={(e) => {
        onFocus();
        if ((e.target as HTMLElement).closest("button")) return;
        if (cellRef.current && row.kind !== "incoming") onMove(cellRef.current);
      }}
    >
      <span className={`${s.slot} ${slotClass}`}>{row.slot}</span>
      <span className={s.who}>
        <span className={`${s.name} ${row.outgoing ? s.nameOut : ""}`}>{p.name}</span>
        <span className={s.meta}>
          <span>{p.team}</span>
          {positions ? <span>{positions}</span> : null}
          {injury ? (
            <span className={`${s.inj} ${isOutStatus(injury) ? "" : s.injSoft}`}>{injury.replace("_", " ")}</span>
          ) : null}
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
            className={s.iconBtn}
            style={{ width: 26, height: 26 }}
            aria-label={`Move ${p.name}`}
            title="Move (M)"
            onClick={() => cellRef.current && onMove(cellRef.current)}
          >
            <ArrowLeftRight size={13} />
          </button>
          <button
            type="button"
            className={s.iconBtn}
            style={{ width: 26, height: 26 }}
            aria-label={`Replace ${p.name} with a free agent`}
            title="Replace (R)"
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
}

const TAG_CLASS: Record<string, string> = {
  BENCH: s.tagBench,
  SITS: s.tagSits,
  IR: s.tagIr,
  DROP: s.tagDrop,
};

const DayCell = memo(function DayCell({ cell, col, incoming, today, hot, cursor, heat, onEnter, onClick }: DayCellProps) {
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
      main = "OUT";
      break;
    case "dnp":
      main = "DNP";
      break;
    default:
      main = pts(cell.value);
  }

  let right: React.ReactNode = null;
  if (cell.tag) right = <span className={TAG_CLASS[cell.tag]}>{cell.tag}</span>;
  else if (cell.state === "live")
    right = (
      <span className={s.clock}>
        <span className={s.liveDot} style={{ width: 5, height: 5 }} />
        {cell.note}
      </span>
    );
  else if (cell.state === "upcoming") right = <span>{tip(cell.note)}</span>;
  else if (cell.state === "final" && today) right = <span>F</span>;

  return (
    <div
      className={`${s.cell} ${incoming ? s.incomingCell : ""}`}
      role="gridcell"
      data-col={col}
      data-state={cell.state}
      data-counts={cell.counts}
      data-tag={cell.tag ?? undefined}
      data-today={today}
      data-hotcol={hot}
      data-cursor={cursor}
      onMouseEnter={() => onEnter(col)}
      onClick={onClick}
    >
      {heat > 0 ? <span className={s.heat} style={{ opacity: heat }} /> : null}
      {cell.state !== "none" ? (
        <span className={s.cellTop} style={{ position: "relative" }}>
          <span>{oppShort(cell.opp)}</span>
          {right}
        </span>
      ) : null}
      <span key={flash} className={`${s.cellMain} ${flash ? s.flash : ""}`} style={{ position: "relative" }}>
        {main}
      </span>
    </div>
  );
});
