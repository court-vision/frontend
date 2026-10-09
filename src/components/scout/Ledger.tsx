"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, LayoutDashboard } from "lucide-react";
import { TeamLogo } from "@/components/desk/TeamLogo";
import { useGamesOnDateQuery } from "@/hooks/useGames";
import { NBA_TEAMS } from "@/lib/nbaTeams";
import {
  MARKET_SECTIONS,
  dayName,
  daysBetween,
  dow,
  filterPool,
  gameFocus,
  gameState,
  gameStatusText,
  lensInfo,
  matchPool,
  monthDay,
  sameFocus,
  shortName,
  slateDates,
  type Focus,
  type Lens,
} from "@/lib/scout";
import type { RankingsPlayer } from "@/types/rankings";
import { Skeleton } from "./blocks";
import dk from "@/components/desk/desk.module.css";
import s from "./scout.module.css";

export interface PoolState {
  rows: RankingsPlayer[];
  loading: boolean;
  error: string | null;
  /** The backend's word for an empty pool (before opening night, say). */
  message: string;
}

export interface LedgerProps {
  lens: Lens;
  focus: Focus | null;
  open: (focus: Focus) => void;
  cursor: number;
  setCursor: (i: number) => void;
  /** What the keyboard can walk, in the order shown; the lens's overview is first. */
  onRows: (rows: Focus[]) => void;
  pool: PoolState;
  today: string;
  /** The night the slate is opened on. */
  slateDay: string;
  setSlateDay: (date: string) => void;
}

/** The list beside the sheet: the lens's overview, then its finest items. */
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

/** The first row of every ledger: the lens's own overview. */
function OverviewRow({ lens, focus, cursor, open, overview, note }: { lens: Lens; focus: Focus | null; cursor: number; open: (f: Focus) => void; overview: Focus; note?: string }) {
  const info = lensInfo(lens);
  const on = focus?.kind === "overview" && focus.lens === lens;
  return (
    <button
      type="button"
      role="option"
      aria-selected={on}
      data-cursor={cursor === 0}
      className={`${s.row} ${s.rowOverview} ${on ? s.rowOn : ""} ${cursor === 0 ? s.rowCursor : ""}`}
      onClick={() => open(overview)}
      title={info.overviewNote}
    >
      <LayoutDashboard size={14} />
      <span className={s.rowStack}>
        <span className={s.overviewLabel}>{info.overview}</span>
        <span className={s.rowSub}>{note ?? info.overviewNote}</span>
      </span>
      <span className={dk.kbd}>⏎</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Pool: the ranked players, nothing more
// ---------------------------------------------------------------------------

function PoolLedger({ focus, open, cursor, setCursor, onRows, pool, lens }: LedgerProps) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => (q.trim() ? matchPool(q, pool.rows, pool.rows.length) : pool.rows), [pool.rows, q]);
  const overview: Focus = useMemo(() => ({ kind: "overview", lens: "pool" }), []);
  useEffect(() => onRows([overview, ...rows.map((r) => ({ kind: "player", id: r.id }) as Focus)]), [rows, onRows, overview]);
  const list = useCursorScroll(cursor, lens);
  return (
    <>
      <div className={s.ledgerHead}>
        <input
          className={s.filter}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setCursor(1);
          }}
          placeholder="Filter players — name, team, initials"
          aria-label="Filter the pool"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQ("");
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "Enter") {
              if (cursor === 0) open(overview);
              else if (rows[cursor - 1]) open({ kind: "player", id: rows[cursor - 1].id });
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor(Math.min(rows.length, cursor + 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor(Math.max(0, cursor - 1));
            }
          }}
        />
      </div>
      <div ref={list} className={s.rows} role="listbox" aria-label="Pool">
        <OverviewRow lens="pool" focus={focus} cursor={cursor} open={open} overview={overview} note={pool.rows.length ? `${pool.rows.length} ranked players` : undefined} />
        {pool.loading ? (
          <Skeleton rows={14} className={s.ledgerSkel} />
        ) : pool.error ? (
          <div className={s.ledgerEmpty}>{pool.error}</div>
        ) : rows.length === 0 ? (
          <div className={s.ledgerEmpty}>{pool.rows.length === 0 ? pool.message || "The pool is empty." : `Nobody matches “${q}”.`}</div>
        ) : (
          rows.map((r, i) => {
            const f: Focus = { kind: "player", id: r.id };
            const on = sameFocus(f, focus);
            const idx = i + 1;
            return (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={on}
                data-cursor={idx === cursor}
                className={`${s.row} ${s.rowPool} ${on ? s.rowOn : ""} ${idx === cursor ? s.rowCursor : ""}`}
                onClick={() => {
                  setCursor(idx);
                  open(f);
                }}
                onMouseEnter={() => setCursor(idx)}
              >
                <span className={s.rowRank}>{r.rank}</span>
                <span className={s.rowName} title={r.player_name}>
                  {shortName(r.player_name)}
                </span>
                <span className={s.rowSub}>
                  {r.team}
                  {r.position ? ` ${r.position}` : ""}
                </span>
              </button>
            );
          })
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
  const overview: Focus = useMemo(() => ({ kind: "overview", lens: "teams" }), []);
  useEffect(() => onRows([overview, ...flat.map((t) => ({ kind: "team", abbrev: t.abbrev }) as Focus)]), [flat, onRows, overview]);
  const list = useCursorScroll(cursor, lens);
  let i = 0;
  return (
    <div ref={list} className={s.rows} role="listbox" aria-label="Teams">
      <OverviewRow lens="teams" focus={focus} cursor={cursor} open={open} overview={overview} />
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
                <TeamLogo abbrev={t.abbrev} size={20} />
                <span className={s.teamAbbrev}>{t.abbrev}</span>
                <span className={s.rowName}>{t.name}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slate: nights that open into their matchups
// ---------------------------------------------------------------------------

function SlateLedger({ focus, open, cursor, setCursor, onRows, today, lens, slateDay, setSlateDay }: LedgerProps) {
  const days = useMemo(() => {
    const diff = daysBetween(today, slateDay);
    return slateDates(today, Math.max(3, -diff + 2), Math.max(10, diff + 2));
  }, [today, slateDay]);
  const games = useGamesOnDateQuery(slateDay);
  const overview: Focus = useMemo(() => ({ kind: "overview", lens: "slate" }), []);
  const gameRows = useMemo(() => (games.data?.games ?? []).map((g) => gameFocus(slateDay, g.game_id, g.away_team, g.home_team)), [games.data, slateDay]);
  useEffect(() => onRows([overview, ...gameRows]), [overview, gameRows, onRows]);
  const list = useCursorScroll(cursor, lens);
  return (
    <div ref={list} className={s.rows} role="listbox" aria-label="Nights">
      <OverviewRow lens="slate" focus={focus} cursor={cursor} open={open} overview={overview} />
      <div className={s.group}>
        <span className={dk.label}>Nights</span>
        <span className={dk.sub}>open one for its matchups</span>
      </div>
      {days.map((d) => {
        const expanded = d === slateDay;
        return (
          <div key={d}>
            <button
              type="button"
              className={`${s.row} ${s.rowDay} ${expanded ? s.rowDayOn : ""}`}
              aria-expanded={expanded}
              onClick={() => {
                setSlateDay(d);
                setCursor(0);
              }}
            >
              {expanded ? <ChevronDown size={12} className={dk.chev} /> : <ChevronRight size={12} className={dk.chev} />}
              <span className={s.teamAbbrev} style={{ color: d === today ? "var(--accent)" : undefined }}>
                {dow(d).toUpperCase()}
              </span>
              <span className={s.rowName}>
                {monthDay(d)}
                {Math.abs(daysBetween(today, d)) <= 1 ? <span className={s.rowSub} style={{ marginLeft: 7 }}>{dayName(d, today)}</span> : null}
              </span>
              {expanded ? <span className={s.rowSub}>{games.isLoading ? "…" : `${games.data?.count ?? 0} games`}</span> : <span />}
            </button>
            {expanded ? (
              <div className={s.dayGames}>
                {games.isLoading ? (
                  <div className={s.ledgerEmpty}>loading…</div>
                ) : !games.data || games.data.games.length === 0 ? (
                  <div className={s.ledgerEmpty}>No games this night.</div>
                ) : (
                  games.data.games.map((g, i) => {
                    const f = gameFocus(slateDay, g.game_id, g.away_team, g.home_team);
                    const on = sameFocus(f, focus);
                    const idx = i + 1;
                    const state = gameState(g.status);
                    return (
                      <button
                        key={focusKeyOf(f)}
                        type="button"
                        role="option"
                        aria-selected={on}
                        data-cursor={idx === cursor}
                        className={`${s.row} ${s.rowGame} ${on ? s.rowOn : ""} ${idx === cursor ? s.rowCursor : ""}`}
                        onClick={() => {
                          setCursor(idx);
                          open(f);
                        }}
                        onMouseEnter={() => setCursor(idx)}
                      >
                        <span className={s.gamePair}>
                          <TeamLogo abbrev={g.away_team} size={16} />
                          <span className={s.teamAbbrev}>{g.away_team}</span>
                          <span className={s.dim}>@</span>
                          <TeamLogo abbrev={g.home_team} size={16} />
                          <span className={s.teamAbbrev}>{g.home_team}</span>
                        </span>
                        <span className={`${s.rowSub} ${state === "live" ? s.live : ""}`} style={{ textAlign: "right" }}>
                          {state !== "scheduled" ? `${g.away_score ?? 0}–${g.home_score ?? 0} · ` : ""}
                          {gameStatusText(g.status, g.period, g.game_clock, g.start_time_et)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function focusKeyOf(f: Focus): string {
  return f.kind === "game" ? `${f.date}:${f.gameId}` : f.kind;
}

// ---------------------------------------------------------------------------
// Market: the three lists
// ---------------------------------------------------------------------------

function MarketLedger({ focus, open, cursor, setCursor, onRows, lens }: LedgerProps) {
  const overview: Focus = useMemo(() => ({ kind: "overview", lens: "market" }), []);
  useEffect(() => onRows([overview, ...MARKET_SECTIONS.map((m) => ({ kind: "market", section: m.id }) as Focus)]), [onRows, overview]);
  const list = useCursorScroll(cursor, lens);
  return (
    <div ref={list} className={s.rows} role="listbox" aria-label="Market">
      <OverviewRow lens="market" focus={focus} cursor={cursor} open={open} overview={overview} />
      <div className={s.group}>
        <span className={dk.label}>Lists</span>
      </div>
      {MARKET_SECTIONS.map((m, i) => {
        const f: Focus = { kind: "market", section: m.id };
        const on = sameFocus(f, focus);
        const idx = i + 1;
        return (
          <button
            key={m.id}
            type="button"
            role="option"
            aria-selected={on}
            data-cursor={idx === cursor}
            className={`${s.row} ${s.rowPlain} ${on ? s.rowOn : ""} ${idx === cursor ? s.rowCursor : ""}`}
            onClick={() => {
              setCursor(idx);
              open(f);
            }}
            onMouseEnter={() => setCursor(idx)}
          >
            <span className={s.rowStack}>
              <span style={{ fontWeight: 500 }}>{m.label}</span>
              <span className={s.rowSub}>{m.title}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The pool rows the ledger's filter would keep: shared with the search box. */
export { filterPool };
