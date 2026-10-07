"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DeskBar, DeskStatus } from "@/components/desk/DeskBar";
import * as Popover from "@radix-ui/react-popover";
import { motion } from "motion/react";
import { Check, ChevronDown, Flame, Store } from "lucide-react";
import type { LineupMode, WeekDay, WeekGrid } from "@/lib/week-grid";
import { formatRelativeTime } from "@/lib/relative-time";
import type { TeamOption } from "./WeekPage";
import { monthDay, periodRange, pts, signed, tip } from "./format";
import dk from "@/components/desk/desk.module.css";
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
  onRefresh: () => void;
  container: HTMLElement | null;
}

export function Bar({ teams, teamId, onTeam, period, days, oppName, liveGames, demo, onRefresh, container }: BarProps) {
  const [open, setOpen] = useState(false);
  const team = teams.find((t) => t.id === teamId);
  return (
    <DeskBar
      desk="week"
      demo={demo}
      onRefresh={onRefresh}
      right={
        liveGames > 0 ? (
          <span className={dk.badge}>
            <span className={dk.liveDot} />
            {liveGames} live
          </span>
        ) : null
      }
    >
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button type="button" className={dk.ghost} disabled={teams.length < 2 && !!team}>
            <span style={{ fontWeight: 500 }}>{team?.name ?? "Pick a team"}</span>
            {team ? <span className={dk.sub}>{team.tag}</span> : null}
            {teams.length > 1 ? <ChevronDown size={14} className={dk.chev} /> : null}
          </button>
        </Popover.Trigger>
        <Popover.Portal container={container}>
          <Popover.Content className={dk.menu} align="start" sideOffset={6} style={{ width: 280 }}>
            <div className={dk.menuList}>
              {teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={dk.menuItem}
                  onClick={() => {
                    onTeam(t.id);
                    setOpen(false);
                  }}
                >
                  <span className={dk.grow}>{t.name}</span>
                  <span className={dk.sub}>{t.tag}</span>
                  {t.id === teamId ? <Check size={13} /> : <span style={{ width: 13 }} />}
                </button>
              ))}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {period != null && days.length ? (
        <span className={dk.label} style={{ color: "var(--text-2)" }}>
          Week {period} · {periodRange(days[0].date, days[days.length - 1].date)}
          {oppName ? ` · vs ${oppName}` : ""}
        </span>
      ) : null}
    </DeskBar>
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
  const cls = className ?? (value > 0.05 ? dk.up : value < -0.05 ? dk.down : dk.flat);
  return <span className={`${dk.chip} ${cls}`}>{signed(value)}</span>;
}

export function Tape({ grid, stagedDelta, stagedCount, previewDelta, tonight }: TapeProps) {
  const nowDiff = grid.now.you - grid.now.opp;
  const projDiff = grid.projected.you - grid.projected.opp;
  const share = grid.projected.you + grid.projected.opp > 0 ? grid.projected.you / (grid.projected.you + grid.projected.opp) : 0.5;
  const shown = Math.min(1, Math.max(0, 0.5 + (share - 0.5) * 4));
  return (
    <section className={s.tape} aria-label="This week">
      <div className={s.tick}>
        <span className={dk.label}>Now</span>
        <span className={s.tickValue}>
          {pts(grid.now.you)}
          <span className={s.vs}>vs</span>
          <span className={s.tickSub}>{pts(grid.now.opp)}</span>
          <Diff value={nowDiff} />
        </span>
      </div>
      <div className={s.tick}>
        <span className={dk.label}>Projected finish</span>
        <span className={s.tickValue}>
          {pts(grid.projected.you)}
          <span className={s.vs}>vs</span>
          <span className={s.tickSub}>{pts(grid.projected.opp)}</span>
          <Diff value={projDiff} />
        </span>
      </div>
      <div className={s.tick} style={{ justifyContent: "center" }}>
        <span className={dk.label}>Edge</span>
        <span className={s.edgeBar} title={`${Math.round(share * 1000) / 10}% of projected points`}>
          <span className={s.edgeFill} style={{ width: `${shown * 100}%` }} />
          <span className={s.edgeMid} />
        </span>
      </div>
      <div className={s.tick}>
        <span className={dk.label}>Starts left</span>
        <span className={s.tickValue}>
          {grid.startsLeft.you}
          <span className={s.vs}>vs</span>
          <span className={s.tickSub}>{grid.startsLeft.opp}</span>
          <Diff value={grid.startsLeft.you - grid.startsLeft.opp} className={grid.startsLeft.you >= grid.startsLeft.opp ? dk.up : dk.down} />
        </span>
      </div>
      <div className={s.tick}>
        <span className={dk.label}>Tonight</span>
        <span className={s.tickValue} style={{ fontSize: 15 }}>
          {tonight.live > 0 ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span className={dk.liveDot} /> {tonight.live} live
            </span>
          ) : null}
          <span className={s.tickSub}>
            {tonight.toTip > 0 ? `${tonight.toTip} to tip${tonight.nextTip ? ` · next ${tip(tonight.nextTip)}` : ""}` : tonight.live ? "" : "no games left"}
          </span>
        </span>
      </div>
      {stagedCount > 0 || previewDelta != null ? (
        <div className={s.tick}>
          <span className={dk.label}>Pending</span>
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
                <Diff value={previewDelta} className={dk.pv} />
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

export type WeekView = "daily" | "players" | "matchup";

const VIEWS: Array<{ id: WeekView; label: string; title: string }> = [
  { id: "daily", label: "DAILY LINEUPS", title: "Every day's lineup, spot by spot" },
  { id: "players", label: "PLAYERS", title: "One row per player across the week" },
  { id: "matchup", label: "MATCHUP", title: "One day, your lineup against theirs, box scores live" },
];

interface ToolbarProps {
  days: WeekDay[];
  todayIndex: number | null;
  /** The day rail: the players view's lineup day, the matchup's day; none in the daily view. */
  rail: { day: number; enabled: ReadonlySet<number> | null; onDay: (d: number) => void } | null;
  canAutoslot: boolean;
  /** The day autoslot acts on, e.g. "Thu 11/12". */
  autoslotLabel: string;
  autoslotting: boolean;
  onAutoslot: () => void;
  heat: boolean;
  onHeat: () => void;
  note: string | null;
  mode: LineupMode;
  onMode: () => void;
  /** Projected points the best lineup each day adds over the lineup as set. */
  bestGain: number;
  view: WeekView;
  onView: (view: WeekView) => void;
  /** The market pane, open or not. */
  market: boolean;
  onMarket: () => void;
}

export function Toolbar({
  days,
  todayIndex,
  rail,
  canAutoslot,
  autoslotLabel,
  autoslotting,
  onAutoslot,
  heat,
  onHeat,
  note,
  mode,
  onMode,
  bestGain,
  view,
  onView,
  market,
  onMarket,
}: ToolbarProps) {
  return (
    <div className={s.toolbar}>
      <span className={dk.label}>View</span>
      <div className={dk.rail} role="radiogroup" aria-label="Grid view">
        {VIEWS.map((v) => {
          const on = view === v.id;
          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={on}
              className={`${dk.seg} ${on ? dk.segOn : ""}`}
              onClick={() => !on && onView(v.id)}
              title={v.title}
            >
              {on ? <motion.span layoutId="view-pill" className={dk.segPill} transition={{ type: "spring", stiffness: 600, damping: 45 }} /> : null}
              <span className={dk.segLabel}>{v.label}</span>
            </button>
          );
        })}
      </div>
      <span className={dk.kbd}>V</span>
      <span className={dk.divider} />
      <span className={dk.label}>Lineup</span>
      <div className={dk.rail} role="radiogroup" aria-label="Lineup view">
        {(["espn", "best"] as const).map((m) => {
          const on = mode === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={on}
              className={`${dk.seg} ${on ? dk.segOn : ""}`}
              onClick={() => !on && onMode()}
              title={m === "espn" ? "Your lineup as set on ESPN, carried forward" : "The best lineup for each day's games"}
            >
              {on ? <motion.span layoutId="mode-pill" className={dk.segPill} transition={{ type: "spring", stiffness: 600, damping: 45 }} /> : null}
              <span className={dk.segLabel}>
                {m === "espn" ? "AS SET" : "BEST"}
                {m === "best" && bestGain > 0.05 ? <span className={`${dk.chip} ${dk.up}`}>{signed(bestGain)}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
      <span className={dk.kbd}>L</span>
      <span className={dk.divider} />
      {rail ? (
        <>
          <span className={dk.label}>Day</span>
          <div className={dk.rail} role="radiogroup" aria-label="Day">
            {days.map((d) => {
              const on = d.index === rail.day;
              return (
                <button
                  key={d.date}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`${dk.seg} ${on ? dk.segOn : ""}`}
                  disabled={rail.enabled != null && !rail.enabled.has(d.index)}
                  onClick={() => rail.onDay(d.index)}
                >
                  {on ? <motion.span layoutId="day-pill" className={dk.segPill} transition={{ type: "spring", stiffness: 600, damping: 45 }} /> : null}
                  <span className={dk.segLabel}>
                    {d.index === todayIndex ? <span className={s.todayDot} /> : null}
                    {d.dow.toUpperCase()} {monthDay(d.date).split("/")[1]}
                  </span>
                </button>
              );
            })}
          </div>
          <span className={dk.divider} />
        </>
      ) : null}
      <button type="button" className={dk.btn} onClick={onAutoslot} disabled={!canAutoslot || autoslotting} title="Fill that day's lineup: the best lineup for its games (A)">
        {autoslotting ? "Planning…" : `Autoslot ${autoslotLabel}`}
        <span className={dk.kbd}>A</span>
      </button>
      {view !== "matchup" ? (
        <button type="button" className={`${dk.btn} ${heat ? dk.toggleOn : ""}`} onClick={onHeat} aria-pressed={heat} title="Shade cells by points (H)">
          <Flame size={13} />
          Heat
          <span className={dk.kbd}>H</span>
        </button>
      ) : null}
      {note ? <span className={s.note}>{note}</span> : null}
      <button type="button" className={`${dk.btn} ${market ? dk.toggleOn : ""}`} onClick={onMarket} aria-pressed={market} title="Free agents, ranked by what they add to your week (P)">
        <Store size={13} />
        Market
        <span className={dk.kbd}>P</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status line
// ---------------------------------------------------------------------------

const WEEK_KEYS: Array<[string, string]> = [
  ["↑↓←→", "move"],
  ["⏎", "open"],
  ["M", "move player"],
  ["R", "replace"],
  ["A", "autoslot"],
  ["L", "as set / best"],
  ["V", "view"],
  ["[ ]", "day"],
  ["H", "heat"],
  ["P", "market"],
  ["T", "theme"],
  ["esc", "clear"],
];

export function StatusLine({ updatedAt, demo }: { updatedAt: number | null; demo: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <DeskStatus keys={WEEK_KEYS}>
      {demo ? <span>Demo · sample data · nothing is sent to ESPN</span> : null}
      {!demo && updatedAt ? <span>Updated {formatRelativeTime(updatedAt, now)}</span> : null}
    </DeskStatus>
  );
}

// ---------------------------------------------------------------------------
// Empty and loading states
// ---------------------------------------------------------------------------

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className={dk.empty}>
      <span className={dk.emptyTitle}>{title}</span>
      <span style={{ maxWidth: 420, lineHeight: 1.5 }}>{body}</span>
      <span style={{ display: "flex", gap: 10 }}>
        {action}
        <Link href="/week?demo" className={dk.btn} style={{ textDecoration: "none" }}>
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
            <span key={j} className={dk.skel} style={{ opacity: 1 - i * 0.06 }} />
          ))}
        </div>
      ))}
    </div>
  );
}
