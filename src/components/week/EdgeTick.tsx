"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { marginText, type CategoryColumn, type Race, type RacePoint } from "@/lib/matchup-race";
import type { MatchupCategory, WeekDay } from "@/lib/week-grid";
import { TickBox, useReducedMotion, useTickHover, type TickOpen } from "./TickBox";
import dk from "@/components/desk/desk.module.css";
import s from "./week.module.css";

export interface EdgeTickProps {
  /** The race: points, or categories won against lost. */
  race: Race;
  format: "points" | "categories";
  /** Category leagues: the categories and each day's standing in them. */
  categories: MatchupCategory[];
  columns: CategoryColumn[];
  days: WeekDay[];
  youName: string;
  oppName: string;
  /** Whether the projection is the lineups as set or the best ones (points). */
  lineupNote: string;
  open: TickOpen;
  onOpen: (open: TickOpen) => void;
  container: HTMLElement | null;
}

const SPARK_W = 168;
const SPARK_H = 30;

/**
 * The tape's Edge: the margin traced across the week, finished days solid,
 * the projection dashed, ending on where it's headed. Hovering (or E, or a
 * click) grows it into the whole race: the chart with every lead change, and
 * the week's line score.
 */
export function EdgeTick(props: EdgeTickProps) {
  const { race, format, open, onOpen, days } = props;
  const reduced = useReducedMotion();
  const [tick, setTick] = useState<HTMLDivElement | null>(null);
  const hover = useTickHover(open, onOpen);
  const cats = format === "categories";
  const end = race.end;
  const endTone = end.margin > 0.05 ? dk.up : end.margin < -0.05 ? dk.down : dk.flat;
  return (
    <>
      <div ref={setTick} className={`${s.tick} ${s.edgeTick}`} data-open={open ? true : undefined} {...hover.tick}>
        <span className={s.todayHead}>
          <span className={dk.label}>Edge</span>
          <span className={s.edgeEnd}>
            <span className={`${dk.chip} ${endTone}`}>{cats ? `${end.you}-${end.opp}` : marginText(end.margin)}</span>
            <span className={s.edgeEndNote}>{cats ? (end.kind === "start" ? "no days yet" : "now") : end.kind === "projected" ? "proj" : "final"}</span>
          </span>
          <button
            type="button"
            className={s.todayExpand}
            onClick={() => onOpen(open && open !== "hover" ? null : "keyboard")}
            aria-expanded={!!open}
            aria-label="The week's race"
            title="The week's race (E)"
          >
            <ChevronDown size={12} />
            <span className={dk.kbd}>E</span>
          </button>
        </span>
        <Sparkline race={race} days={days.length} floor={cats ? 2 : 10} />
      </div>
      {open ? <RaceBox {...props} anchor={tick} reduced={reduced} hover={hover.box} /> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Drawing the margin
// ---------------------------------------------------------------------------

interface Scale {
  x: (x: number) => number;
  y: (m: number) => number;
  top: number;
}

function scaleFor(points: readonly RacePoint[], days: number, w: number, h: number, pad: { l: number; r: number; t: number; b: number }, floor: number): Scale {
  const top = Math.max(floor, ...points.map((p) => Math.abs(p.margin))) * 1.1;
  return {
    x: (x) => pad.l + (x / Math.max(1, days)) * (w - pad.l - pad.r),
    y: (m) => pad.t + ((top - m) / (2 * top)) * (h - pad.t - pad.b),
    top,
  };
}

const path = (pts: readonly RacePoint[], sc: Scale) => pts.map((p, i) => `${i ? "L" : "M"}${sc.x(p.x).toFixed(1)},${sc.y(p.margin).toFixed(1)}`).join(" ");

/** Where what has happened stops: the live point, or the last final. */
function splitAt(points: readonly RacePoint[]): number {
  let k = 0;
  points.forEach((p, i) => {
    if (p.kind !== "projected") k = i;
  });
  return k;
}

/** The margin as an area either side of zero (green while you lead, red while they do), the line on top. */
function MarginArea({ race, sc, w, h, idBase, strokeWidth = 1.5 }: { race: Race; sc: Scale; w: number; h: number; idBase: string; strokeWidth?: number }) {
  const pts = race.points;
  if (pts.length < 2) return null;
  const k = splitAt(pts);
  const done = pts.slice(0, k + 1);
  const ahead = pts.slice(k);
  const zero = sc.y(0);
  const area = `${path(pts, sc)} L${sc.x(pts[pts.length - 1].x).toFixed(1)},${zero.toFixed(1)} L${sc.x(pts[0].x).toFixed(1)},${zero.toFixed(1)} Z`;
  const now = pts[k];
  return (
    <>
      <defs>
        <clipPath id={`${idBase}-up`}>
          <rect x={0} y={0} width={w} height={zero} />
        </clipPath>
        <clipPath id={`${idBase}-down`}>
          <rect x={0} y={zero} width={w} height={Math.max(0, h - zero)} />
        </clipPath>
      </defs>
      <path d={area} fill="var(--up)" opacity={0.16} clipPath={`url(#${idBase}-up)`} />
      <path d={area} fill="var(--down)" opacity={0.16} clipPath={`url(#${idBase}-down)`} />
      <line x1={sc.x(0)} x2={sc.x(pts[pts.length - 1].x)} y1={zero} y2={zero} stroke="var(--line-2)" strokeDasharray="2 3" />
      {ahead.length > 1 ? <path d={path(ahead, sc)} fill="none" stroke="var(--text-3)" strokeWidth={strokeWidth} strokeDasharray="3 3" /> : null}
      {done.length > 1 ? <path d={path(done, sc)} fill="none" stroke="var(--text)" strokeWidth={strokeWidth} strokeLinejoin="round" /> : null}
      {now && now.kind !== "start" ? <circle cx={sc.x(now.x)} cy={sc.y(now.margin)} r={strokeWidth + 1.2} fill={now.kind === "now" ? "var(--accent)" : "var(--text)"} /> : null}
    </>
  );
}

function Sparkline({ race, days, floor }: { race: Race; days: number; floor: number }) {
  const id = useId().replace(/:/g, "");
  const sc = scaleFor(race.points, days, SPARK_W, SPARK_H, { l: 1, r: 3, t: 3, b: 3 }, floor);
  return (
    <svg className={s.spark} width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} aria-hidden>
      {Array.from({ length: days - 1 }, (_, i) => (
        <line key={i} x1={sc.x(i + 1)} x2={sc.x(i + 1)} y1={SPARK_H - 3} y2={SPARK_H} stroke="var(--line-2)" />
      ))}
      <MarginArea race={race} sc={sc} w={SPARK_W} h={SPARK_H} idBase={`sp${id}`} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// The box: the whole race
// ---------------------------------------------------------------------------

const CHART_W = 520;
const CHART_H = 170;
const PAD = { l: 44, r: 12, t: 16, b: 22 };

interface BoxProps extends EdgeTickProps {
  anchor: HTMLElement | null;
  reduced: boolean;
  hover: { onEnter: () => void; onLeave: () => void };
}

function fmt(n: number, cats: boolean) {
  return cats ? String(n) : n.toFixed(1);
}

function RaceBox({ race, format, categories, columns, days, youName, oppName, lineupNote, open, onOpen, container, anchor, reduced, hover }: BoxProps) {
  const cats = format === "categories";
  const id = useId().replace(/:/g, "");
  const sc = scaleFor(race.points, days.length, CHART_W, CHART_H, PAD, cats ? 2 : 10);
  const k = splitAt(race.points);
  const [at, setAt] = useState<number | null>(null);
  const shown = race.points[at ?? k] ?? race.end;
  const changes = race.changes;
  const summary = useMemo(() => {
    const done = changes.filter((c) => !c.projected).length;
    const ahead = changes.filter((c) => c.projected).length;
    const parts = [`${done} lead change${done === 1 ? "" : "s"} so far`];
    if (ahead) parts.push(`${ahead} more projected`);
    if (race.best.you) parts.push(`your widest lead ${marginText(race.best.you.margin, cats ? 0 : 1)}`);
    if (race.best.opp) parts.push(`theirs ${marginText(-race.best.opp.margin, cats ? 0 : 1)}`);
    return parts.join(" · ");
  }, [changes, race.best, cats]);

  const label = (p: RacePoint) => {
    if (p.kind === "start") return "Before the first game";
    if (p.kind === "now") return "Now";
    const d = days[Math.ceil(p.x) - 1];
    return `${p.kind === "projected" ? "Projected, end of" : "End of"} ${d?.dow ?? ""}`;
  };

  return (
    <TickBox
      anchor={anchor}
      container={container}
      open={open}
      onOpen={onOpen}
      hover={hover}
      reduced={reduced}
      label="The week's race"
      keyHint="E"
      width={580}
      sub={`${youName} vs ${oppName}`}
      foot={
        <span className={s.note} title={cats ? "Each finished day is ESPN's nightly snapshot of the categories; a day without one is left out. Today is live." : `Finished days are ESPN's nightly totals where a snapshot exists (${race.fromEspn} so far), else the week's own day totals. Today is live; the rest is projected.`}>
          {cats ? "Finished days: ESPN's nightly category totals · today: live" : `Finished days: ESPN's nightly totals · today: live · ahead: ${lineupNote}`}
        </span>
      }
    >
      <div className={s.raceRead} aria-live="polite">
        <span className={dk.label}>{label(shown)}</span>
        <span className={s.raceScore}>
          <span>{fmt(shown.you, cats)}</span>
          <span className={s.vs}>{cats ? "won · lost" : "vs"}</span>
          <span className={s.tickSub}>{fmt(shown.opp, cats)}</span>
          <span className={`${dk.chip} ${shown.margin > 0.05 ? dk.up : shown.margin < -0.05 ? dk.down : dk.flat}`}>{marginText(shown.margin, cats ? 0 : 1)}</span>
        </span>
        <span className={s.raceSummary}>{summary}</span>
      </div>
      <svg
        className={s.raceChart}
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        role="img"
        aria-label={`The margin across the week: ${summary}`}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * CHART_W;
          let best = 0;
          race.points.forEach((p, i) => {
            if (Math.abs(sc.x(p.x) - x) < Math.abs(sc.x(race.points[best].x) - x)) best = i;
          });
          setAt(best);
        }}
        onPointerLeave={() => setAt(null)}
      >
        {days.map((d, i) => (
          <g key={d.date}>
            <rect x={sc.x(i)} y={PAD.t} width={sc.x(i + 1) - sc.x(i)} height={CHART_H - PAD.t - PAD.b} fill={d.kind === "today" ? "var(--hover)" : "transparent"} />
            <line x1={sc.x(i + 1)} x2={sc.x(i + 1)} y1={PAD.t} y2={CHART_H - PAD.b} stroke="var(--line)" />
            <text x={(sc.x(i) + sc.x(i + 1)) / 2} y={CHART_H - 6} textAnchor="middle" className={s.raceAxis} data-today={d.kind === "today" || undefined}>
              {d.dow.toUpperCase()}
            </text>
          </g>
        ))}
        <text x={PAD.l - 6} y={sc.y(sc.top / 1.1) + 4} textAnchor="end" className={s.raceAxis}>
          {marginText(sc.top / 1.1, 0)}
        </text>
        <text x={PAD.l - 6} y={sc.y(0) + 4} textAnchor="end" className={s.raceAxis}>
          0
        </text>
        <text x={PAD.l - 6} y={sc.y(-sc.top / 1.1) + 4} textAnchor="end" className={s.raceAxis}>
          {marginText(-sc.top / 1.1, 0)}
        </text>
        <MarginArea race={race} sc={sc} w={CHART_W} h={CHART_H} idBase={`rc${id}`} strokeWidth={2} />
        {changes.map((c, i) => (
          <g key={i}>
            <circle cx={sc.x(c.x)} cy={sc.y(0)} r={3.5} fill="var(--raised)" stroke={c.to === "you" ? "var(--up)" : "var(--down)"} strokeWidth={1.5} strokeDasharray={c.projected ? "2 1.5" : undefined} />
          </g>
        ))}
        {at != null ? <circle cx={sc.x(shown.x)} cy={sc.y(shown.margin)} r={4} fill="none" stroke="var(--accent)" strokeWidth={1.5} /> : null}
      </svg>
      {cats ? <CategoryTable categories={categories} columns={columns} days={days} /> : <LineScore race={race} />}
    </TickBox>
  );
}

/** The week's line score: each day's points for both sides, and the running lead at its end. */
function LineScore({ race }: { race: Race }) {
  const total = race.end;
  return (
    <div className={s.raceTable} role="table" aria-label="The week's line score" style={{ gridTemplateColumns: `52px repeat(${race.days.length}, minmax(0, 1fr)) 64px` }}>
      <span role="columnheader" />
      {race.days.map((d) => (
        <span key={d.date} role="columnheader" className={s.raceHead} data-today={d.kind === "today" || undefined}>
          {d.dow.toUpperCase()}
        </span>
      ))}
      <span role="columnheader" className={s.raceHead}>
        WEEK
      </span>
      {(["you", "opp"] as const).map((side) => (
        <div key={side} role="row" className={s.raceRow}>
          <span role="rowheader" className={dk.label}>
            {side === "you" ? "You" : "Opp"}
          </span>
          {race.days.map((d) => (
            <span key={d.date} role="cell" className={s.raceCell} data-projected={d.projected || undefined}>
              {d[side].toFixed(1)}
            </span>
          ))}
          <span role="cell" className={`${s.raceCell} ${s.raceTotal}`} data-projected={total.kind === "projected" || undefined}>
            {total[side].toFixed(1)}
          </span>
        </div>
      ))}
      <div role="row" className={s.raceRow}>
        <span role="rowheader" className={dk.label}>
          Lead
        </span>
        {race.days.map((d) => (
          <span key={d.date} role="cell" className={`${s.raceCell} ${d.margin > 0.05 ? s.raceUp : d.margin < -0.05 ? s.raceDown : ""}`} data-projected={d.projected || undefined}>
            {marginText(d.margin)}
          </span>
        ))}
        <span role="cell" className={`${s.raceCell} ${s.raceTotal} ${total.margin > 0.05 ? s.raceUp : total.margin < -0.05 ? s.raceDown : ""}`} data-projected={total.kind === "projected" || undefined}>
          {marginText(total.margin)}
        </span>
      </div>
    </div>
  );
}

/** Who led each category at the end of each day (and now), and the day's standing. */
function CategoryTable({ categories, columns, days }: { categories: MatchupCategory[]; columns: CategoryColumn[]; days: WeekDay[] }) {
  if (!columns.length) return <div className={s.todayEmpty}>No day has finished yet: the first standing lands the morning after opening night&apos;s games.</div>;
  const fmtVal = (c: MatchupCategory, v: number | null) => (v == null ? "—" : c.isRate ? v.toFixed(3).replace(/^0/, "") : String(Math.round(v * 10) / 10));
  return (
    <div className={s.raceTable} role="table" aria-label="Categories by day" style={{ gridTemplateColumns: `52px repeat(${columns.length}, minmax(0, 1fr))` }}>
      <span role="columnheader" />
      {columns.map((c) => (
        <span key={c.x} role="columnheader" className={s.raceHead} data-today={c.kind === "now" || undefined}>
          {c.kind === "now" ? "NOW" : (days[c.day]?.dow ?? "").toUpperCase()}
        </span>
      ))}
      {categories.map((cat) => (
        <div key={cat.key} role="row" className={s.raceRow}>
          <span role="rowheader" className={dk.label}>
            {cat.label}
          </span>
          {columns.map((c) => {
            const cell = c.cells[cat.key];
            return (
              <span
                key={c.x}
                role="cell"
                className={`${s.raceCell} ${cell?.leader === "you" ? s.raceUp : cell?.leader === "opp" ? s.raceDown : ""}`}
                title={cell ? `${fmtVal(cat, cell.you)} vs ${fmtVal(cat, cell.opp)}` : undefined}
              >
                {cell?.leader === "you" ? "▲" : cell?.leader === "opp" ? "▼" : cell?.leader === "tie" ? "=" : "·"}
              </span>
            );
          })}
        </div>
      ))}
      <div role="row" className={s.raceRow}>
        <span role="rowheader" className={dk.label}>
          W-L-T
        </span>
        {columns.map((c) => (
          <span key={c.x} role="cell" className={`${s.raceCell} ${s.raceTotal}`}>
            {c.won}-{c.lost}-{c.tied}
          </span>
        ))}
      </div>
    </div>
  );
}
