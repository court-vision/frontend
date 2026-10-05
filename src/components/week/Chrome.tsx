"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import { motion } from "motion/react";
import { Check, ChevronDown, Flame, Moon, RotateCw, Sparkles, Sun } from "lucide-react";
import type { WeekDay, WeekGrid } from "@/lib/week-grid";
import { formatRelativeTime } from "@/lib/relative-time";
import type { TeamOption } from "./WeekPage";
import { monthDay, periodRange, pts, signed, tip } from "./format";
import s from "./week.module.css";

// ---------------------------------------------------------------------------
// Bar
// ---------------------------------------------------------------------------

interface BarProps {
  teams: TeamOption[];
  teamId: number | null;
  onTeam: (id: number) => void;
  period: number | null;
  days: WeekDay[];
  oppName: string | null;
  liveGames: number;
  demo: boolean;
  theme: "dark" | "light";
  onTheme: () => void;
  onRefresh: () => void;
  container: HTMLElement | null;
}

export function Bar({ teams, teamId, onTeam, period, days, oppName, liveGames, demo, theme, onTheme, onRefresh, container }: BarProps) {
  const [open, setOpen] = useState(false);
  const team = teams.find((t) => t.id === teamId);
  return (
    <header className={s.bar}>
      <Link href="/" className={s.mark} title="Back to Court Vision">
        <span className={s.markGlyph} aria-hidden />
        court vision
      </Link>
      <span className={s.divider} />
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button type="button" className={s.ghost} disabled={teams.length < 2 && !!team}>
            <span style={{ fontWeight: 500 }}>{team?.name ?? "Pick a team"}</span>
            {team ? <span className={s.sub}>{team.tag}</span> : null}
            {teams.length > 1 ? <ChevronDown size={14} className={s.chev} /> : null}
          </button>
        </Popover.Trigger>
        <Popover.Portal container={container}>
          <Popover.Content className={s.menu} align="start" sideOffset={6} style={{ width: 280 }}>
            <div className={s.menuList}>
              {teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={s.menuItem}
                  style={{ width: "100%", border: 0, background: "transparent", color: "inherit", font: "inherit" }}
                  onClick={() => {
                    onTeam(t.id);
                    setOpen(false);
                  }}
                >
                  <span className={s.grow} style={{ textAlign: "left" }}>{t.name}</span>
                  <span className={s.sub}>{t.tag}</span>
                  {t.id === teamId ? <Check size={13} /> : <span style={{ width: 13 }} />}
                </button>
              ))}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {period != null && days.length ? (
        <span className={s.label} style={{ color: "var(--text-2)" }}>
          Week {period} · {periodRange(days[0].date, days[days.length - 1].date)}
          {oppName ? ` · vs ${oppName}` : ""}
        </span>
      ) : null}
      <span className={s.spacer} />
      {liveGames > 0 ? (
        <span className={s.badge}>
          <span className={s.liveDot} />
          {liveGames} live
        </span>
      ) : null}
      {demo ? (
        <span className={`${s.badge} ${s.badgeDemo}`} title="Sample data. Nothing is sent anywhere.">
          <Sparkles size={11} /> Demo
        </span>
      ) : null}
      <button type="button" className={s.iconBtn} onClick={onRefresh} aria-label="Refresh" title="Refresh">
        <RotateCw size={14} />
      </button>
      <button type="button" className={s.iconBtn} onClick={onTheme} aria-label="Switch theme" title="Theme (T)">
        {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
      </button>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Tape: the headline numbers
// ---------------------------------------------------------------------------

interface TapeProps {
  grid: WeekGrid;
  /** Projected change from the staged lineup moves. */
  stagedDelta: number;
  stagedCount: number;
  /** Projected change from the previewed free agent. */
  previewDelta: number | null;
  tonight: { live: number; toTip: number; nextTip: string | null };
}

function Diff({ value, className }: { value: number; className?: string }) {
  const cls = className ?? (value > 0.05 ? s.up : value < -0.05 ? s.down : s.flat);
  return <span className={`${s.chip} ${cls}`}>{signed(value)}</span>;
}

export function Tape({ grid, stagedDelta, stagedCount, previewDelta, tonight }: TapeProps) {
  const nowDiff = grid.now.you - grid.now.opp;
  const projDiff = grid.projected.you - grid.projected.opp;
  const share = grid.projected.you + grid.projected.opp > 0 ? grid.projected.you / (grid.projected.you + grid.projected.opp) : 0.5;
  const shown = Math.min(1, Math.max(0, 0.5 + (share - 0.5) * 4));
  return (
    <section className={s.tape} aria-label="This week">
      <div className={s.tick}>
        <span className={s.label}>Now</span>
        <span className={s.tickValue}>
          {pts(grid.now.you)}
          <span className={s.vs}>vs</span>
          <span className={s.tickSub}>{pts(grid.now.opp)}</span>
          <Diff value={nowDiff} />
        </span>
      </div>
      <div className={s.tick}>
        <span className={s.label}>Projected finish</span>
        <span className={s.tickValue}>
          {pts(grid.projected.you)}
          <span className={s.vs}>vs</span>
          <span className={s.tickSub}>{pts(grid.projected.opp)}</span>
          <Diff value={projDiff} />
        </span>
      </div>
      <div className={s.tick} style={{ justifyContent: "center" }}>
        <span className={s.label}>Edge</span>
        <span className={s.edgeBar} title={`${Math.round(share * 1000) / 10}% of projected points`}>
          <span className={s.edgeFill} style={{ width: `${shown * 100}%` }} />
          <span className={s.edgeMid} />
        </span>
      </div>
      <div className={s.tick}>
        <span className={s.label}>Starts left</span>
        <span className={s.tickValue}>
          {grid.startsLeft.you}
          <span className={s.vs}>vs</span>
          <span className={s.tickSub}>{grid.startsLeft.opp}</span>
          <Diff value={grid.startsLeft.you - grid.startsLeft.opp} className={grid.startsLeft.you >= grid.startsLeft.opp ? s.up : s.down} />
        </span>
      </div>
      <div className={s.tick}>
        <span className={s.label}>Tonight</span>
        <span className={s.tickValue} style={{ fontSize: 15 }}>
          {tonight.live > 0 ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span className={s.liveDot} /> {tonight.live} live
            </span>
          ) : null}
          <span className={s.tickSub}>
            {tonight.toTip > 0 ? `${tonight.toTip} to tip${tonight.nextTip ? ` · next ${tip(tonight.nextTip)}` : ""}` : tonight.live ? "" : "no games left"}
          </span>
        </span>
      </div>
      {stagedCount > 0 || previewDelta != null ? (
        <div className={s.tick}>
          <span className={s.label}>Pending</span>
          <span className={s.tickValue} style={{ fontSize: 15 }}>
            {stagedCount > 0 ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span className={s.tickSub}>{stagedCount} move{stagedCount === 1 ? "" : "s"}</span>
                <Diff value={stagedDelta} />
              </span>
            ) : null}
            {previewDelta != null ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span className={s.tickSub}>preview</span>
                <Diff value={previewDelta} className={s.pv} />
              </span>
            ) : null}
          </span>
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Toolbar: the lineup day rail and the grid's switches
// ---------------------------------------------------------------------------

interface ToolbarProps {
  days: WeekDay[];
  viewDay: number;
  viewable: ReadonlySet<number>;
  todayIndex: number | null;
  onViewDay: (d: number) => void;
  canAutoslot: boolean;
  autoslotting: boolean;
  onAutoslot: () => void;
  heat: boolean;
  onHeat: () => void;
  note: string | null;
}

export function Toolbar({ days, viewDay, viewable, todayIndex, onViewDay, canAutoslot, autoslotting, onAutoslot, heat, onHeat, note }: ToolbarProps) {
  return (
    <div className={s.toolbar}>
      <span className={s.label}>Lineup for</span>
      <div className={s.rail} role="radiogroup" aria-label="Lineup day">
        {days.map((d) => {
          const on = d.index === viewDay;
          return (
            <button
              key={d.date}
              type="button"
              role="radio"
              aria-checked={on}
              className={`${s.day} ${on ? s.dayOn : ""}`}
              disabled={!viewable.has(d.index)}
              onClick={() => onViewDay(d.index)}
            >
              {on ? <motion.span layoutId="day-pill" className={s.dayPill} transition={{ type: "spring", stiffness: 600, damping: 45 }} /> : null}
              <span className={s.dayLabel}>
                {d.index === todayIndex ? <span className={s.todayDot} /> : null}
                {d.dow.toUpperCase()} {monthDay(d.date).split("/")[1]}
              </span>
            </button>
          );
        })}
      </div>
      <span className={s.kbd}>[</span>
      <span className={s.kbd}>]</span>
      <span className={s.divider} />
      <button type="button" className={s.btn} onClick={onAutoslot} disabled={!canAutoslot || autoslotting} title="Fill today's lineup (A)">
        {autoslotting ? "Planning…" : "Autoslot today"}
        <span className={s.kbd}>A</span>
      </button>
      <button type="button" className={`${s.btn} ${heat ? s.toggleOn : ""}`} onClick={onHeat} aria-pressed={heat} title="Shade cells by points (H)">
        <Flame size={13} />
        Heat
        <span className={s.kbd}>H</span>
      </button>
      {note ? <span className={s.note}>{note}</span> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status line
// ---------------------------------------------------------------------------

export function StatusLine({ updatedAt, demo }: { updatedAt: number | null; demo: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <footer className={s.status}>
      <span className={s.keys}>
        <span><span className={s.kbd}>↑↓←→</span> move</span>
        <span><span className={s.kbd}>⏎</span> open</span>
        <span><span className={s.kbd}>M</span> move player</span>
        <span><span className={s.kbd}>R</span> replace</span>
        <span><span className={s.kbd}>A</span> autoslot</span>
        <span><span className={s.kbd}>[ ]</span> day</span>
        <span><span className={s.kbd}>H</span> heat</span>
        <span><span className={s.kbd}>T</span> theme</span>
        <span><span className={s.kbd}>esc</span> clear</span>
      </span>
      <span className={s.spacer} />
      {demo ? <span>Demo · sample data · nothing is sent to ESPN</span> : null}
      {!demo && updatedAt ? <span>Updated {formatRelativeTime(updatedAt, now)}</span> : null}
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Empty and loading states
// ---------------------------------------------------------------------------

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className={s.empty}>
      <span className={s.emptyTitle}>{title}</span>
      <span style={{ maxWidth: 420, lineHeight: 1.5 }}>{body}</span>
      <span style={{ display: "flex", gap: 10 }}>
        {action}
        <Link href="/week?demo" className={s.btn} style={{ textDecoration: "none" }}>
          Open the demo week
        </Link>
      </span>
    </div>
  );
}

export function LoadingGrid() {
  return (
    <div className={s.gridWrap} style={{ padding: 16, display: "flex", flexDirection: "column", gap: 18 }} aria-busy>
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "240px repeat(7, 1fr) 90px", gap: 18 }}>
          {Array.from({ length: 9 }, (_, j) => (
            <span key={j} className={s.skel} style={{ opacity: 1 - i * 0.06 }} />
          ))}
        </div>
      ))}
    </div>
  );
}
