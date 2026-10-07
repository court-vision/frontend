"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Headshot } from "@/components/desk/Headshot";
import dk from "@/components/desk/desk.module.css";
import { buildMatchupDay, dayBars, weekBars, type DuelRow, type DuelSide, type MatchupDay, type StatBar } from "@/lib/matchup-day";
import { healthOf, type StatLine, type WeekGrid, type WeekSource } from "@/lib/week-grid";
import { monthDay, oppShort, pts, tip } from "./format";
import s from "./week.module.css";

/** The box score columns, read outward from the middle on the opponent's side. */
const STATS: Array<{ key: string; label: string; width: number; get: (l: StatLine) => string }> = [
  { key: "min", label: "MIN", width: 36, get: (l) => (l.min != null ? String(l.min) : "—") },
  { key: "pts", label: "P", width: 32, get: (l) => String(l.pts) },
  { key: "reb", label: "R", width: 32, get: (l) => String(l.reb) },
  { key: "ast", label: "A", width: 32, get: (l) => String(l.ast) },
  { key: "stl", label: "STL", width: 34, get: (l) => String(l.stl) },
  { key: "blk", label: "BLK", width: 34, get: (l) => String(l.blk) },
  { key: "fg", label: "FG", width: 46, get: (l) => `${l.fgm}/${l.fga}` },
  { key: "ft", label: "FT", width: 42, get: (l) => `${l.ftm}/${l.fta}` },
  { key: "3pm", label: "3PM", width: 36, get: (l) => String(l.fg3m) },
  { key: "tov", label: "TO", width: 32, get: (l) => String(l.tov) },
];
const NAME = "minmax(190px, 1fr)";
const FPTS = 60;
const SPINE = 54;
const statTracks = (cols: typeof STATS) => cols.map((c) => `minmax(${c.width}px, ${c.width / 34}fr)`).join(" ");
const MIRROR = [...STATS].reverse();
const TEMPLATE = [NAME, statTracks(STATS), `${FPTS}px`, `${SPINE}px`, `${FPTS}px`, statTracks(MIRROR), NAME].join(" ");
const MIN_WIDTH = 2 * (190 + STATS.reduce((a, c) => a + c.width, 0) + FPTS) + SPINE;

interface MatchupViewProps {
  grid: WeekGrid;
  source: WeekSource;
  day: number;
  todayIndex: number | null;
  onDay: (day: number) => void;
}

export function MatchupView({ grid, source, day, todayIndex, onDay }: MatchupViewProps) {
  const days = useMemo(() => source.days.map((d) => buildMatchupDay(source, grid, d.index)), [source, grid]);
  const md = days[day] ?? days[0];
  const [scope, setScope] = useState<"day" | "week">("day");
  const bars = useMemo(() => (scope === "day" ? dayBars(md, source) : weekBars(days, source, grid)), [scope, md, days, source, grid]);
  if (!md) return null;
  const d = source.days[md.day];
  // A spot neither side fills (an empty IR) is not worth a row.
  const filled = md.rows.filter((r) => r.you || r.opp);
  const active = filled.filter((r) => r.group === "active");
  const bench = filled.filter((r) => r.group === "bench");
  const ir = filled.filter((r) => r.group === "ir");
  const drop = filled.filter((r) => r.group === "drop");
  const label = d.kind === "today" ? "Today" : d.kind === "past" ? "Final" : "Ahead";

  return (
    <div className={s.mu}>
      <div className={s.muScore}>
        <ScoreSide name={source.you.name} side={md.you} kind={md.kind} />
        <div className={s.muDay}>
          <button type="button" className={dk.iconBtn} disabled={md.day === 0} onClick={() => onDay(md.day - 1)} aria-label="Previous day" title="Previous day ([)">
            <ChevronLeft size={15} />
          </button>
          <span className={s.muDayText}>
            <span className={s.muDayName}>
              {d.dow} {monthDay(d.date)}
            </span>
            <span className={dk.label} style={d.kind === "today" ? { color: "var(--accent)" } : undefined}>
              {d.index === todayIndex && d.kind === "today" ? "Live · today" : label}
            </span>
          </span>
          <button type="button" className={dk.iconBtn} disabled={md.day === source.days.length - 1} onClick={() => onDay(md.day + 1)} aria-label="Next day" title="Next day (])">
            <ChevronRight size={15} />
          </button>
        </div>
        <ScoreSide name={source.opp.name} side={md.opp} kind={md.kind} mirror />
      </div>

      <div className={s.muTable} style={{ minWidth: MIN_WIDTH }}>
        <div className={`${s.muRow} ${s.muHead}`} style={{ gridTemplateColumns: TEMPLATE }}>
          <span className={s.muHeadName}>{source.you.name}</span>
          {STATS.map((c) => (
            <span key={c.key} className={s.muHeadCell}>
              {c.label}
            </span>
          ))}
          <span className={s.muHeadCell}>FPTS</span>
          <span className={s.muHeadCell} />
          <span className={s.muHeadCell}>FPTS</span>
          {MIRROR.map((c) => (
            <span key={c.key} className={s.muHeadCell}>
              {c.label}
            </span>
          ))}
          <span className={s.muHeadName} style={{ textAlign: "right" }}>
            {source.opp.name}
          </span>
        </div>
        {active.map((r) => (
          <Duel key={r.key} row={r} past={md.kind === "past"} />
        ))}
        <TotalRow md={md} />
        {bench.length ? <GroupRow label="Bench" note="games here don't count" /> : null}
        {bench.map((r) => (
          <Duel key={r.key} row={r} past={md.kind === "past"} />
        ))}
        {ir.length ? <GroupRow label="IR" /> : null}
        {ir.map((r) => (
          <Duel key={r.key} row={r} past={md.kind === "past"} />
        ))}
        {drop.length ? <GroupRow label="Dropping" note="leaves the roster for the free agent: his games stop counting" tone="var(--down)" /> : null}
        {drop.map((r) => (
          <Duel key={r.key} row={r} past={md.kind === "past"} />
        ))}
      </div>

      {md.spotsAsToday.you || md.spotsAsToday.opp ? (
        <div className={s.muNote}>
          {md.kind === "past"
            ? "No lineup is recorded for past days: both sides sit in today's spots, so stat totals are approximate. Point totals are ESPN's."
            : "The opponent's spots are today's, carried forward as ESPN does unless they set this day themselves."}
        </div>
      ) : null}

      <section className={s.muBars} aria-label="Who's winning">
        <div className={s.muBarsHead}>
          <span className={dk.label}>Who&apos;s winning</span>
          <div className={dk.rail} role="radiogroup" aria-label="Scope">
            {(["day", "week"] as const).map((x) => {
              const on = scope === x;
              return (
                <button key={x} type="button" role="radio" aria-checked={on} className={`${dk.seg} ${on ? dk.segOn : ""}`} onClick={() => setScope(x)}>
                  {on ? <motion.span layoutId="scope-pill" className={dk.segPill} transition={{ type: "spring", stiffness: 600, damping: 45 }} /> : null}
                  <span className={dk.segLabel}>{x === "day" ? `${d.dow.toUpperCase()} ${monthDay(d.date)}` : `WEEK ${source.period}`}</span>
                </button>
              );
            })}
          </div>
          <span className={dk.spacer} />
          <span className={s.muLegend}>
            <span className={s.muSwatchYou} /> {source.you.name}
            <span className={s.muSwatchOpp} style={{ marginLeft: 14 }} /> {source.opp.name}
          </span>
        </div>
        {bars.length === 0 ? (
          <div className={dk.sub} style={{ padding: "6px 0 4px" }}>
            Nothing to compare yet.
          </div>
        ) : (
          bars.map((b) => <Bar key={b.key} bar={b} />)
        )}
        {scope === "week" && source.format !== "categories" ? (
          <div className={dk.sub} style={{ paddingTop: 8 }}>
            Stats sum the counted box scores of the days played so far{days.some((x) => x.kind === "past") ? " (past days in today's spots)" : ""}.
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ScoreSide({ name, side, kind, mirror = false }: { name: string; side: MatchupDay["you"]; kind: MatchupDay["kind"]; mirror?: boolean }) {
  const main = kind === "future" ? side.projected : side.actual;
  const parts = [
    kind === "today" && side.projected != null ? `proj ${pts(side.projected)}` : null,
    side.live ? `${side.live} live` : null,
    side.done && kind === "today" ? `${side.done} final` : null,
    side.toPlay ? `${side.toPlay} to play` : null,
  ].filter(Boolean);
  return (
    <div className={s.muSide} data-mirror={mirror}>
      <span className={dk.label}>{name}</span>
      <span className={s.muBig}>
        {pts(main)}
        {kind === "future" ? <span className={s.muBigSub}>proj</span> : null}
      </span>
      <span className={dk.sub}>{parts.join(" · ") || (kind === "past" ? "final" : " ")}</span>
    </div>
  );
}

function GroupRow({ label, note, tone }: { label: string; note?: string; tone?: string }) {
  return (
    <div className={s.muGroup}>
      <span className={dk.label} style={tone ? { color: tone } : undefined}>
        {label}
      </span>
      {note ? <span className={dk.sub}>{note}</span> : null}
    </div>
  );
}

function Duel({ row, past }: { row: DuelRow; past: boolean }) {
  return (
    <div className={s.muRow} style={{ gridTemplateColumns: TEMPLATE }} data-group={row.group}>
      <Side side={row.you} edge={row.edge === "you"} past={past} />
      <span className={s.muSpine}>
        <span className={s.slotChip} data-group={row.group} data-in={row.you?.incoming}>
          {row.slot}
        </span>
      </span>
      <Side side={row.opp} edge={row.edge === "opp"} past={past} mirror blank={row.group === "drop"} />
    </div>
  );
}

/** A side's cells, built left to right as your side reads; the opponent's are the same, reversed. */
function Side({
  side,
  edge,
  past,
  mirror = false,
  blank: quiet = false,
}: {
  side: DuelSide | null;
  edge: boolean;
  past: boolean;
  mirror?: boolean;
  /** No spot to fill on this side (the drop row's opponent side): leave it unlabelled. */
  blank?: boolean;
}) {
  if (!side) {
    const blank = [
      <span key="name" className={s.muName} data-mirror={mirror}>
        {quiet ? null : <span className={dk.sub}>empty</span>}
      </span>,
      <span key="stats" className={s.muSpan} style={{ gridColumn: `span ${STATS.length}` }} />,
      <span key="fpts" className={s.muFpts} />,
    ];
    return <>{mirror ? blank.reverse() : blank}</>;
  }
  const g = side.game;
  // Injury status is today's: on a day already played it would misdescribe the game.
  const health = past ? "ok" : healthOf(side.injury);
  const status = !g
    ? "none"
    : g.out
      ? "out"
      : g.status === "live"
        ? "live"
        : g.status === "final"
          ? g.fpts == null
            ? "dnp"
            : "final"
          : "upcoming";
  const gameNote = !g
    ? "no game"
    : g.status === "live"
      ? g.clock ?? "live"
      : g.status === "final"
        ? `final ${oppShort(g.opp)}`.trim()
        : `${oppShort(g.opp)}${g.time ? ` · ${tip(g.time)}` : ""}`;
  const name = (
    <span
      key="name"
      className={s.muName}
      data-mirror={mirror}
      data-health={health}
      data-staged={side.staged}
      data-incoming={side.incoming}
      data-shifted={side.shifted || undefined}
      data-outgoing={side.outgoing || undefined}
      title={side.shifted ? `${side.name} moves here to make room for the free agent` : side.outgoing ? `${side.name} is dropped for the free agent` : undefined}
    >
      <Headshot nbaId={side.nbaId} name={side.name} size={28} />
      <span className={s.muWho}>
        <span className={s.muPlayer}>{side.name}</span>
        <span className={s.muMeta}>
          {side.team || "—"}
          {" · "}
          <span data-status={status} className={s.muGameNote}>
            {gameNote}
          </span>
          {(g?.out && !past) || health === "out" ? <span className={`${s.inj}`}>OUT</span> : health === "dtd" ? <span className={`${s.inj} ${s.injSoft}`}>DTD</span> : null}
        </span>
      </span>
    </span>
  );
  const line = g?.line ?? null;
  const stats = line ? (
    STATS.map((c) => (
      <span key={c.key} className={s.muStat} data-counts={side.counts} data-incoming={side.incoming} data-outgoing={side.outgoing || undefined}>
        {c.get(line)}
      </span>
    ))
  ) : (
    <span key="span" className={s.muSpan} style={{ gridColumn: `span ${STATS.length}` }} data-counts={side.counts} data-incoming={side.incoming} data-outgoing={side.outgoing || undefined}>
      {status === "dnp" ? "did not play" : status === "out" ? "ruled out" : ""}
    </span>
  );
  const fpts = (
    <span key="fpts" className={s.muFpts} data-edge={edge} data-counts={side.counts} data-status={status} data-incoming={side.incoming} data-outgoing={side.outgoing || undefined}>
      {side.fpts == null ? "—" : side.projected ? <span className={s.muProj}>{pts(side.fpts)}</span> : pts(side.fpts)}
    </span>
  );
  const cells = [name, ...(Array.isArray(stats) ? stats : [stats]), fpts];
  return <>{mirror ? cells.reverse() : cells}</>;
}

function TotalRow({ md }: { md: MatchupDay }) {
  const future = md.kind === "future";
  const side = (x: MatchupDay["you"], mirror: boolean) => {
    const cells = [
      <span key="name" className={`${s.muName} ${s.muTotalName}`} data-mirror={mirror}>
        <span className={dk.label}>{future ? "Projected" : "Counted"}</span>
      </span>,
      ...(x.hasLine
        ? STATS.map((c) => (
            <span key={c.key} className={s.muStat} data-total>
              {c.get(x.line)}
            </span>
          ))
        : [<span key="span" className={s.muSpan} style={{ gridColumn: `span ${STATS.length}` }} />]),
      <span key="fpts" className={`${s.muFpts} ${s.muFptsTotal}`}>
        {pts(future ? x.projected : x.actual)}
      </span>,
    ];
    return mirror ? cells.reverse() : cells;
  };
  const lead = (future ? md.you.projected : md.you.actual) ?? 0;
  const trail = (future ? md.opp.projected : md.opp.actual) ?? 0;
  return (
    <div className={`${s.muRow} ${s.muTotal}`} style={{ gridTemplateColumns: TEMPLATE }}>
      {side(md.you, false)}
      <span className={s.muSpine}>
        <span className={`${dk.chip} ${lead > trail ? dk.up : lead < trail ? dk.down : dk.flat}`} style={{ padding: "0 4px" }}>
          {lead === trail ? "even" : lead > trail ? "+" + (lead - trail).toFixed(1) : (lead - trail).toFixed(1).replace("-", "−")}
        </span>
      </span>
      {side(md.opp, true)}
    </div>
  );
}

function fmt(b: StatBar, v: number): string {
  if (b.isRate) return v.toFixed(3).replace(/^0/, "");
  if (b.headline) return pts(v);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** One stat: your share from the left, theirs from the right; the longer side is winning. */
function Bar({ bar }: { bar: StatBar }) {
  const total = bar.you + bar.opp;
  // Lower is better (turnovers): the bar shows the share of the *other* side's count.
  const youShare = total <= 0 ? 0.5 : bar.lowerIsBetter ? bar.opp / total : bar.you / total;
  return (
    <div className={s.muBar} data-headline={bar.headline ?? false}>
      <span className={s.muBarLabel}>
        {bar.label}
        {bar.lowerIsBetter ? <span className={dk.sub}> ↓</span> : null}
        {bar.projected ? <span className={dk.sub}> proj</span> : null}
      </span>
      <span className={s.muBarValue} data-lead={bar.leader === "you"}>
        {fmt(bar, bar.you)}
      </span>
      <span className={s.muTrack}>
        <motion.span className={s.muFillYou} initial={false} animate={{ width: `${youShare * 100}%` }} transition={{ type: "spring", stiffness: 260, damping: 32 }} />
        <span className={s.muFillOpp} />
        <span className={s.muMid} />
      </span>
      <span className={s.muBarValue} data-lead={bar.leader === "opp"} data-side="opp">
        {fmt(bar, bar.opp)}
      </span>
      <span className={s.muBarEdge} data-leader={bar.leader ?? "even"}>
        {bar.leader === "you" ? "you" : bar.leader === "opp" ? "them" : "even"}
      </span>
    </div>
  );
}
