"use client";

import { useMemo, useState } from "react";
import { Pin, PinOff } from "lucide-react";
import { Headshot } from "@/components/desk/Headshot";
import { useNBATeamLiveGameQuery, useNBATeamRosterQuery, useNBATeamStatsQuery } from "@/hooks/useNBATeam";
import { useTeamScheduleQuery } from "@/hooks/useTeamSchedule";
import { userMessage } from "@/lib/api-error";
import { asPercent, dow, fmtDelta, fmtStat, gameState, gameStatusText, monthDay, teamInfo, type Focus } from "@/lib/scout";
import type { NBATeamRosterPlayer } from "@/types/nba-team";
import type { NBATeamLiveGameData, TopPerformer } from "@/types/games";
import { Block, KV, Skeleton, StatTile } from "./blocks";
import dk from "@/components/desk/desk.module.css";
import s from "./scout.module.css";

export interface TeamSheetProps {
  abbrev: string;
  today: string;
  open: (focus: Focus) => void;
  pinned: boolean;
  togglePin: () => void;
}

type RosterSort = keyof Pick<NBATeamRosterPlayer, "fpts" | "pts" | "reb" | "ast" | "stl" | "blk" | "tov" | "gp" | "name">;

export function TeamSheet({ abbrev, today, open, pinned, togglePin }: TeamSheetProps) {
  const info = teamInfo(abbrev);
  const stats = useNBATeamStatsQuery(abbrev);
  const roster = useNBATeamRosterQuery(abbrev);
  const game = useNBATeamLiveGameQuery(abbrev);
  const schedule = useTeamScheduleQuery(abbrev, false, 82);
  const [sort, setSort] = useState<RosterSort>("fpts");

  const players = useMemo(() => {
    const list = [...(roster.data?.players ?? [])];
    if (sort === "name") return list.sort((a, b) => a.name.localeCompare(b.name));
    return list.sort((a, b) => (b[sort] ?? 0) - (a[sort] ?? 0));
  }, [roster.data, sort]);

  const { played, ahead } = useMemo(() => {
    const games = schedule.data?.schedule ?? [];
    const done = games.filter((g) => gameState(g.status) === "final");
    const next = games.filter((g) => gameState(g.status) !== "final");
    return { played: done.slice(-10).reverse(), ahead: next.slice(0, 10) };
  }, [schedule.data]);

  if (stats.isLoading && !stats.data) return <Skeleton rows={8} />;
  if (stats.error && !stats.data) return <div className={s.sheetError}>{userMessage(stats.error, "Couldn't load this team")}</div>;
  const t = stats.data;
  const record = t && t.w != null && t.l != null ? `${t.w}–${t.l}` : null;
  const net = t?.net_rating ?? null;

  return (
    <div className={s.sheetInner}>
      <header className={s.head}>
        <span className={s.benchMark} style={{ width: 64, height: 64, fontSize: 18, letterSpacing: "0.06em" }} aria-hidden>
          {abbrev}
        </span>
        <div className={s.headBody}>
          <div className={s.headName}>
            <span>{t?.team_name ?? info?.name ?? abbrev}</span>
          </div>
          <div className={s.headMeta}>
            <span>{abbrev}</span>
            {t?.conference || info ? (
              <>
                <span className={s.dot}>·</span>
                <span>{t?.conference ?? info?.conference}</span>
              </>
            ) : null}
            {t?.division || info ? (
              <>
                <span className={s.dot}>·</span>
                <span>{t?.division ?? info?.division}</span>
              </>
            ) : null}
            {t?.season ? (
              <>
                <span className={s.dot}>·</span>
                <span>{t.season}</span>
              </>
            ) : null}
            {t?.as_of_date ? (
              <>
                <span className={s.dot}>·</span>
                <span className={s.muted}>as of {t.as_of_date}</span>
              </>
            ) : null}
          </div>
          <div className={s.headChips}>
            {net != null ? (
              <span className={`${dk.chip} ${net > 0.05 ? dk.up : net < -0.05 ? dk.down : dk.flat}`} title="Net rating">
                NET {fmtDelta(net)}
              </span>
            ) : null}
            {t?.w_pct != null ? <span className={`${dk.chip} ${dk.flat}`}>{(t.w_pct > 1 ? t.w_pct : t.w_pct * 100).toFixed(1)}% won</span> : null}
            {game.data && gameState(game.data.status) === "live" ? (
              <span className={`${dk.chip} ${dk.up}`}>
                <span className={dk.liveDot} style={{ marginRight: 6 }} />
                live now
              </span>
            ) : null}
          </div>
        </div>
        <div className={s.headBig}>
          <span className={s.headBigValue}>{record ?? "—"}</span>
          <span className={dk.label}>record{t?.gp != null ? ` · ${t.gp} GP` : ""}</span>
          <div className={s.headActions} style={{ marginTop: 8 }}>
            <button type="button" className={`${dk.btn} ${dk.btnSmall} ${pinned ? dk.toggleOn : ""}`} onClick={togglePin} title="Keep on the bench (P)">
              {pinned ? <PinOff size={12} /> : <Pin size={12} />}
              {pinned ? "Pinned" : "Pin"}
              <span className={dk.kbd}>P</span>
            </button>
          </div>
        </div>
      </header>

      {game.data ? <GameBlock game={game.data} abbrev={abbrev} open={open} today={today} /> : null}

      <div className={s.two}>
        <Block title="Ratings" note="per 100 possessions">
          {t ? (
            <KV
              items={[
                { k: "Off rtg", v: fmtStat(t.off_rating) },
                { k: "Def rtg", v: fmtStat(t.def_rating) },
                { k: "Net rtg", v: fmtDelta(t.net_rating), sign: net == null ? null : net > 0 ? "up" : net < 0 ? "down" : null },
                { k: "Pace", v: fmtStat(t.pace) },
                { k: "TS%", v: fmtStat(asPercent(t.ts_pct)) },
                { k: "eFG%", v: fmtStat(asPercent(t.efg_pct)) },
                { k: "PIE", v: fmtStat(asPercent(t.pie)) },
              ]}
            />
          ) : (
            <div className={s.blockEmpty}>No team line yet.</div>
          )}
        </Block>
        <Block title="Per game" note="team totals">
          {t ? (
            <div className={s.line}>
              <StatTile label="PTS" value={t.pts} />
              <StatTile label="REB" value={t.reb} />
              <StatTile label="AST" value={t.ast} />
              <StatTile label="STL" value={t.stl} />
              <StatTile label="BLK" value={t.blk} />
              <StatTile label="TO" value={t.tov} better="low" />
              <StatTile label="FG%" value={asPercent(t.fg_pct)} />
              <StatTile label="3P%" value={asPercent(t.fg3_pct)} />
              <StatTile label="FT%" value={asPercent(t.ft_pct)} />
            </div>
          ) : (
            <div className={s.blockEmpty}>No team line yet.</div>
          )}
        </Block>
      </div>

      <Block title="Roster" note={roster.data ? `${roster.data.players.length} players · per game · as of ${roster.data.as_of_date}` : undefined}>
        {roster.isLoading ? (
          <Skeleton rows={6} className={s.ledgerSkel} />
        ) : players.length === 0 ? (
          <div className={s.blockEmpty}>No roster on record.</div>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>
                    <SortBtn k="name" sort={sort} setSort={setSort} label="PLAYER" />
                  </th>
                  <th>POS</th>
                  <th>
                    <SortBtn k="gp" sort={sort} setSort={setSort} label="GP" />
                  </th>
                  <th>
                    <SortBtn k="pts" sort={sort} setSort={setSort} label="PTS" />
                  </th>
                  <th>
                    <SortBtn k="reb" sort={sort} setSort={setSort} label="REB" />
                  </th>
                  <th>
                    <SortBtn k="ast" sort={sort} setSort={setSort} label="AST" />
                  </th>
                  <th>
                    <SortBtn k="stl" sort={sort} setSort={setSort} label="STL" />
                  </th>
                  <th>
                    <SortBtn k="blk" sort={sort} setSort={setSort} label="BLK" />
                  </th>
                  <th>
                    <SortBtn k="tov" sort={sort} setSort={setSort} label="TO" />
                  </th>
                  <th>FG%</th>
                  <th>FT%</th>
                  <th>
                    <SortBtn k="fpts" sort={sort} setSort={setSort} label="FPTS" />
                  </th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.player_id} className={s.click} onClick={() => open({ kind: "player", id: p.player_id })}>
                    <td className={s.text}>
                      <span className={s.inline}>
                        <Headshot nbaId={p.player_id} name={p.name} size={22} />
                        {p.name}
                      </span>
                    </td>
                    <td>{p.position ?? ""}</td>
                    <td>{p.gp}</td>
                    <td>{fmtStat(p.pts)}</td>
                    <td>{fmtStat(p.reb)}</td>
                    <td>{fmtStat(p.ast)}</td>
                    <td>{fmtStat(p.stl)}</td>
                    <td>{fmtStat(p.blk)}</td>
                    <td>{fmtStat(p.tov)}</td>
                    <td>{fmtStat(asPercent(p.fg_pct))}</td>
                    <td>{fmtStat(asPercent(p.ft_pct))}</td>
                    <td className={s.strong}>{fmtStat(p.fpts)}</td>
                    <td style={{ color: p.injury_status && p.injury_status.toUpperCase() !== "ACTIVE" ? "var(--warn)" : "var(--text-3)" }}>{p.injury_status && p.injury_status.toUpperCase() !== "ACTIVE" ? p.injury_status : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Block>

      <div className={s.two}>
        <Block title="Next up" note={schedule.data ? `${schedule.data.remaining_games} to play` : undefined}>
          {schedule.isLoading ? (
            <Skeleton rows={5} className={s.ledgerSkel} />
          ) : ahead.length === 0 ? (
            <div className={s.blockEmpty}>Nothing ahead on the schedule.</div>
          ) : (
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
                {ahead.map((g) => (
                  <tr key={g.date} className={s.click} onClick={() => open({ kind: "slate", date: g.date })}>
                    <td className={s.text} style={{ color: g.date === today ? "var(--accent)" : undefined }}>
                      {dow(g.date)} {monthDay(g.date)}
                    </td>
                    <td className={s.text}>
                      <span className={s.muted}>{g.home ? "vs" : "@"}</span>{" "}
                      <button type="button" className={s.linkBtn} style={{ color: "inherit" }} onClick={(e) => { e.stopPropagation(); open({ kind: "team", abbrev: g.opponent }); }}>
                        {g.opponent}
                      </button>
                    </td>
                    <td>{g.back_to_back ? "B2B" : ""}</td>
                    <td>{g.opponent_def_rating != null ? g.opponent_def_rating.toFixed(1) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Block>
        <Block title="Results" note="latest first">
          {schedule.isLoading ? (
            <Skeleton rows={5} className={s.ledgerSkel} />
          ) : played.length === 0 ? (
            <div className={s.blockEmpty}>No regular-season results yet.</div>
          ) : (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>DAY</th>
                  <th className={s.text}>OPP</th>
                  <th>SCORE</th>
                  <th>W/L</th>
                </tr>
              </thead>
              <tbody>
                {played.map((g) => {
                  const won = g.team_score != null && g.opponent_score != null ? g.team_score > g.opponent_score : null;
                  return (
                    <tr key={g.date} className={s.click} onClick={() => open({ kind: "slate", date: g.date })}>
                      <td className={s.text}>
                        {dow(g.date)} {monthDay(g.date)}
                      </td>
                      <td className={s.text}>
                        <span className={s.muted}>{g.home ? "vs" : "@"}</span> {g.opponent}
                      </td>
                      <td>
                        {g.team_score ?? "—"}–{g.opponent_score ?? "—"}
                      </td>
                      <td className={won === true ? s.best : won === false ? s.worst : ""}>{won === null ? "" : won ? "W" : "L"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Block>
      </div>
    </div>
  );
}

function SortBtn({ k, sort, setSort, label }: { k: RosterSort; sort: RosterSort; setSort: (k: RosterSort) => void; label: string }) {
  return (
    <button type="button" className={`${s.sortBtn} ${sort === k ? s.sortOn : ""}`} onClick={() => setSort(k)}>
      {label}
      {sort === k ? " ▾" : ""}
    </button>
  );
}

function GameBlock({ game, abbrev, open, today }: { game: NBATeamLiveGameData; abbrev: string; open: (f: Focus) => void; today: string }) {
  const state = gameState(game.status);
  const status = gameStatusText(game.status, game.period, game.game_clock, game.start_time_et);
  const periods = Math.max(game.home_periods.length, game.away_periods.length, 4);
  const when = game.is_today ? "tonight" : game.game_date === today ? "today" : game.is_upcoming ? `${dow(game.game_date)} ${monthDay(game.game_date)}` : `${dow(game.game_date)} ${monthDay(game.game_date)}`;
  return (
    <Block
      title={state === "live" ? "On the floor" : game.is_upcoming ? "Next game" : "Last game"}
      note={`${when} · ${status}${game.arena ? ` · ${game.arena}` : ""}`}
      right={state === "live" ? <span className={`${s.live} ${dk.sub}`}>live</span> : null}
    >
      <div className={s.two} style={{ gap: 24 }}>
        <div>
          {state === "scheduled" ? (
            <div className={s.gameRow} style={{ gridTemplateColumns: "auto auto auto", justifyContent: "start", gap: 12 }}>
              <button type="button" className={s.gameTeam} onClick={() => open({ kind: "team", abbrev: game.away_team })}>
                <span className={s.teamAbbrev} style={{ fontSize: 14, color: game.away_team === abbrev ? "var(--accent)" : undefined }}>{game.away_team}</span>
                <span className={s.gameTeamName}>{teamInfo(game.away_team)?.name ?? ""}</span>
              </button>
              <span className={s.muted}>at</span>
              <button type="button" className={s.gameTeam} onClick={() => open({ kind: "team", abbrev: game.home_team })}>
                <span className={s.teamAbbrev} style={{ fontSize: 14, color: game.home_team === abbrev ? "var(--accent)" : undefined }}>{game.home_team}</span>
                <span className={s.gameTeamName}>{teamInfo(game.home_team)?.name ?? ""}</span>
              </button>
            </div>
          ) : (
          <table className={s.periods}>
            <thead>
              <tr>
                <th />
                {Array.from({ length: periods }, (_, i) => (
                  <th key={i}>{i < 4 ? `Q${i + 1}` : i === 4 ? "OT" : `${i - 3}OT`}</th>
                ))}
                <th>T</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  [game.away_team, game.away_periods, game.away_score],
                  [game.home_team, game.home_periods, game.home_score],
                ] as const
              ).map(([team, per, total]) => (
                <tr key={team}>
                  <td>
                    <button type="button" className={s.teamBtn} style={{ fontSize: 12, color: team === abbrev ? "var(--accent)" : undefined }} onClick={() => open({ kind: "team", abbrev: team })}>
                      {team}
                    </button>
                  </td>
                  {Array.from({ length: periods }, (_, i) => (
                    <td key={i}>{per[i] ?? ""}</td>
                  ))}
                  <td className={s.total}>{total ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
          {game.injured_players.length ? (
            <div style={{ marginTop: 10 }} className={dk.sub}>
              Out or doubtful:{" "}
              {game.injured_players.map((p, i) => (
                <span key={p.player_id}>
                  {i > 0 ? ", " : ""}
                  <button type="button" className={s.linkBtn} style={{ font: "inherit" }} onClick={() => open({ kind: "player", id: p.player_id })}>
                    {p.name}
                  </button>{" "}
                  ({p.status}
                  {p.injury_type ? ` · ${p.injury_type}` : ""})
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {game.away_top_performers.length || game.home_top_performers.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Performers title={game.away_team} list={game.away_top_performers} open={open} />
            <Performers title={game.home_team} list={game.home_top_performers} open={open} />
          </div>
        ) : null}
      </div>
    </Block>
  );
}

function Performers({ title, list, open }: { title: string; list: TopPerformer[]; open: (f: Focus) => void }) {
  return (
    <div>
      <div className={dk.label} style={{ marginBottom: 4 }}>
        {title}
      </div>
      <table className={s.table}>
        <tbody>
          {list.slice(0, 4).map((p) => (
            <tr key={p.player_id} className={s.click} onClick={() => open({ kind: "player", id: p.player_id })}>
              <td className={s.text}>{p.name}</td>
              <td className={s.strong}>{p.pts}</td>
              <td>{p.reb}r</td>
              <td>{p.ast}a</td>
              <td className={s.muted}>{p.min}m</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
