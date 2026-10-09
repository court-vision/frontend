"use client";

import { useEffect, useMemo, useState } from "react";
import { Columns3, Pin, PinOff, Shield } from "lucide-react";
import { Headshot } from "@/components/desk/Headshot";
import { TeamLogo } from "@/components/desk/TeamLogo";
import { usePlayerPercentilesQuery, usePlayerStatsQuery } from "@/hooks/usePlayer";
import { usePlayerOwnershipQuery } from "@/hooks/usePlayerOwnership";
import { usePlayerStatusQuery } from "@/hooks/usePlayerStatus";
import { useEspnMarketLineQuery, usePlayerProfileQuery, usePlayerProjectionQuery, usePlayerTrendsQuery } from "@/hooks/useScout";
import { useTeamScheduleQuery } from "@/hooks/useTeamSchedule";
import { formatCategoryValue } from "@/lib/category-format";
import { userMessage } from "@/lib/api-error";
import {
  LINE_COLS,
  ageOn,
  averageLine,
  bestOf,
  deltaSign,
  dow,
  fmtDelta,
  fmtPct,
  fmtStat,
  gameFocus,
  lastGamesOf,
  lineFromAvg,
  monthDay,
  periodName,
  clockText,
  sortLogs,
  splitLines,
  windowLabel,
  type Focus,
  type StatLine,
  type Window,
  projectionRows,
  teamInfo,
} from "@/lib/scout";
import { windowGames } from "@/lib/statWindow";
import type { GameLog, PercentileData, PlayerStats } from "@/types/player";
import type { RankingsPlayer } from "@/types/rankings";
import type { CategoryDef } from "@/types/scoring";
import type { LivePlayerData } from "@/types/live";
import { Block, KV, MoveChip, PercentBar, Skeleton, StatTile, StatusChip, ZBar, useSettled, type KVItem } from "./blocks";
import dk from "@/components/desk/desk.module.css";
import s from "./scout.module.css";

export interface PlayerSheetProps {
  id: number;
  window: Window;
  setWindow: (w: Window) => void;
  poolRow: RankingsPlayer | undefined;
  categories: CategoryDef[];
  today: string;
  open: (focus: Focus) => void;
  pinned: boolean;
  togglePin: () => void;
  canCompare: boolean;
  onCompare: () => void;
  live: LivePlayerData | undefined;
  /** Tell the page the player's name and team once known, for chips and the G key. */
  onIdentity: (identity: { id: number; name: string; team: string | null }) => void;
}

const PCT_KEYS: Array<{ key: keyof StatLine; pct: keyof PercentileData; label: string }> = [
  { key: "fpts", pct: "avg_fpts", label: "FPTS" },
  { key: "min", pct: "avg_minutes", label: "MIN" },
  { key: "pts", pct: "avg_points", label: "PTS" },
  { key: "reb", pct: "avg_rebounds", label: "REB" },
  { key: "ast", pct: "avg_assists", label: "AST" },
  { key: "stl", pct: "avg_steals", label: "STL" },
  { key: "blk", pct: "avg_blocks", label: "BLK" },
  { key: "tov", pct: "avg_turnovers", label: "TO" },
  { key: "fg3m", pct: "avg_fg3m", label: "3PM" },
  { key: "fgPct", pct: "avg_fg_pct", label: "FG%" },
  { key: "ftPct", pct: "avg_ft_pct", label: "FT%" },
  { key: "fg3Pct", pct: "avg_fg3_pct", label: "3P%" },
];

function heightText(h: string | null | undefined): string | null {
  if (!h) return null;
  const m = /^(\d+)-(\d+)$/.exec(h);
  return m ? `${m[1]}′${m[2]}″` : h;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function PlayerSheet(props: PlayerSheetProps) {
  const { id, window, setWindow, poolRow, categories, today, open, pinned, togglePin, canCompare, onCompare, live, onIdentity } = props;
  const stats = usePlayerStatsQuery(id, "nba", window);
  const season = usePlayerStatsQuery(id, "nba", "season");
  const percentiles = usePlayerPercentilesQuery(id);
  const status = usePlayerStatusQuery(id);
  const ownership = usePlayerOwnershipQuery(id);
  // The extras wait until the sheet has rested on this player: flipping through the pool costs four requests, not nine.
  const settled = useSettled(id);
  const profile = usePlayerProfileQuery(id, settled);
  const trends = usePlayerTrendsQuery(id, settled);
  const projection = usePlayerProjectionQuery(id, settled);
  const name = stats.data?.name ?? profile.data?.name ?? poolRow?.player_name ?? null;
  const team = stats.data?.team ?? profile.data?.profile?.team ?? poolRow?.team ?? null;
  const market = useEspnMarketLineQuery(name, id, settled);
  const schedule = useTeamScheduleQuery(settled ? team : null, true, 7);

  useEffect(() => {
    if (name) onIdentity({ id, name, team });
  }, [id, name, team, onIdentity]);

  const logs = useMemo(() => sortLogs(season.data?.game_logs ?? stats.data?.game_logs ?? []), [season.data, stats.data]);
  const splits = useMemo(() => splitLines(logs), [logs]);
  const seasonLine = useMemo(() => (season.data ? lineFromAvg(season.data.avg_stats, season.data.games_played) : averageLine(logs)), [season.data, logs]);
  const windowLine = useMemo(() => {
    if (window === "season") return seasonLine;
    if (stats.data && stats.data.window === window) return lineFromAvg(stats.data.avg_stats, stats.data.window_games);
    return averageLine(lastGamesOf(logs, window));
  }, [window, seasonLine, stats.data, logs]);
  const position = profile.data?.profile?.position ?? profile.data?.position ?? poolRow?.position ?? null;
  const prof = profile.data?.profile ?? null;
  const age = ageOn(prof?.birthdate, today);
  const info = teamInfo(team);

  if (stats.isLoading && !stats.data) return <Skeleton rows={9} />;
  if (stats.error && !stats.data) return <div className={s.sheetError}>{userMessage(stats.error, "Couldn't load this player")}</div>;

  const noStats = !stats.data;

  return (
    <div className={s.sheetInner}>
      <header className={s.head}>
        <Headshot nbaId={id} name={name ?? ""} size={64} />
        <div className={s.headBody}>
          <div className={s.headName}>
            <span>{name ?? "Unknown player"}</span>
            {poolRow ? (
              <span className={s.inline}>
                <span className={`${dk.chip} ${dk.flat}`} title="Rank in the pool">
                  #{poolRow.rank}
                </span>
                <MoveChip change={poolRow.rank_change} />
              </span>
            ) : null}
          </div>
          <div className={s.headMeta}>
            {team ? (
              <button type="button" className={`${s.linkBtn} ${s.inline}`} onClick={() => open({ kind: "team", abbrev: team })} title={`${info?.name ?? team} (G)`}>
                <TeamLogo abbrev={team} size={16} />
                {info?.name ?? team}
              </button>
            ) : (
              <span>Free agent</span>
            )}
            {position ? (
              <>
                <span className={s.dot}>·</span>
                <span>{position}</span>
              </>
            ) : null}
            {prof?.jersey_number ? (
              <>
                <span className={s.dot}>·</span>
                <span>#{prof.jersey_number}</span>
              </>
            ) : null}
            {heightText(prof?.height) ? (
              <>
                <span className={s.dot}>·</span>
                <span>{heightText(prof?.height)}</span>
              </>
            ) : null}
            {prof?.weight ? (
              <>
                <span className={s.dot}>·</span>
                <span>{prof.weight} lb</span>
              </>
            ) : null}
            {age != null ? (
              <>
                <span className={s.dot}>·</span>
                <span>{age}y</span>
              </>
            ) : null}
            {prof?.season_exp != null ? (
              <>
                <span className={s.dot}>·</span>
                <span>{prof.season_exp === 0 ? "rookie" : `${ordinal(prof.season_exp + 1)} season`}</span>
              </>
            ) : null}
          </div>
          <div className={s.headChips}>
            <StatusChip status={status.data} detail />
            {ownership.data ? (
              <span className={`${dk.chip} ${dk.flat}`} title={`ESPN ownership · ${ownership.data.snapshot_date}`}>
                {fmtPct(ownership.data.current_ownership)} owned
                {ownership.data.change != null && Math.abs(ownership.data.change) >= 0.05 ? (
                  <span style={{ marginLeft: 6, color: ownership.data.change > 0 ? "var(--up)" : "var(--down)" }}>{fmtDelta(ownership.data.change)}</span>
                ) : null}
              </span>
            ) : null}
            {market.data ? (
              <span className={`${dk.chip} ${dk.flat}`} title="ESPN draft market: editorial rank · ADP · auction value">
                ESPN {market.data.overall_rank != null ? `#${market.data.overall_rank}` : "—"}
                {market.data.adp != null ? ` · ADP ${market.data.adp.toFixed(1)}` : ""}
                {market.data.auction_value != null ? ` · $${Math.round(market.data.auction_value)}` : ""}
              </span>
            ) : null}
            {live ? (
              <span className={`${dk.chip} ${dk.up}`}>
                <span className={dk.liveDot} style={{ marginRight: 6 }} />
                {live.game_status >= 3 ? "Final" : `${periodName(live.period)} ${clockText(live.game_clock)}`} · {live.fpts.toFixed(1)} fpts
              </span>
            ) : null}
          </div>
        </div>
        <div className={s.headBig}>
          <span className={s.headBigValue}>{fmtStat(windowLine?.fpts)}</span>
          <span className={dk.label}>
            FPTS / G · {windowLabel(window)}
            {windowLine ? ` · ${windowLine.gp} GP` : ""}
          </span>
          <div className={s.headActions} style={{ marginTop: 8 }}>
            <button type="button" className={`${dk.btn} ${dk.btnSmall} ${pinned ? dk.toggleOn : ""}`} onClick={togglePin} title="Keep on the bench (P)">
              {pinned ? <PinOff size={12} /> : <Pin size={12} />}
              {pinned ? "Pinned" : "Pin"}
              <span className={dk.kbd}>P</span>
            </button>
            <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={onCompare} disabled={!canCompare} title="Pinned players side by side (C)">
              <Columns3 size={12} />
              Compare
            </button>
            {team ? (
              <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => open({ kind: "team", abbrev: team })} title="His team's sheet (G)">
                <Shield size={12} />
                {team}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {live ? (
        <Block title="On the floor" note={live.game_status >= 3 ? "final" : `${periodName(live.period)} ${clockText(live.game_clock)}`} right={<span className={`${s.live} ${dk.sub}`}>live</span>}>
          <div className={s.line}>
            <StatTile label="FPTS" value={live.fpts} lead />
            <StatTile label="MIN" value={live.min} digits={0} />
            <StatTile label="PTS" value={live.pts} digits={0} />
            <StatTile label="REB" value={live.reb} digits={0} />
            <StatTile label="AST" value={live.ast} digits={0} />
            <StatTile label="STL" value={live.stl} digits={0} />
            <StatTile label="BLK" value={live.blk} digits={0} />
            <StatTile label="TO" value={live.tov} digits={0} />
            <StatTile label="3PM" value={live.fg3m} digits={0} />
            <StatTile label="FG" value={null} />
          </div>
        </Block>
      ) : null}

      {noStats ? (
        <Block title="Per game" note="no games on record">
          <div className={s.blockEmpty}>No box scores for this player yet. The profile and ESPN&apos;s projection below are all there is.</div>
        </Block>
      ) : (
        <>
          <Block
            title="Per game"
            note={`${windowLabel(window)} · ${windowLine?.gp ?? 0} games${window !== "season" ? " · change vs season" : ""}`}
            right={<WindowRail window={window} setWindow={setWindow} />}
          >
            <div className={s.line}>
              {LINE_COLS.map((c) => (
                <StatTile
                  key={c.key}
                  label={c.label}
                  value={windowLine?.[c.key] as number | null}
                  delta={window !== "season" && windowLine && seasonLine && windowLine[c.key] != null && seasonLine[c.key] != null ? (windowLine[c.key] as number) - (seasonLine[c.key] as number) : null}
                  better={c.better}
                  lead={c.key === "fpts"}
                  digits={c.digits}
                />
              ))}
            </div>
          </Block>

          <Block
            title="Form"
            note={`fantasy points by game · ${logs.length} games`}
            right={
              trends.data ? (
                <span className={dk.sub} title="Rolling calendar windows">
                  {(["last_7_days", "last_14_days", "last_30_days"] as const)
                    .map((k) => {
                      const t = trends.data?.trends?.[k];
                      return t ? `${k.replace("last_", "").replace("_days", "d")} ${t.avg_fpts.toFixed(1)}` : null;
                    })
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              ) : null
            }
          >
            <FormChart logs={logs} window={window} mean={seasonLine?.fpts ?? null} />
          </Block>

          <Block title="Splits" note="per game · click a row to set the window">
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>WINDOW</th>
                    <th>GP</th>
                    {LINE_COLS.map((c) => (
                      <th key={c.key}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {splits.map((sp) => (
                    <tr key={sp.window} className={`${s.click} ${sp.window === window ? s.on : ""}`} onClick={() => setWindow(sp.window)}>
                      <td className={s.text}>{sp.label}</td>
                      <td>{sp.line?.gp ?? "—"}</td>
                      {LINE_COLS.map((c) => (
                        <td key={c.key} className={c.key === "fpts" ? s.strong : ""}>
                          {fmtStat(sp.line?.[c.key] as number | null, c.digits)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Block>

          <div className={s.two}>
            <Block title="Vs the league" note={percentiles.data ? "season percentile · 20+ games" : undefined}>
              {percentiles.data ? (
                <div className={s.bars}>
                  {PCT_KEYS.filter((k) => percentiles.data?.[k.pct] != null).map((k) => (
                    <PercentBar key={k.key} label={k.label} value={seasonLine?.[k.key] as number | null} pct={percentiles.data?.[k.pct] as number} />
                  ))}
                </div>
              ) : percentiles.isLoading ? (
                <Skeleton rows={5} className={s.ledgerSkel} />
              ) : (
                <div className={s.blockEmpty}>Percentiles need 20 games this season.</div>
              )}
            </Block>
            {poolRow?.category_z ? (
              <Block title="Category profile" note="z-score in the pool · TO inverted">
                <div className={s.bars} style={{ gridTemplateColumns: "1fr" }}>
                  {categories.map((c) => {
                    const z = poolRow.category_z?.[c.key];
                    if (z == null) return null;
                    return <ZBar key={c.key} label={c.label} z={z} value={formatCategoryValue(poolRow.categories?.[c.key] ?? null, c)} />;
                  })}
                </div>
              </Block>
            ) : (
              <Block title="Shooting" note="season">
                <KV
                  items={[
                    { k: "TS%", v: fmtStat(season.data?.avg_stats.avg_ts_pct) },
                    { k: "eFG%", v: fmtStat(season.data?.avg_stats.avg_efg_pct) },
                    { k: "3P%", v: fmtStat(seasonLine?.fg3Pct) },
                    { k: "3PA rate", v: fmtStat(season.data?.avg_stats.avg_three_rate) },
                    { k: "FT rate", v: fmtStat(season.data?.avg_stats.avg_ft_rate) },
                    { k: "FGA", v: fmtStat(seasonLine?.fga) },
                    { k: "3PA", v: fmtStat(season.data?.avg_stats.avg_fg3a) },
                    { k: "FTA", v: fmtStat(seasonLine?.fta) },
                  ]}
                />
              </Block>
            )}
          </div>

          <Block title="Advanced" note="season · nba.com ratings">
            {stats.data?.advanced_stats ? (
              <KV items={advancedItems(stats.data)} />
            ) : (
              <div className={s.blockEmpty}>No advanced line on record.</div>
            )}
          </Block>
        </>
      )}

      <div className={s.two}>
        <Block title="Projection vs actual" note={projection.data ? `ESPN preseason · as of ${projection.data.as_of_date}${projection.data.projected_gp ? ` · ${projection.data.projected_gp} GP` : ""}` : undefined}>
          {projection.data ? (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>STAT</th>
                  <th>PROJ</th>
                  <th>ACTUAL</th>
                  <th>Δ</th>
                </tr>
              </thead>
              <tbody>
                {projectionRows(projection.data.stats, seasonLine).map((r) => {
                  const sign = deltaSign(r.delta, r.better);
                  return (
                    <tr key={r.key}>
                      <td className={s.text}>{r.label}</td>
                      <td>{fmtStat(r.projected, r.digits)}</td>
                      <td className={s.strong}>{fmtStat(r.actual, r.digits)}</td>
                      <td className={sign === "up" ? s.best : sign === "down" ? s.worst : ""}>{fmtDelta(r.delta, r.digits)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : projection.isLoading || !settled ? (
            <Skeleton rows={5} className={s.ledgerSkel} />
          ) : (
            <div className={s.blockEmpty}>No ESPN projection for this season.</div>
          )}
        </Block>
        <Block title="Profile" note={prof ? `as of ${prof.updated_at.slice(0, 10)}` : undefined}>
          {prof ? (
            <KV items={profileItems(prof, age)} />
          ) : profile.isLoading || !settled ? (
            <Skeleton rows={4} className={s.ledgerSkel} />
          ) : (
            <div className={s.blockEmpty}>No profile on record yet.</div>
          )}
        </Block>
      </div>

      <div className={s.two}>
        <Block title="Next up" note={team ? `${team} · next ${schedule.data?.schedule.length ?? 7}` : undefined}>
          {schedule.data?.schedule.length ? (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>DAY</th>
                  <th className={s.text}>OPP</th>
                  <th>B2B</th>
                  <th>OPP DEF</th>
                </tr>
              </thead>
              <tbody>
                {schedule.data.schedule.map((g) => (
                  <tr key={g.date} className={s.click} onClick={() => open(gameFocus(g.date, null, g.home ? g.opponent : team ?? "", g.home ? team ?? "" : g.opponent))}>
                    <td className={s.text}>
                      {dow(g.date)} {monthDay(g.date)}
                    </td>
                    <td className={s.text}>
                      <span className={s.muted}>{g.home ? "vs" : "@"}</span> {g.opponent}
                    </td>
                    <td>{g.back_to_back ? "B2B" : ""}</td>
                    <td>{g.opponent_def_rating != null ? g.opponent_def_rating.toFixed(1) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : schedule.isLoading || !settled ? (
            <Skeleton rows={4} className={s.ledgerSkel} />
          ) : (
            <div className={s.blockEmpty}>{team ? "No games ahead on the schedule." : "No team, no schedule."}</div>
          )}
        </Block>
        <Block title="Trend" note="rolling calendar windows">
          {trends.data ? (
            <KV
              items={[
                ...(["last_7_days", "last_14_days", "last_30_days"] as const).map((k) => {
                  const t = trends.data?.trends?.[k];
                  return { k: k.replace("last_", "L").replace("_days", "D"), v: t ? `${t.avg_fpts.toFixed(1)}` : "—", title: t ? `${t.games} games` : undefined };
                }),
                { k: "Own 7d", v: trends.data.ownership ? fmtDelta(trends.data.ownership.change_7d) : "—", sign: trends.data.ownership ? deltaSign(trends.data.ownership.change_7d, "high") : null },
                { k: "Rank", v: trends.data.current_rank != null ? `#${trends.data.current_rank}` : "—" },
              ]}
            />
          ) : trends.isLoading || !settled ? (
            <Skeleton rows={3} className={s.ledgerSkel} />
          ) : (
            <div className={s.blockEmpty}>No trend data.</div>
          )}
        </Block>
      </div>

      {logs.length ? (
        <Block title="Game log" note={`newest first · ${windowLabel(window)} games in white`}>
          <div className={s.tableWrap}>
            <GameLogTable logs={logs} window={window} open={open} team={team} />
          </div>
        </Block>
      ) : null}
    </div>
  );
}

function WindowRail({ window, setWindow }: { window: Window; setWindow: (w: Window) => void }) {
  return (
    <div className={dk.rail} role="radiogroup" aria-label="Stat window" style={{ padding: 1 }}>
      {(["season", "l5", "l10", "l15", "l30"] as const).map((w) => (
        <button key={w} type="button" role="radio" aria-checked={w === window} className={`${dk.seg} ${w === window ? dk.segOn : ""}`} style={{ height: 22, padding: "0 7px", fontSize: 10.5 }} onClick={() => setWindow(w)}>
          {w === window ? <span className={dk.segPill} /> : null}
          <span className={dk.segLabel}>{windowLabel(w)}</span>
        </button>
      ))}
      <span className={dk.kbd} style={{ marginLeft: 4 }}>
        W
      </span>
    </div>
  );
}

function advancedItems(p: PlayerStats): KVItem[] {
  const a = p.advanced_stats!;
  const sign = (v: number | null | undefined) => (v == null ? null : v > 0 ? "up" : v < 0 ? "down" : null);
  return [
    { k: "Net rtg", v: fmtDelta(a.net_rating), sign: sign(a.net_rating) },
    { k: "Off rtg", v: fmtStat(a.off_rating) },
    { k: "Def rtg", v: fmtStat(a.def_rating) },
    { k: "USG%", v: fmtStat(a.usg_pct) },
    { k: "AST%", v: fmtStat(a.ast_pct) },
    { k: "A/TO", v: fmtStat(a.ast_to_tov, 2) },
    { k: "REB%", v: fmtStat(a.reb_pct) },
    { k: "OREB%", v: fmtStat(a.oreb_pct) },
    { k: "DREB%", v: fmtStat(a.dreb_pct) },
    { k: "TOV%", v: fmtStat(a.tov_pct) },
    { k: "PIE", v: fmtStat(a.pie) },
    { k: "Pace", v: fmtStat(a.pace) },
    { k: "+/−", v: fmtDelta(a.plus_minus), sign: sign(a.plus_minus) },
    { k: "TS%", v: fmtStat(p.avg_stats.avg_ts_pct) },
    { k: "eFG%", v: fmtStat(p.avg_stats.avg_efg_pct) },
  ];
}

function profileItems(prof: NonNullable<import("@/types/scout").PlayerProfileDetails>, age: number | null): KVItem[] {
  const draft =
    prof.draft_year != null
      ? prof.draft_round != null && prof.draft_number != null
        ? `${prof.draft_year} · R${prof.draft_round} #${prof.draft_number}`
        : `${prof.draft_year} · undrafted`
      : "—";
  return [
    { k: "Height", v: heightText(prof.height) ?? "—" },
    { k: "Weight", v: prof.weight != null ? `${prof.weight} lb` : "—" },
    { k: "Age", v: age != null ? `${age}` : "—", title: prof.birthdate ?? undefined },
    { k: "Born", v: prof.birthdate ?? "—" },
    { k: "Draft", v: draft, text: true },
    { k: "Experience", v: prof.season_exp != null ? `${prof.season_exp} yr` : "—" },
    { k: "School", v: prof.school ?? "—", text: true },
    { k: "Country", v: prof.country ?? "—", text: true },
    { k: "Jersey", v: prof.jersey_number ? `#${prof.jersey_number}` : "—" },
    { k: "Years", v: prof.from_year != null && prof.to_year != null ? `${prof.from_year}–${String(prof.to_year).slice(2)}` : "—" },
  ];
}

// ---------------------------------------------------------------------------
// Form chart
// ---------------------------------------------------------------------------

function FormChart({ logs, window, mean }: { logs: GameLog[]; window: Window; mean: number | null }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = logs.length;
  const inWindow = useMemo(() => {
    const k = windowGames(window);
    return k === null ? 0 : Math.max(0, n - k);
  }, [window, n]);
  if (n === 0) return <div className={s.blockEmpty}>No games.</div>;
  const W = 1000;
  const H = 120;
  const max = Math.max(1, ...logs.map((g) => g.fpts), mean ?? 0);
  const slot = W / n;
  const gap = Math.min(3, slot * 0.25);
  const y = (v: number) => H - (Math.max(0, v) / max) * (H - 4);
  const g = hover != null ? logs[hover] : logs[n - 1];
  const best = bestOf(
    logs.map((l) => l.fpts),
    "high"
  );
  return (
    <>
      <svg className={s.chart} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onMouseLeave={() => setHover(null)} aria-label="Fantasy points by game">
        {logs.map((l, i) => (
          <rect
            key={`${l.date}-${i}`}
            className={s.chartBar}
            data-in={i >= inWindow}
            x={i * slot + gap / 2}
            y={y(l.fpts)}
            width={Math.max(1, slot - gap)}
            height={H - y(l.fpts)}
            onMouseEnter={() => setHover(i)}
            opacity={hover != null && hover !== i ? 0.55 : 1}
          />
        ))}
        {mean != null ? <line className={s.chartMean} x1={0} x2={W} y1={y(mean)} y2={y(mean)} vectorEffect="non-scaling-stroke" /> : null}
      </svg>
      <div className={s.chartHover}>
        {g ? (
          <>
            <span style={{ color: "var(--text)" }}>
              {dow(g.date)} {monthDay(g.date)}
            </span>
            <span>
              {g.home === false ? "@" : "vs"} {g.opponent ?? "—"}
            </span>
            <span style={{ color: best.has(hover ?? n - 1) ? "var(--up)" : "var(--text)" }}>{g.fpts.toFixed(1)} fpts</span>
            <span>
              {g.min} min · {g.pts} pts · {g.reb} reb · {g.ast} ast · {g.stl} stl · {g.blk} blk · {g.tov} to · {g.fg3m} 3pm · {g.fgm}/{g.fga} fg · {g.ftm}/{g.fta} ft
            </span>
          </>
        ) : null}
        <span className={dk.spacer} />
        {mean != null ? <span>season mean {mean.toFixed(1)}</span> : null}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Game log
// ---------------------------------------------------------------------------

function GameLogTable({ logs, window, open, team }: { logs: GameLog[]; window: Window; open: (f: Focus) => void; team: string | null }) {
  const k = windowGames(window);
  const from = k === null ? 0 : Math.max(0, logs.length - k);
  const newest = [...logs].reverse();
  return (
    <table className={s.table}>
      <thead>
        <tr>
          <th>DATE</th>
          <th className={s.text}>OPP</th>
          <th>MIN</th>
          <th>PTS</th>
          <th>REB</th>
          <th>AST</th>
          <th>STL</th>
          <th>BLK</th>
          <th>TO</th>
          <th>3PM</th>
          <th>FG</th>
          <th>FT</th>
          <th>FPTS</th>
        </tr>
      </thead>
      <tbody>
        {newest.map((g, i) => {
          const idx = logs.length - 1 - i;
          return (
            <tr key={`${g.date}-${g.game_id ?? i}`} className={`${s.click} ${idx >= from ? s.inWindow : ""}`} onClick={() => open(gameFocus(g.date, g.game_id, g.home === false ? team ?? "" : g.opponent ?? "", g.home === false ? g.opponent ?? "" : team ?? ""))}>
              <td className={s.text}>
                {dow(g.date)} {monthDay(g.date)}
              </td>
              <td className={s.text}>
                <span className={s.muted}>{g.home === false ? "@" : "vs"}</span> {g.opponent ?? "—"}
              </td>
              <td>{g.min}</td>
              <td>{g.pts}</td>
              <td>{g.reb}</td>
              <td>{g.ast}</td>
              <td>{g.stl}</td>
              <td>{g.blk}</td>
              <td>{g.tov}</td>
              <td>{g.fg3m}</td>
              <td>
                {g.fgm}/{g.fga}
              </td>
              <td>
                {g.ftm}/{g.fta}
              </td>
              <td className={s.strong}>{g.fpts.toFixed(1)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

