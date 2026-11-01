"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, X } from "lucide-react";
import { Headshot } from "@/components/desk/Headshot";
import { usePlayerStatsQuery } from "@/hooks/usePlayer";
import { usePlayerOwnershipQuery } from "@/hooks/usePlayerOwnership";
import { LINE_COLS, averageLine, dow, fmtPct, fmtStat, lastGamesOf, lineFromAvg, sortLogs, windowLabel, monthDay as isoMonthDay, type Window } from "@/lib/scout";
import { userMessage } from "@/lib/api-error";
import type { SourcePlayer, WeekDay } from "@/lib/week-grid";
import { weekSummary, type StatsKind } from "@/lib/player-stats";
import type { GameLog } from "@/types/player";
import { Block, Skeleton, StatTile } from "@/components/scout/blocks";
import { FormChart } from "@/components/scout/PlayerSheet";
import { oppShort, pts, tip } from "./format";
import dk from "@/components/desk/desk.module.css";
import sc from "@/components/scout/scout.module.css";
import s from "./week.module.css";

const WINDOWS: Window[] = ["season", "l5", "l10", "l15"];

export interface PlayerStatsProps {
  player: SourcePlayer;
  kind: StatsKind;
  days: WeekDay[];
  todayIndex: number | null;
  /** Category leagues: fantasy points aren't the measure, so they don't lead. */
  categories: boolean;
  /** Stands beside the market: the market keeps the shadow off it. */
  besideMarket: boolean;
  onClose: () => void;
}

const HINT: Record<StatsKind, string> = {
  mine: "↑ ↓ next on your roster",
  fa: "↑ ↓ next in the market",
  opp: "opponent",
};

/**
 * One player's numbers without leaving the Week desk: his week, per game over
 * a window, form and recent games, with Scout a click away for the rest. A
 * pane at the work area's right edge (left of the market when both are open).
 */
export function PlayerStats({ player, kind, days, todayIndex, categories, besideMarket, onClose }: PlayerStatsProps) {
  const [window, setWindow] = useState<Window>("season");
  // Every Week desk player carries his ESPN id; most also carry nba.com's, which Scout's endpoints key on.
  const id = player.nbaId ?? player.id;
  const idType = player.nbaId ? "nba" : "espn";
  const stats = usePlayerStatsQuery(id, idType, window);
  const season = usePlayerStatsQuery(id, idType, "season");
  const ownership = usePlayerOwnershipQuery(player.nbaId);

  const logs = useMemo(() => sortLogs(season.data?.game_logs ?? stats.data?.game_logs ?? []), [season.data, stats.data]);
  const seasonLine = useMemo(() => (season.data ? lineFromAvg(season.data.avg_stats, season.data.games_played) : averageLine(logs)), [season.data, logs]);
  const line = useMemo(() => {
    if (window === "season") return seasonLine;
    if (stats.data && stats.data.window === window) return lineFromAvg(stats.data.avg_stats, stats.data.window_games);
    return averageLine(lastGamesOf(logs, window));
  }, [window, seasonLine, stats.data, logs]);
  const cols = categories ? LINE_COLS.filter((c) => c.key !== "fpts") : LINE_COLS;

  const loading = stats.isLoading && !stats.data;
  const owned = ownership.data ? `${fmtPct(ownership.data.current_ownership)} owned` : null;
  const injury = player.injury && player.injury !== "ACTIVE" ? player.injury.replace(/_/g, " ").replace("DAY TO DAY", "DTD") : null;

  return (
    <motion.aside
      className={s.statsPane}
      data-beside-market={besideMarket || undefined}
      data-stats-pane
      aria-label={`${player.name}'s stats`}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 38 }}
      onKeyDown={(e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === "Escape" || e.key === "i") {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div className={s.marketHead}>
        <span className={dk.label} style={{ color: "var(--text)" }}>
          Stats
        </span>
        <span className={dk.sub}>{HINT[kind]}</span>
        <span className={dk.spacer} />
        <span className={dk.kbd}>I</span>
        <button type="button" className={dk.iconBtn} onClick={onClose} aria-label="Close the stats" title="Close (I)">
          <X size={14} />
        </button>
      </div>
      <div className={s.statsScroll}>
        <div className={s.statsHead}>
          <Headshot nbaId={player.nbaId} name={player.name} size={48} />
          <span className={s.statsWho}>
            <span className={s.statsName}>{player.name}</span>
            <span className={s.statsMeta}>
              <span>{player.team || (kind === "fa" ? "Free agent" : "Team unknown")}</span>
              {injury ? <span className={`${dk.chip} ${/OUT|INJURY/.test(injury) ? dk.down : dk.warnChip}`}>{injury}</span> : null}
              {owned ? <span>{owned}</span> : null}
            </span>
            {/* Scout opens a player by nba.com id only; without one there is no sheet to link. */}
            {player.nbaId ? (
              <Link href={`/scout?p=${player.nbaId}`} className={s.statsScout} title="His whole sheet on the Scout desk">
                Open in Scout
                <ArrowUpRight size={12} />
              </Link>
            ) : null}
          </span>
          {categories ? null : (
            <span className={s.statsBig}>
              <span className={s.statsBigValue}>{fmtStat(line?.fpts)}</span>
              <span className={dk.label}>
                FPTS/G · {windowLabel(window)}
              </span>
            </span>
          )}
        </div>

        <Block title={kind === "fa" ? "If added now" : "This week"} note={weekNote(player, days, todayIndex, kind)}>
          <WeekStrip player={player} days={days} todayIndex={todayIndex} />
        </Block>

        {loading ? (
          <Skeleton rows={8} />
        ) : stats.error && !stats.data ? (
          <div className={sc.sheetError}>{userMessage(stats.error, "Couldn't load his stats")}</div>
        ) : !stats.data ? (
          <Block title="Per game" note="no games on record">
            <div className={sc.blockEmpty}>No box scores for him yet this season.</div>
          </Block>
        ) : (
          <>
            <Block
              title="Per game"
              note={`${line?.gp ?? 0} games${window !== "season" ? " · vs season" : ""}`}
              right={<WindowRail window={window} setWindow={setWindow} />}
            >
              <div className={s.statsLine}>
                {cols.map((c) => (
                  <StatTile
                    key={c.key}
                    label={c.label}
                    value={line?.[c.key] as number | null}
                    delta={window !== "season" && line && seasonLine && line[c.key] != null && seasonLine[c.key] != null ? (line[c.key] as number) - (seasonLine[c.key] as number) : null}
                    deltaNote=""
                    better={c.better}
                    lead={c.key === "fpts"}
                    digits={c.digits}
                  />
                ))}
              </div>
            </Block>
            <Block title="Form" note={`fantasy points by game · ${logs.length} games`}>
              <div className={s.statsForm}>
                <FormChart logs={logs} window={window} mean={seasonLine?.fpts ?? null} />
              </div>
            </Block>
            <Block title="Recent games" note="newest first">
              <RecentGames logs={logs} count={8} />
            </Block>
          </>
        )}
      </div>
    </motion.aside>
  );
}

function WindowRail({ window, setWindow }: { window: Window; setWindow: (w: Window) => void }) {
  return (
    <div className={dk.rail} role="radiogroup" aria-label="Stat window" style={{ padding: 1 }}>
      {WINDOWS.map((w) => (
        <button key={w} type="button" role="radio" aria-checked={w === window} className={`${dk.seg} ${w === window ? dk.segOn : ""}`} style={{ height: 22, padding: "0 7px", fontSize: 10.5 }} onClick={() => setWindow(w)}>
          {w === window ? <span className={dk.segPill} /> : null}
          <span className={dk.segLabel}>{windowLabel(w)}</span>
        </button>
      ))}
    </div>
  );
}

/** "1 played · 41.5 · 3 games left · 172.5 proj"; a free agent's is only what's left. */
function weekNote(player: SourcePlayer, days: WeekDay[], todayIndex: number | null, kind: StatsKind): string {
  const w = weekSummary(player, days, todayIndex);
  const ahead = `${w.left} game${w.left === 1 ? "" : "s"} left · ${pts(w.projected)} proj`;
  return kind === "fa" || w.played === 0 ? ahead : `${w.played} played · ${pts(w.scored)} · ${ahead}`;
}

/** His games this week, one cell a day: the score once played, the opponent and tip before. */
function WeekStrip({ player, days, todayIndex }: { player: SourcePlayer; days: WeekDay[]; todayIndex: number | null }) {
  return (
    <div className={s.statsWeek}>
      {days.map((d, i) => {
        const g = player.games[i];
        const state = !g ? "none" : g.out ? "out" : g.status;
        return (
          <div key={d.date} className={s.statsDay} data-state={state} data-today={i === todayIndex}>
            <span className={s.statsDow}>{d.dow.toUpperCase()}</span>
            <span className={s.statsOpp}>{g ? oppShort(g.opp) || "game" : "·"}</span>
            <span className={s.statsVal}>{!g ? "" : g.out ? "OUT" : g.status === "scheduled" ? tip(g.time) : pts(g.fpts)}</span>
          </div>
        );
      })}
    </div>
  );
}

function RecentGames({ logs, count }: { logs: GameLog[]; count: number }) {
  const recent = [...logs].reverse().slice(0, count);
  if (!recent.length) return <div className={sc.blockEmpty}>No games yet.</div>;
  return (
    <table className={`${sc.table} ${s.statsTable}`}>
      <thead>
        <tr>
          <th className={sc.text}>DATE</th>
          <th className={sc.text}>OPP</th>
          <th>MIN</th>
          <th>PTS</th>
          <th>REB</th>
          <th>AST</th>
          <th>STL</th>
          <th>BLK</th>
          <th>TO</th>
          <th>FPTS</th>
        </tr>
      </thead>
      <tbody>
        {recent.map((g, i) => (
          <tr key={`${g.date}-${i}`}>
            <td className={sc.text}>
              {dow(g.date)} {isoMonthDay(g.date)}
            </td>
            <td className={sc.text}>
              <span className={sc.muted}>{g.home === false ? "@" : "vs"}</span> {g.opponent ?? "—"}
            </td>
            <td>{g.min}</td>
            <td>{g.pts}</td>
            <td>{g.reb}</td>
            <td>{g.ast}</td>
            <td>{g.stl}</td>
            <td>{g.blk}</td>
            <td>{g.tov}</td>
            <td className={sc.strong}>{g.fpts.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
