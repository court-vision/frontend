"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Headshot } from "@/components/desk/Headshot";
import dk from "@/components/desk/desk.module.css";
import {
  DEFAULT_FILTERS,
  NO_DROP,
  better,
  isInjured,
  joinBreakouts,
  matchesFilters,
  positionLabel,
  stripFor,
  type BreakoutRow,
  type DropOption,
  type MarketFilters,
  type PositionFilter,
  type StripState,
} from "@/lib/market";
import type { LineupMode, WeekDay } from "@/lib/week-grid";
import type { BreakoutCandidateResp } from "@/types/breakout";
import type { StreamerPlayer } from "@/types/streamer";
import { monthDay, pts, shortName, signed } from "./format";
import s from "./week.module.css";

export type MarketMode = "week" | "day" | "breakouts";
export interface MarketPick {
  faId: number;
  replaces: number;
}

/** Ranking runs one grid per free agent and candidate drop; the pool beyond this is rarely worth it. */
const RANKED = 120;

const MODES: Array<{ id: MarketMode; label: string; title: string }> = [
  { id: "week", label: "WEEK", title: "Held for the rest of the week: every remaining game counts" },
  { id: "day", label: "ONE DAY", title: "A pickup for one day's games" },
  { id: "breakouts", label: "BREAKOUTS", title: "A starter is out and his minutes go to someone" },
];
const POSITIONS: PositionFilter[] = ["all", "PG", "SG", "SF", "PF", "C"];

interface MarketProps {
  days: WeekDay[];
  todayIndex: number | null;
  /** Active spots per day no counted game fills. */
  open: number[];
  /** The first day an add made now counts (today's first tip has passed), or null. */
  addFrom: number | null;
  /** The grid's lineup view, which every gain here is measured in. */
  lineupMode: LineupMode;
  mode: MarketMode;
  onMode: (mode: MarketMode) => void;
  /** The one-day mode's day (today or later). */
  day: number;
  onDay: (day: number) => void;
  pool: StreamerPlayer[];
  poolLoading: boolean;
  daily: StreamerPlayer[];
  dailyLoading: boolean;
  breakouts: BreakoutCandidateResp[];
  breakoutsLoading: boolean;
  /** Each drop's change to your week (and each day), for one free agent. Stable across hovers. */
  evaluate: (fa: StreamerPlayer, dropIds: number[]) => DropOption[];
  /** The likeliest drops, for ranking the list. */
  drops: number[];
  /** The roster players offered as drops for the selected free agent (the weakest few). */
  allDrops: number[];
  /** Open roster spots: an add needs no drop. */
  room: number;
  nameOf: (id: number) => string;
  /** A roster player's projected points per game. */
  avgOf: (id: number) => number | null;
  pinned: MarketPick | null;
  /** Why the pinned add can't be sent, if it can't. */
  pinnedBlocked: string | null;
  onHover: (pick: MarketPick | null) => void;
  onPin: (pick: MarketPick | null) => void;
  onAdd: (pick: MarketPick) => void;
  onClose: () => void;
}

interface Ranked {
  fa: StreamerPlayer;
  best: DropOption | null;
}

export function MarketPane(props: MarketProps) {
  const { days, todayIndex, open, mode, onMode, day, onDay, pool, daily, evaluate, drops, room, pinned, onHover, onPin, onClose } = props;
  const [filters, setFilters] = useState<MarketFilters>(DEFAULT_FILTERS);
  const set = (patch: Partial<MarketFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const target = mode === "day" ? day : null;
  const candidates = useMemo(() => (room > 0 ? [...drops, NO_DROP] : drops), [drops, room]);

  const ranked = useMemo<Ranked[]>(() => {
    if (mode === "breakouts") return [];
    const list = (mode === "day" ? daily : pool).slice(0, RANKED);
    return list
      .map((fa) => ({ fa, best: evaluate(fa, candidates).reduce<DropOption | null>((b, o) => better(b, o, target), null) }))
      .sort((a, b) => {
        const ka = target != null ? a.best?.byDay[target] ?? 0 : a.best?.week ?? 0;
        const kb = target != null ? b.best?.byDay[target] ?? 0 : b.best?.week ?? 0;
        return kb - ka || (b.best?.week ?? 0) - (a.best?.week ?? 0);
      });
  }, [mode, daily, pool, evaluate, candidates, target]);

  const visible = useMemo(() => ranked.filter((r) => matchesFilters(r.fa, filters)), [ranked, filters]);
  const breakoutRows = useMemo(() => (mode === "breakouts" ? joinBreakouts(props.breakouts, pool) : []), [mode, props.breakouts, pool]);
  const loading = mode === "day" ? props.dailyLoading : mode === "breakouts" ? props.breakoutsLoading || props.poolLoading : props.poolLoading;
  const remaining = days.filter((d) => d.kind !== "past");
  const dayInfo = days[day];

  return (
    <motion.aside
      className={s.market}
      data-market
      aria-label="Market"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 38 }}
      onMouseLeave={() => onHover(null)}
      onKeyDown={(e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const typing = (e.target as HTMLElement).closest("input");
        if (e.key === "Escape" || (e.key === "p" && !typing)) {
          e.preventDefault();
          onClose();
          return;
        }
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
        // Up and down walk the list; the focused row previews in the grid.
        const rows = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("[data-fa-row]")];
        const at = rows.indexOf(document.activeElement as HTMLButtonElement);
        const next = rows[Math.min(rows.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)))];
        if (next) {
          e.preventDefault();
          next.focus();
          next.scrollIntoView({ block: "nearest" });
        }
      }}
    >
      <div className={s.marketHead}>
        <span className={dk.label} style={{ color: "var(--text)" }}>
          Market
        </span>
        <span className={dk.sub}>
          {mode === "breakouts" ? `${props.breakouts.length} candidates` : `${(mode === "day" ? daily : pool).length} free agents`}
          {room > 0 ? ` · ${room} open roster spot${room === 1 ? "" : "s"}` : ""}
        </span>
        <span className={dk.spacer} />
        <span className={dk.kbd}>P</span>
        <button type="button" className={dk.iconBtn} onClick={onClose} aria-label="Close the market" title="Close (P)">
          <X size={14} />
        </button>
      </div>

      <div className={s.marketBar}>
        <div className={dk.rail} role="radiogroup" aria-label="Market mode">
          {MODES.map((m) => {
            const on = mode === m.id;
            return (
              <button key={m.id} type="button" role="radio" aria-checked={on} className={`${dk.seg} ${on ? dk.segOn : ""}`} onClick={() => onMode(m.id)} title={m.title}>
                {on ? <motion.span layoutId="market-mode" className={dk.segPill} transition={{ type: "spring", stiffness: 600, damping: 45 }} /> : null}
                <span className={dk.segLabel}>{m.label}</span>
              </button>
            );
          })}
        </div>
        {mode === "day" && dayInfo ? (
          <span className={s.marketDay}>
            <button type="button" className={dk.iconBtn} disabled={!remaining.length || day <= Math.max(remaining[0].index, props.addFrom ?? 0)} onClick={() => onDay(day - 1)} aria-label="Previous day">
              <ChevronLeft size={14} />
            </button>
            <span className={s.marketDayLabel}>
              {dayInfo.dow} {monthDay(dayInfo.date)}
            </span>
            <button type="button" className={dk.iconBtn} disabled={day >= days.length - 1} onClick={() => onDay(day + 1)} aria-label="Next day">
              <ChevronRight size={14} />
            </button>
          </span>
        ) : null}
      </div>

      {mode !== "breakouts" ? (
        <div className={s.marketFilters}>
          <label className={s.marketSearch}>
            <Search size={13} className={s.marketSearchIcon} />
            <input value={filters.query} onChange={(e) => set({ query: e.target.value })} placeholder="Name or team" spellCheck={false} aria-label="Search free agents" />
          </label>
          <div className={dk.rail} role="radiogroup" aria-label="Position">
            {POSITIONS.map((p) => {
              const on = filters.position === p;
              return (
                <button key={p} type="button" role="radio" aria-checked={on} className={`${dk.seg} ${on ? dk.segOn : ""}`} style={{ height: 24, padding: "0 7px" }} onClick={() => set({ position: p })}>
                  {on ? <motion.span layoutId="market-pos" className={dk.segPill} transition={{ type: "spring", stiffness: 600, damping: 45 }} /> : null}
                  <span className={dk.segLabel}>{p === "all" ? "ALL" : p}</span>
                </button>
              );
            })}
          </div>
          <span className={s.marketToggles}>
            <Toggle on={filters.b2bOnly} onClick={() => set({ b2bOnly: !filters.b2bOnly })} title="Only teams with a back-to-back left">
              B2B
            </Toggle>
            <Toggle on={filters.hideInjured} onClick={() => set({ hideInjured: !filters.hideInjured })} title="Hide anyone with an injury tag">
              Healthy
            </Toggle>
            <Toggle on={filters.hideWaivers} onClick={() => set({ hideWaivers: !filters.hideWaivers })} title="Hide players still on waivers">
              No waivers
            </Toggle>
          </span>
        </div>
      ) : null}

      {props.addFrom != null && days[props.addFrom] ? (
        <div className={s.marketNote}>
          Today&apos;s games have started: an add made now counts from {days[props.addFrom].dow} {monthDay(days[props.addFrom].date)}.
        </div>
      ) : null}
      <div className={`${s.marketRow} ${s.marketColHead}`}>
        <span />
        <span
          className={dk.label}
          title={
            props.lineupMode === "best"
              ? "Measured with the best lineup each day"
              : "Measured against your lineup as set on ESPN, the add seated where he helps most. Switch the lineup to Best (L) to judge with ideal lineups"
          }
        >
          {mode === "breakouts" ? "Beneficiary" : target != null ? `Best for ${days[target]?.dow ?? ""}` : "Best for your week"}
          <span className={dk.sub} style={{ display: "block", textTransform: "none", letterSpacing: 0, marginTop: 2 }}>
            vs {props.lineupMode === "best" ? "best lineups" : "lineups as set"}
          </span>
        </span>
        <span className={s.strip} title="Your open spots each day: where a game counts without benching anyone">
          {days.map((d) => (
            <span key={d.index} className={s.stripHead} data-today={d.index === todayIndex} data-target={d.index === target}>
              <span>{d.dow[0]}</span>
              <span className={s.stripOpen} data-open={(open[d.index] ?? 0) > 0}>
                {d.kind === "past" ? "·" : open[d.index] ?? 0}
              </span>
            </span>
          ))}
        </span>
        <span className={dk.label} style={{ textAlign: "right" }}>
          {target != null ? "Day" : "Week"}
        </span>
      </div>

      <div className={s.marketList} role="list">
        {loading && (mode === "breakouts" ? breakoutRows.length === 0 : ranked.length === 0) ? (
          Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={s.marketRow} style={{ opacity: 1 - i * 0.1 }}>
              <span className={dk.skel} style={{ width: 30, height: 30, borderRadius: 15 }} />
              <span className={dk.skel} />
              <span className={dk.skel} />
              <span className={dk.skel} />
            </div>
          ))
        ) : mode === "breakouts" ? (
          breakoutRows.length === 0 ? (
            <Empty text="No breakout candidates right now." />
          ) : (
            breakoutRows.map((row) => <BreakoutItem key={row.candidate.beneficiary.player_id} row={row} {...props} candidates={candidates} />)
          )
        ) : visible.length === 0 ? (
          <Empty text={ranked.length ? "Nobody matches these filters." : mode === "day" ? "No free agent plays that day." : "No free agents to show."} />
        ) : (
          visible.map((r) => <FaItem key={r.fa.player_id} fa={r.fa} best={r.best} target={target} selected={pinned?.faId === r.fa.player_id} {...props} />)
        )}
      </div>
    </motion.aside>
  );
}

function Toggle({ on, onClick, title, children }: { on: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button type="button" className={`${dk.btn} ${dk.btnSmall} ${on ? dk.toggleOn : ""}`} style={{ height: 24, padding: "0 7px", fontSize: 11 }} aria-pressed={on} onClick={onClick} title={title}>
      {children}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return <div className={s.marketEmpty}>{text}</div>;
}

function Strip({ states }: { states: StripState[] }) {
  return (
    <span className={s.strip} aria-hidden>
      {states.map((st, i) => (
        <span key={i} className={s.stripCell} data-state={st} />
      ))}
    </span>
  );
}

interface ItemProps extends MarketProps {
  fa: StreamerPlayer;
  best: DropOption | null;
  target: number | null;
  selected: boolean;
}

function dropLabel(dropId: number, nameOf: (id: number) => string): string {
  return dropId === NO_DROP ? "into an open spot" : `drop ${shortName(nameOf(dropId))}`;
}

function FaItem(props: ItemProps) {
  const { fa, best, target, selected, days, open, nameOf, onHover, onPin } = props;
  const gain = best ? (target != null ? best.byDay[target] ?? 0 : best.week) : null;
  const injured = isInjured(fa);
  return (
    <div className={s.marketItem} data-selected={selected} role="listitem">
      <button
        type="button"
        className={s.marketRow}
        data-fa-row
        onMouseEnter={() => best && onHover({ faId: fa.player_id, replaces: best.dropId })}
        onFocus={() => best && onHover({ faId: fa.player_id, replaces: best.dropId })}
        onClick={() => onPin(selected ? null : best ? { faId: fa.player_id, replaces: best.dropId } : null)}
        title={selected ? "Stop previewing" : "Preview him in the grid"}
      >
        <Headshot nbaId={fa.nba_player_id ?? null} name={fa.name} size={30} />
        <span className={s.marketWho}>
          <span className={s.marketName}>{fa.name}</span>
          <span className={s.marketMeta}>
            {fa.team} · {positionLabel(fa)} · {pts(fa.avg_points_last_n ?? fa.avg_points_season)}/g
            {fa.has_b2b ? <span className={s.marketTag}>B2B</span> : null}
            {fa.acquisition_status === "waivers" ? (
              <span className={`${s.marketTag} ${s.marketTagWarn}`} title={fa.waivers_until ? `Clears waivers ${fa.waivers_until}` : "On waivers"}>
                WAIVERS{fa.waivers_until ? ` ${monthDay(fa.waivers_until)}` : ""}
              </span>
            ) : null}
            {injured ? <span className={`${s.marketTag} ${s.marketTagWarn}`}>{(fa.injury_status ?? "INJ").replace("DAY_TO_DAY", "DTD")}</span> : null}
          </span>
          <span className={s.marketDrop}>{best ? dropLabel(best.dropId, nameOf) : "no room for him"}</span>
        </span>
        <Strip states={stripFor(fa, days, open, props.addFrom)} />
        <span className={s.marketGain} data-sign={gain == null ? "none" : gain > 0.05 ? "up" : gain < -0.05 ? "down" : "flat"}>
          {gain == null ? "—" : signed(gain)}
        </span>
      </button>
      {selected ? <DropOptions {...props} /> : null}
    </div>
  );
}

/** The selected free agent: every drop that could make room, ranked, and the add. Evaluated only when open. */
function DropOptions({ fa, target, evaluate, allDrops, room, nameOf, avgOf, pinned, pinnedBlocked, onPin, onAdd }: ItemProps) {
  const options = useMemo(() => {
    const ids = room > 0 ? [...allDrops, NO_DROP] : allDrops;
    return evaluate(fa, ids).sort((a, b) => (target != null ? (b.byDay[target] ?? 0) - (a.byDay[target] ?? 0) : 0) || b.week - a.week);
  }, [evaluate, fa, allDrops, room, target]);
  const pick = pinned && pinned.faId === fa.player_id ? pinned : null;
  return (
    <div className={s.marketDetail}>
      <span className={dk.label}>Make room · your weakest players</span>
      <div className={s.marketOptions}>
        {options.slice(0, 6).map((o) => {
          const on = pick?.replaces === o.dropId;
          const value = target != null ? o.byDay[target] ?? 0 : o.week;
          return (
            <button key={o.dropId} type="button" className={s.marketOption} aria-pressed={on} onClick={() => onPin({ faId: fa.player_id, replaces: o.dropId })}>
              <span className={s.marketOptionName}>{o.dropId === NO_DROP ? "Open roster spot" : nameOf(o.dropId)}</span>
              <span className={dk.sub}>
                {o.dropId === NO_DROP ? "" : `${pts(avgOf(o.dropId))}/g`}
                {target != null ? ` · ${signed(o.week)} wk` : ""}
              </span>
              <span className={s.marketGain} data-sign={value > 0.05 ? "up" : value < -0.05 ? "down" : "flat"}>
                {signed(value)}
              </span>
            </button>
          );
        })}
      </div>
      {pick ? (
        <div className={s.marketActs}>
          {pinnedBlocked ? <span className={s.marketBlocked}>{pinnedBlocked}</span> : null}
          <button type="button" className={`${dk.btn} ${dk.btnPrimary} ${dk.btnSmall}`} disabled={!!pinnedBlocked} onClick={() => onAdd(pick)}>
            Add {shortName(fa.name)}
            {pick.replaces === NO_DROP ? "" : `, drop ${shortName(nameOf(pick.replaces))}`}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function BreakoutItem({ row, ...props }: MarketProps & { row: BreakoutRow; candidates: number[] }) {
  const { candidate, fa } = row;
  const inj = candidate.injured_player;
  const sig = candidate.signals;
  const { evaluate, candidates } = props;
  const best = useMemo(
    () => (fa ? evaluate(fa, candidates).reduce<DropOption | null>((b, o) => better(b, o, null), null) : null),
    [fa, evaluate, candidates]
  );
  const back = inj.expected_return ? `back ${monthDay(inj.expected_return)}` : "no return date";
  return (
    <div className={s.breakout} data-available={!!fa}>
      <div className={s.breakoutWhy}>
        <span className={`${s.marketTag} ${s.marketTagDown}`}>{inj.status}</span>
        <span>
          {inj.name} · {inj.avg_min.toFixed(0)} min · {back}
        </span>
      </div>
      {fa ? (
        <FaItem fa={fa} best={best} target={null} selected={props.pinned?.faId === fa.player_id} {...props} />
      ) : (
        <div className={`${s.marketRow} ${s.marketRowStatic}`}>
          <Headshot nbaId={candidate.beneficiary.nba_player_id ?? null} name={candidate.beneficiary.name} size={30} />
          <span className={s.marketWho}>
            <span className={s.marketName}>{candidate.beneficiary.name}</span>
            <span className={s.marketMeta}>
              {candidate.beneficiary.team} · {candidate.beneficiary.position}
            </span>
            <span className={s.marketDrop} title="Rostered in your league, or beyond the free agents searched">Not on your market</span>
          </span>
          <span />
          <span />
        </div>
      )}
      <div className={s.breakoutSignals}>
        #{sig.depth_rank} on the depth chart · +{sig.projected_min_boost.toFixed(1)} min
        {sig.opp_fpts_avg != null ? ` · ${sig.opp_fpts_avg.toFixed(1)} FP/g in ${sig.opp_game_count} games without him` : ""}
      </div>
    </div>
  );
}
