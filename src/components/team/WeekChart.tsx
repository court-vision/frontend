"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { chartRange, clearsLine, matchupSpan, ordinal, pct, pts, shortDay, signedPts, dayRange, type WeekBar } from "@/lib/team-desk";
import s from "./team.module.css";

const LEFT = 62;
const RIGHT = 14;
const TOP = 34;
const PLOT = 138;
const H = TOP + PLOT + 44;
/** A column narrower than this and the chart scrolls sideways instead. */
const MIN_COL = 32;

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(1200);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth || 1200);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

type Phase = "scored" | "projected" | "playoffs";

function phaseOf(b: WeekBar): Phase {
  if (b.status === "final") return "scored";
  return b.playoffs ? "playoffs" : "projected";
}

const PHASE_LABEL: Record<Phase, string> = { scored: "Scored", projected: "Projected", playoffs: "Playoffs" };

function columnTitle(b: WeekBar): string {
  const head = `Matchup ${b.matchup}${b.start ? ` · ${dayRange(b.start, b.end)}` : ""}${b.playoffs ? " · playoffs" : ""}`;
  const you = b.status === "final" ? "you scored" : b.status === "current" ? "you, scored so far plus projected" : "you, projected";
  const lines = [
    head,
    `${you} ${pts(b.you)}${b.rank ? ` (${ordinal(b.rank)} of ${b.teams})` : ""}`,
    `league median ${pts(b.median)} · playoff line ${pts(b.line)} · best ${pts(b.best)}`,
  ];
  if (b.opponent) {
    const opp = `against ${b.opponent}${b.opponentScore != null ? ` (${pts(b.opponentScore)})` : ""}`;
    lines.push(b.result ? `${opp}: ${b.result === "W" ? "won" : b.result === "L" ? "lost" : "tied"}` : b.winChance != null ? `${opp}: ${pct(b.winChance)} to win` : opp);
  }
  if (b.incomplete) lines.push("The calendar is missing games this matchup, so every roster is undercounted alike.");
  return lines.join("\n");
}

/**
 * Your score against the league's, matchup by matchup: each bar is you minus the league's median
 * roster, the band the league's middle half, the dashed mark the playoff line, the tick the best.
 * A dot marks a matchup where you clear the line.
 */
export function WeekChart({ bars, window: win }: { bars: WeekBar[]; window: { first: number; last: number } | null }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const n = bars.length;
  const W = Math.max(width, LEFT + RIGHT + n * MIN_COL);
  const cw = n ? (W - LEFT - RIGHT) / n : 0;
  const { lo, hi, step } = chartRange(bars);
  const y = (v: number) => TOP + ((hi - Math.max(lo, Math.min(hi, v))) / (hi - lo)) * PLOT;
  const x = (i: number) => LEFT + i * cw;
  const bw = Math.max(8, Math.min(18, cw * 0.48));

  // The phases along the top, each a run of matchups
  const runs: Array<{ phase: Phase; from: number; to: number }> = [];
  bars.forEach((b, i) => {
    const phase = phaseOf(b);
    const last = runs[runs.length - 1];
    if (last && last.phase === phase) last.to = i;
    else runs.push({ phase, from: i, to: i });
  });

  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  // Where the chart scrolls, it opens with the current matchup in view
  const nowIndex = bars.findIndex((b) => b.status === "current");
  const scrolled = useRef(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || scrolled.current || nowIndex < 0 || el.scrollWidth <= el.clientWidth) return;
    scrolled.current = true;
    el.scrollLeft = Math.max(0, LEFT + nowIndex * cw - el.clientWidth / 3);
  }, [ref, nowIndex, cw]);
  const winFrom = win ? bars.findIndex((b) => b.matchup === win.first) : -1;
  const winTo = win ? bars.findIndex((b) => b.matchup === win.last) : -1;

  return (
    <div ref={ref} className={s.chartScroll}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={s.chart} role="img" aria-label="Your score against the league's median roster, matchup by matchup">
        <defs>
          <pattern id="team-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="7" className={s.hatchLine} strokeWidth="3" />
          </pattern>
        </defs>

        {/* the phases: scored, projected, the playoffs */}
        {runs.map((r) => {
          const a = x(r.from) + 3;
          const b = x(r.to + 1) - 3;
          const first = bars[r.from].matchup;
          const last = bars[r.to].matchup;
          return (
            <g key={`${r.phase}-${first}`}>
              {r.phase === "playoffs" ? <rect x={x(r.from)} y={TOP - 12} width={b - a + 6} height={PLOT + 12} className={s.playoffShade} /> : null}
              <line x1={a} x2={b} y1={TOP - 12} y2={TOP - 12} className={s[`phase_${r.phase}`]} strokeWidth="2" strokeDasharray={r.phase === "projected" ? "4 3" : undefined} />
              {b - a > 70 ? (
                <text x={(a + b) / 2} y={TOP - 18} textAnchor="middle" className={`${s.phaseText} ${r.phase === "playoffs" ? s.phaseTextPlayoffs : ""}`}>
                  {PHASE_LABEL[r.phase].toUpperCase()} · {matchupSpan(first, last)}
                </text>
              ) : null}
            </g>
          );
        })}

        {/* now */}
        {bars.map((b, i) => (b.status === "current" ? <rect key="now" x={x(i) + 1} y={TOP - 10} width={cw - 2} height={PLOT + 10} className={s.nowCol} /> : null))}

        {/* undercounted matchups */}
        {bars.map((b, i) =>
          b.incomplete ? (
            <g key={`tbd-${b.matchup}`}>
              <rect x={x(i) + 2} y={TOP} width={cw - 4} height={PLOT} fill="url(#team-hatch)" className={s.hatch} rx="2" />
            </g>
          ) : null
        )}

        {/* the grid */}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={LEFT} x2={W - RIGHT} y1={y(v)} y2={y(v)} className={v === 0 ? s.gridZero : s.gridLine} />
            <text x={LEFT - 8} y={y(v) + 3.5} textAnchor="end" className={v === 0 ? s.axisZero : s.axis}>
              {v === 0 ? "MEDIAN" : signedPts(v).replace(".0", "")}
            </text>
          </g>
        ))}

        {/* the league: middle half, playoff line, best */}
        {bars.map((b, i) => {
          if (b.median == null) return null;
          const a = x(i) + 4;
          const w = cw - 8;
          const c = x(i) + cw / 2;
          const out: React.ReactNode[] = [];
          if (b.low != null && b.high != null) out.push(<rect key="band" x={a} y={y(b.high - b.median)} width={w} height={Math.max(1, y(b.low - b.median) - y(b.high - b.median))} className={s.band} />);
          if (b.line != null) out.push(<line key="line" x1={a} x2={a + w} y1={y(b.line - b.median)} y2={y(b.line - b.median)} className={s.lineMark} strokeDasharray="3 2" />);
          if (b.best != null) {
            const d = b.best - b.median;
            out.push(
              d > hi ? (
                <path key="best" d={`M${c - 4},${TOP + 5} L${c + 4},${TOP + 5} L${c},${TOP - 1} Z`} className={s.bestMark} />
              ) : (
                <line key="best" x1={c - 6} x2={c + 6} y1={y(d)} y2={y(d)} className={s.bestTick} />
              )
            );
          }
          return <g key={`l-${b.matchup}`}>{out}</g>;
        })}

        {/* you */}
        {bars.map((b, i) => {
          if (b.you == null || b.median == null) return null;
          const d = b.you - b.median;
          const c = x(i) + cw / 2;
          const y0 = y(0);
          const yv = y(d);
          const cls = [s.bar, d >= 0 ? s.barUp : s.barDown, b.status === "final" ? "" : b.incomplete ? s.barTbd : s.barAhead].join(" ");
          return (
            <g key={`y-${b.matchup}`}>
              <rect x={c - bw / 2} y={Math.min(y0, yv)} width={bw} height={Math.max(1.5, Math.abs(yv - y0))} className={cls} rx="1" />
              {clearsLine(b) ? <circle cx={c} cy={d >= 0 ? Math.max(TOP + 3, yv - 7) : Math.min(TOP + PLOT - 3, yv + 7)} r="2.7" className={s.clearDot} /> : null}
            </g>
          );
        })}

        {/* the matchups along the bottom */}
        {bars.map((b, i) => {
          const c = x(i) + cw / 2;
          const second =
            b.status === "final" && b.result
              ? { text: b.result, cls: b.result === "W" ? s.labelWin : b.result === "L" ? s.labelLoss : s.label2 }
              : b.status === "current"
                ? { text: b.winChance != null ? pct(b.winChance) : "now", cls: s.labelNow }
                : { text: b.incomplete ? "TBD" : shortDay(b.start), cls: s.label2 };
          return (
            <g key={`x-${b.matchup}`}>
              <text x={c} y={TOP + PLOT + 16} textAnchor="middle" className={b.status === "current" ? s.labelNowNum : s.label1}>
                {b.matchup}
              </text>
              <text x={c} y={TOP + PLOT + 30} textAnchor="middle" className={second.cls}>
                {second.text}
              </text>
            </g>
          );
        })}

        {/* the desk's window */}
        {winFrom >= 0 && winTo >= winFrom ? (
          <line x1={x(winFrom) + 4} x2={x(winTo + 1) - 4} y1={TOP + PLOT + 38} y2={TOP + PLOT + 38} className={s.windowMark} strokeWidth="3" strokeLinecap="round" />
        ) : null}

        {/* each matchup's numbers, on hover */}
        {bars.map((b, i) => (
          <rect key={`h-${b.matchup}`} x={x(i)} y={TOP - 12} width={cw} height={PLOT + 52} className={s.hit}>
            <title>{columnTitle(b)}</title>
          </rect>
        ))}
      </svg>
    </div>
  );
}
