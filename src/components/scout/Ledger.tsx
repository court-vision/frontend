"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGamesOnDateQuery } from "@/hooks/useGames";
import { useOwnershipTrendingQuery } from "@/hooks/useOwnershipTrending";
import { useEspnMarketMoversQuery } from "@/hooks/useScout";
import { NBA_TEAMS } from "@/lib/nbaTeams";
import {
  dayName,
  daysBetween,
  dow,
  filterPool,
  fmtDelta,
  fmtStat,
  gameState,
  gameStatusText,
  monthDay,
  sameFocus,
  shortName,
  slateDates,
  type Focus,
  type Lens,
  type PoolSort,
  type PosFilter,
} from "@/lib/scout";
import type { RankingsPlayer, RankingsWindow } from "@/types/rankings";
import type { ScoringFormat } from "@/types/scoring";
import { MoveChip, Skeleton } from "./blocks";
import dk from "@/components/desk/desk.module.css";
import s from "./scout.module.css";

export interface PoolState {
  rows: RankingsPlayer[];
  loading: boolean;
  error: string | null;
  /** The backend's word for an empty pool (before opening night, say). */
  message: string;
  format: ScoringFormat;
  setFormat: (f: ScoringFormat) => void;
  span: RankingsWindow;
  setSpan: (w: RankingsWindow) => void;
}

export interface LedgerProps {
  lens: Lens;
  focus: Focus | null;
  open: (focus: Focus) => void;
  cursor: number;
  setCursor: (i: number) => void;
  /** What the keyboard can walk, in the order shown. */
  onRows: (rows: Focus[]) => void;
  pool: PoolState;
  today: string;
}

/** The list beside the sheet: whichever lens is on. */
export function Ledger(props: LedgerProps) {
  switch (props.lens) {
    case "pool":
      return <PoolLedger {...props} />;
    case "teams":
      return <TeamsLedger {...props} />;
    case "slate":
      return <SlateLedger {...props} />;
    case "market":
      return <MarketLedger {...props} />;
  }
}

/** Keeps the cursor row in view as the keyboard moves it. */
function useCursorScroll(cursor: number, lens: string) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>("[data-cursor='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor, lens]);
  return list;
}

function MiniRail<T extends string | number | null>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ v: T; label: string; title?: string }>;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className={s.miniRail} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          role="radio"
          aria-checked={o.v === value}
          className={`${s.miniSeg} ${o.v === value ? s.miniSegOn : ""}`}
          onClick={() => onChange(o.v)}
          title={o.title}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pool
// ---------------------------------------------------------------------------

const POS: PosFilter[] = ["ALL", "G", "F", "C"];
const SORTS: Array<{ v: PoolSort; label: string; title: string }> = [
  { v: "rank", label: "RANK", title: "By the rankings" },
  { v: "fpts", label: "AVG", title: "By per-game value" },
  { v: "change", label: "MOVERS", title: "By rank change over the week" },
  { v: "gp", label: "GP", title: "By games played" },
];

function PoolLedger({ focus, open, cursor, setCursor, onRows, pool, lens }: LedgerProps) {
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<PosFilter>("ALL");
  const [sort, setSort] = useState<PoolSort>("rank");
  const rows = useMemo(() => filterPool(pool.rows, q, pos, sort), [pool.rows, q, pos, sort]);
  useEffect(() => onRows(rows.map((r) => ({ kind: "player", id: r.id }))), [rows, onRows]);
  const list = useCursorScroll(cursor, lens);
  const cats = pool.format === "categories";
  return (
    <>
      <div className={s.ledgerHead}>
        <input
          className={s.filter}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setCursor(0);
          }}
          placeholder="Filter the pool — name, team, initials"
          aria-label="Filter the pool"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQ("");
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "Enter" && rows[cursor]) open({ kind: "player", id: rows[cursor].id });
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor(Math.min(rows.length - 1, cursor + 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor(Math.max(0, cursor - 1));
            }
          }}
        />
        <div className={s.ledgerTools}>
          <MiniRail
            label="Scoring"
            value={pool.format}
            options={[
              { v: "points", label: "PTS", title: "Fantasy points, the platform formula" },
              { v: "categories", label: "9-CAT", title: "Summed category z-scores" },
            ]}
            onChange={pool.setFormat}
          />
          <MiniRail
            label="Span"
            value={pool.span}
            options={[
              { v: null, label: "SEASON" },
              { v: 30, label: "30D" },
              { v: 14, label: "14D" },
              { v: 7, label: "7D" },
            ]}
            onChange={pool.setSpan}
          />
          <MiniRail label="Position" value={pos} options={POS.map((p) => ({ v: p, label: p }))} onChange={setPos} />
          <MiniRail label="Sort" value={sort} options={SORTS} onChange={setSort} />
        </div>
      </div>
      <div ref={list} className={s.rows} role="listbox" aria-label="Pool">
        {pool.loading ? (
          <Skeleton rows={14} className={s.ledgerSkel} />
        ) : pool.error ? (
          <div className={s.ledgerEmpty}>{pool.error}</div>
        ) : rows.length === 0 ? (
          <div className={s.ledgerEmpty}>{pool.rows.length === 0 ? pool.message || "The pool is empty." : `Nobody matches “${q}”.`}</div>
        ) : (
          <>
            <div className={`${s.row} ${s.rowPool} ${s.group}`} style={{ height: 26, cursor: "default" }} aria-hidden>
              <span className={s.rowRank}>#</span>
              <span className={s.rowSub}>PLAYER</span>
              <span className={s.rowSub}>TEAM</span>
              <span className={s.rowNum} style={{ color: "var(--text-3)", fontSize: 10 }}>
                GP
              </span>
              <span className={s.rowNum} style={{ color: "var(--text-3)", fontSize: 10 }}>
                {cats ? "Z" : "FPTS"}
              </span>
              <span className={s.rowNum} style={{ color: "var(--text-3)", fontSize: 10 }}>
                7D
              </span>
            </div>
            {rows.map((r, i) => {
              const f: Focus = { kind: "player", id: r.id };
              const on = sameFocus(f, focus);
              return (
                <button
                  key={r.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  data-cursor={i === cursor}
                  className={`${s.row} ${s.rowPool} ${on ? s.rowOn : ""} ${i === cursor ? s.rowCursor : ""}`}
                  onClick={() => {
                    setCursor(i);
                    open(f);
                  }}
                  onMouseEnter={() => setCursor(i)}
                >
                  <span className={s.rowRank}>{r.rank}</span>
                  <span className={s.rowName} title={r.player_name}>
                    {shortName(r.player_name)}
                  </span>
                  <span className={s.rowSub}>
                    {r.team}
                    {r.position ? ` ${r.position}` : ""}
                  </span>
                  <span className={s.rowNum}>{r.gp ?? "—"}</span>
                  <span className={`${s.rowNum} ${s.rowNumStrong}`}>{cats ? fmtStat(r.score) : fmtStat(r.avg_fpts)}</span>
                  <span style={{ textAlign: "right" }}>
                    <MoveChip change={r.rank_change} />
                  </span>
                </button>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

const DIVISIONS = ["Atlantic", "Central", "Southeast", "Northwest", "Pacific", "Southwest"];

function TeamsLedger({ focus, open, cursor, setCursor, onRows, lens }: LedgerProps) {
  const groups = useMemo(() => DIVISIONS.map((d) => ({ division: d, teams: NBA_TEAMS.filter((t) => t.division === d) })), []);
  const flat = useMemo(() => groups.flatMap((g) => g.teams), [groups]);
  useEffect(() => onRows(flat.map((t) => ({ kind: "team", abbrev: t.abbrev }))), [flat, onRows]);
  const list = useCursorScroll(cursor, lens);
  let i = -1;
  return (
    <>
      <div className={s.ledgerHead}>
        <span className={s.ledgerNote}>Thirty teams by division. A team&apos;s sheet has its ratings, roster, schedule and tonight&apos;s game.</span>
      </div>
      <div ref={list} className={s.rows} role="listbox" aria-label="Teams">
        {groups.map((g) => (
          <div key={g.division}>
            <div className={s.group}>
              <span className={dk.label}>
                {g.teams[0].conference} · {g.division}
              </span>
            </div>
            {g.teams.map((t) => {
              i += 1;
              const idx = i;
              const f: Focus = { kind: "team", abbrev: t.abbrev };
              const on = sameFocus(f, focus);
              return (
                <button
                  key={t.abbrev}
                  type="button"
                  role="option"
                  aria-selected={on}
                  data-cursor={idx === cursor}
                  className={`${s.row} ${s.rowTeam} ${on ? s.rowOn : ""} ${idx === cursor ? s.rowCursor : ""}`}
                  onClick={() => {
                    setCursor(idx);
                    open(f);
                  }}
                  onMouseEnter={() => setCursor(idx)}
                >
                  <span className={s.teamAbbrev}>{t.abbrev}</span>
                  <span className={s.rowName}>{t.name}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Slate
// ---------------------------------------------------------------------------

function SlateLedger({ focus, open, cursor, setCursor, onRows, today, lens }: LedgerProps) {
  const selected = focus?.kind === "slate" ? focus.date : today;
  // A few days back and a week and a half ahead, stretched to reach an open night outside that.
  const days = useMemo(() => {
    const diff = daysBetween(today, selected);
    return slateDates(today, Math.max(3, -diff + 2), Math.max(10, diff + 2));
  }, [today, selected]);
  useEffect(() => onRows(days.map((d) => ({ kind: "slate", date: d }))), [days, onRows]);
  const games = useGamesOnDateQuery(selected);
  const list = useCursorScroll(cursor, lens);
  return (
    <>
      <div className={s.ledgerHead}>
        <span className={s.ledgerNote}>A night at a time: its games, and who is scoring in them while they run.</span>
      </div>
      <div ref={list} className={s.rows} role="listbox" aria-label="Nights">
        {days.map((d, i) => {
          const f: Focus = { kind: "slate", date: d };
          const on = sameFocus(f, focus);
          const isSel = d === selected;
          return (
            <div key={d}>
              <button
                type="button"
                role="option"
                aria-selected={on}
                data-cursor={i === cursor}
                className={`${s.row} ${s.rowDay} ${on ? s.rowOn : ""} ${i === cursor ? s.rowCursor : ""}`}
                onClick={() => {
                  setCursor(i);
                  open(f);
                }}
                onMouseEnter={() => setCursor(i)}
              >
                <span className={s.teamAbbrev} style={{ color: d === today ? "var(--accent)" : undefined }}>
                  {dow(d).toUpperCase()}
                </span>
                <span className={s.rowName}>
                  {monthDay(d)}
                  {d === today || Math.abs(new Date(`${d}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) === 86_400_000 ? (
                    <span className={s.rowSub} style={{ marginLeft: 7 }}>
                      {dayName(d, today)}
                    </span>
                  ) : null}
                </span>
                {isSel ? (
                  <span className={s.rowSub}>{games.isLoading ? "…" : `${games.data?.count ?? 0} games`}</span>
                ) : (
                  <span />
                )}
              </button>
              {isSel ? (
                <div className={s.dayGames}>
                  {games.isLoading ? (
                    <div className={s.dayGame}>loading…</div>
                  ) : !games.data || games.data.games.length === 0 ? (
                    <div className={s.dayGame}>No games.</div>
                  ) : (
                    games.data.games.map((g) => {
                      const state = gameState(g.status);
                      const status = gameStatusText(g.status, g.period, g.game_clock, g.start_time_et);
                      return (
                        <div key={g.game_id ?? `${g.away_team}-${g.home_team}`} className={s.dayGame}>
                          <button type="button" className={s.teamBtn} onClick={() => open({ kind: "team", abbrev: g.away_team })}>
                            {g.away_team}
                          </button>
                          <span className={s.dim}>@</span>
                          <button type="button" className={s.teamBtn} onClick={() => open({ kind: "team", abbrev: g.home_team })}>
                            {g.home_team}
                          </button>
                          <span className={dk.spacer} />
                          {state !== "scheduled" ? (
                            <span style={{ color: "var(--text)" }}>
                              {g.away_score ?? 0}–{g.home_score ?? 0}
                            </span>
                          ) : null}
                          <span className={state === "live" ? s.live : s.dim}>{status}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Market
// ---------------------------------------------------------------------------

type MarketTab = "adds" | "drops" | "draft";

export const TRENDING_PARAMS = { days: 7, limit: 40, sort_by: "change" as const, direction: "both" as const };

function MarketLedger({ focus, open, cursor, setCursor, onRows, lens }: LedgerProps) {
  const [tab, setTab] = useState<MarketTab>("adds");
  const trending = useOwnershipTrendingQuery(TRENDING_PARAMS);
  const movers = useEspnMarketMoversQuery(7, "adp", "both", 40, tab === "draft");
  const rows = useMemo(() => {
    if (tab === "adds") return (trending.data?.trending_up ?? []).map((p) => ({ id: p.player_id, name: p.player_name, sub: p.team ?? "", value: `${p.current_ownership.toFixed(1)}%`, change: p.change, better: "high" as const }));
    if (tab === "drops") return (trending.data?.trending_down ?? []).map((p) => ({ id: p.player_id, name: p.player_name, sub: p.team ?? "", value: `${p.current_ownership.toFixed(1)}%`, change: p.change, better: "high" as const }));
    return (movers.data?.players ?? [])
      .filter((p) => p.changes.adp != null)
      .sort((a, b) => Math.abs(b.changes.adp ?? 0) - Math.abs(a.changes.adp ?? 0))
      .map((p) => ({ id: p.player_id, name: p.name, sub: p.after?.adp != null ? `ADP ${p.after.adp.toFixed(1)}` : "off the board", value: p.after?.overall_rank != null ? `#${p.after.overall_rank}` : "—", change: p.changes.adp, better: "high" as const }));
  }, [tab, trending.data, movers.data]);
  useEffect(() => onRows(rows.map((r) => ({ kind: "player", id: r.id }))), [rows, onRows]);
  const list = useCursorScroll(cursor, lens);
  const loading = tab === "draft" ? movers.isLoading : trending.isLoading;
  const error = tab === "draft" ? movers.error : trending.error;
  return (
    <>
      <div className={s.ledgerHead}>
        <MiniRail
          label="Market"
          value={tab}
          options={[
            { v: "adds", label: "ADDS", title: "Ownership rising over 7 days" },
            { v: "drops", label: "DROPS", title: "Ownership falling over 7 days" },
            { v: "draft", label: "DRAFT", title: "ESPN draft-market movement: ADP over 7 days" },
          ]}
          onChange={(t) => {
            setTab(t);
            setCursor(0);
          }}
        />
        <span className={s.ledgerNote}>
          {tab === "draft" ? "ESPN editorial rank and average draft position, now versus a week ago." : "ESPN ownership, now versus a week ago. Change in points of ownership."}
        </span>
      </div>
      <div ref={list} className={s.rows} role="listbox" aria-label="Market">
        {loading ? (
          <Skeleton rows={12} className={s.ledgerSkel} />
        ) : error ? (
          <div className={s.ledgerEmpty}>Couldn&apos;t load the market.</div>
        ) : rows.length === 0 ? (
          <div className={s.ledgerEmpty}>{tab === "draft" ? "No two ESPN snapshots a week apart yet." : "Nothing moved this week."}</div>
        ) : (
          <>
            <div className={`${s.row} ${s.rowMarket} ${s.group}`} style={{ height: 26, cursor: "default" }} aria-hidden>
              <span className={s.rowSub}>PLAYER</span>
              <span className={s.rowNum} style={{ color: "var(--text-3)", fontSize: 10 }}>
                {tab === "draft" ? "RANK" : "OWN"}
              </span>
              <span className={s.rowNum} style={{ color: "var(--text-3)", fontSize: 10 }}>
                {tab === "draft" ? "ADP Δ" : "7D"}
              </span>
            </div>
            {rows.map((r, i) => {
              const f: Focus = { kind: "player", id: r.id };
              const on = sameFocus(f, focus);
              const good = r.change != null && r.change > 0;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  data-cursor={i === cursor}
                  className={`${s.row} ${s.rowMarket} ${on ? s.rowOn : ""} ${i === cursor ? s.rowCursor : ""}`}
                  onClick={() => {
                    setCursor(i);
                    open(f);
                  }}
                  onMouseEnter={() => setCursor(i)}
                >
                  <span className={s.rowName}>
                    {r.name}
                    <span className={s.rowSub} style={{ marginLeft: 7 }}>
                      {r.sub}
                    </span>
                  </span>
                  <span className={`${s.rowNum} ${s.rowNumStrong}`}>{r.value}</span>
                  <span style={{ textAlign: "right" }}>
                    <span className={`${dk.chip} ${r.change == null || Math.abs(r.change) < 0.05 ? dk.flat : good ? dk.up : dk.down}`}>{fmtDelta(r.change)}</span>
                  </span>
                </button>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}
