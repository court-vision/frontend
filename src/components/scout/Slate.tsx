"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Headshot } from "@/components/desk/Headshot";
import { TeamLogo } from "@/components/desk/TeamLogo";
import { gamesKeys, useGamesOnDateQuery } from "@/hooks/useGames";
import { useNBATeamLiveGameQuery } from "@/hooks/useNBATeam";
import { apiClient } from "@/lib/api";
import { userMessage } from "@/lib/api-error";
import { addDays, clockText, dayName, dow, gameFocus, gameState, gameStatusText, monthDay, periodName, teamInfo, tipText, type Focus } from "@/lib/scout";
import type { GameInfo, NBATeamLiveGameData } from "@/types/games";
import type { LivePlayerData } from "@/types/live";
import type { RankingsPlayer } from "@/types/rankings";
import { Block, Skeleton } from "./blocks";
import dk from "@/components/desk/desk.module.css";
import s from "./scout.module.css";

export interface LiveCtx {
  leaders: LivePlayerData[] | undefined;
  leadersLoading: boolean;
  poolById: Map<number, RankingsPlayer>;
}

function Tape({ ticks }: { ticks: Array<{ label: string; value: React.ReactNode; sub?: React.ReactNode }> }) {
  return (
    <div className={s.tape}>
      {ticks.map((t, i) => (
        <div key={i} className={s.tick}>
          <span className={dk.label}>{t.label}</span>
          <span className={s.tickValue}>{t.value}</span>
          {t.sub ? <span className={s.tickSub}>{t.sub}</span> : null}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The tracker: tonight as it runs, last night in a line, the nights ahead
// ---------------------------------------------------------------------------

const AHEAD = 5;

export function SlateOverview({ today, open, live }: { today: string; open: (focus: Focus) => void; live: LiveCtx }) {
  const dates = useMemo(() => [addDays(today, -1), today, ...Array.from({ length: AHEAD }, (_, i) => addDays(today, i + 1))], [today]);
  const results = useQueries({
    queries: dates.map((d) => ({
      queryKey: gamesKeys.onDate(d),
      queryFn: ({ signal }: { signal?: AbortSignal }) => apiClient.getGamesOnDate(d, { signal }),
      staleTime: d === today ? 0 : 1000 * 60 * 5,
      refetchInterval: (d === today ? 60 * 1000 : false) as number | false,
      retry: false,
      meta: { toast: false },
    })),
  });
  const byDate = useMemo(() => Object.fromEntries(dates.map((d, i) => [d, results[i]])), [dates, results]);
  const tonight = byDate[today];
  const games = tonight.data?.games ?? [];
  const liveCount = games.filter((g) => gameState(g.status) === "live").length;
  const finals = games.filter((g) => gameState(g.status) === "final").length;
  const tips = games.map((g) => g.start_time_et).filter((t): t is string => !!t).sort();
  const yesterday = byDate[dates[0]];
  const ahead = dates.slice(2);
  return (
    <div className={s.sheetInner}>
      <header className={s.head}>
        <div className={s.headBody}>
          <div className={s.headName}>
            <span>Tracker</span>
            <span className={dk.sub}>
              {dayName(today, today)} · {dow(today)} {monthDay(today)}
            </span>
          </div>
          <span className={s.headSub}>Tonight as it runs: every game, who is on the floor, and the box line of each. Last night and the nights ahead in a line each; a matchup in the sidebar has the whole thing.</span>
        </div>
      </header>
      <Tape
        ticks={[
          { label: "Tonight", value: tonight.isLoading ? "…" : `${games.length}`, sub: games.length === 1 ? "game" : "games" },
          { label: "Live now", value: <span className={liveCount ? s.live : ""}>{liveCount}</span>, sub: finals ? `${finals} final` : undefined },
          { label: "First tip", value: tips.length ? `${tipText(tips[0])}` : "—", sub: tips.length ? "ET" : "no tips yet" },
          { label: "Last tip", value: tips.length ? `${tipText(tips[tips.length - 1])}` : "—", sub: tips.length ? "ET" : undefined },
          { label: "On the floor", value: live.leaders ? `${live.leaders.length}` : live.leadersLoading ? "…" : "0", sub: "players with minutes" },
        ]}
      />

      <Block title="Tonight" note={liveCount ? "scores refresh every minute" : games.length ? "tip times in ET" : undefined}>
        {tonight.isLoading ? (
          <Skeleton rows={4} className={s.ledgerSkel} />
        ) : tonight.error ? (
          <div className={dk.error}>{userMessage(tonight.error, "Couldn't load tonight")}</div>
        ) : games.length === 0 ? (
          <div className={s.blockEmpty}>No games tonight.</div>
        ) : (
          <GameCards games={games} date={today} open={open} leaders={live.leaders} poolById={live.poolById} />
        )}
      </Block>

      {live.leaders && live.leaders.length > 0 ? (
        <Block title="On the floor" note="every player with minutes tonight · by fantasy points">
          <div className={s.tableWrap}>
            <LeadersTable leaders={live.leaders} open={open} poolById={live.poolById} games={games} date={today} />
          </div>
        </Block>
      ) : null}

      <div className={s.two}>
        <Block title="Last night" note={`${dow(dates[0])} ${monthDay(dates[0])}`}>
          {yesterday.isLoading ? (
            <Skeleton rows={3} className={s.ledgerSkel} />
          ) : !yesterday.data || yesterday.data.games.length === 0 ? (
            <div className={s.blockEmpty}>No games last night.</div>
          ) : (
            <ResultLines games={yesterday.data.games} date={dates[0]} open={open} />
          )}
        </Block>
        <Block title="Ahead" note={`the next ${AHEAD} nights`}>
          <div className={s.aheadList}>
            {ahead.map((d) => {
              const q = byDate[d];
              const list = q.data?.games ?? [];
              return (
                <div key={d} className={s.aheadRow}>
                  <span className={s.aheadDay}>
                    <span className={s.teamAbbrev}>{dow(d).toUpperCase()}</span>
                    <span className={s.muted}>{monthDay(d)}</span>
                  </span>
                  <span className={s.aheadCount}>{q.isLoading ? "…" : `${list.length}`}</span>
                  <span className={s.aheadGames}>
                    {list.map((g) => (
                      <button key={g.game_id ?? `${g.away_team}@${g.home_team}`} type="button" className={s.aheadChip} onClick={() => open(gameFocus(d, g.game_id, g.away_team, g.home_team))} title={`${g.away_team} at ${g.home_team}${g.start_time_et ? ` · ${tipText(g.start_time_et)} ET` : ""}`}>
                        <TeamLogo abbrev={g.away_team} size={12} />
                        {g.away_team}
                        <span className={s.dim}>@</span>
                        <TeamLogo abbrev={g.home_team} size={12} />
                        {g.home_team}
                      </button>
                    ))}
                    {!q.isLoading && list.length === 0 ? <span className={s.muted}>off</span> : null}
                  </span>
                </div>
              );
            })}
          </div>
        </Block>
      </div>
    </div>
  );
}

function ResultLines({ games, date, open }: { games: GameInfo[]; date: string; open: (f: Focus) => void }) {
  return (
    <table className={s.table}>
      <tbody>
        {games.map((g) => {
          const awayWon = g.away_score != null && g.home_score != null && g.away_score > g.home_score;
          const homeWon = g.away_score != null && g.home_score != null && g.home_score > g.away_score;
          return (
            <tr key={g.game_id ?? `${g.away_team}@${g.home_team}`} className={s.click} onClick={() => open(gameFocus(date, g.game_id, g.away_team, g.home_team))}>
              <td className={s.text}>
                <span className={s.inline}>
                  <TeamLogo abbrev={g.away_team} size={16} />
                  <span className={awayWon ? s.strong : ""}>{g.away_team}</span>
                </span>
              </td>
              <td className={awayWon ? s.strong : ""}>{g.away_score ?? "—"}</td>
              <td className={s.muted} style={{ width: 20, textAlign: "center" }}>
                @
              </td>
              <td className={s.text}>
                <span className={s.inline}>
                  <TeamLogo abbrev={g.home_team} size={16} />
                  <span className={homeWon ? s.strong : ""}>{g.home_team}</span>
                </span>
              </td>
              <td className={homeWon ? s.strong : ""}>{g.home_score ?? "—"}</td>
              <td className={s.muted}>{gameStatusText(g.status, g.period, g.game_clock, g.start_time_et)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Game cards: a night's matchups, each with its top lines while it runs
// ---------------------------------------------------------------------------

export function GameCards({ games, date, open, leaders, poolById }: { games: GameInfo[]; date: string; open: (f: Focus) => void; leaders?: LivePlayerData[]; poolById?: Map<number, RankingsPlayer> }) {
  return (
    <div className={s.games}>
      {games.map((g) => {
        const state = gameState(g.status);
        const status = gameStatusText(g.status, g.period, g.game_clock, g.start_time_et);
        const awayLead = g.away_score != null && g.home_score != null ? g.away_score > g.home_score : null;
        const f = gameFocus(date, g.game_id, g.away_team, g.home_team);
        const lines = leaders && g.game_id ? leaders.filter((p) => p.game_id === g.game_id).slice(0, 3) : [];
        return (
          <div key={g.game_id ?? `${g.away_team}@${g.home_team}`} className={s.game} data-state={state}>
            <button type="button" className={s.gameStatus} onClick={() => open(f)} title="The game's sheet">
              {state === "live" ? <span className={dk.liveDot} /> : null}
              {status}
              <span className={dk.spacer} />
              <ArrowRight size={11} />
            </button>
            {(
              [
                [g.away_team, g.away_score, awayLead],
                [g.home_team, g.home_score, awayLead === null ? null : !awayLead],
              ] as const
            ).map(([team, score, lead], i) => (
              <div key={team} className={s.gameRow}>
                <button type="button" className={s.gameTeam} onClick={() => open({ kind: "team", abbrev: team })}>
                  <TeamLogo abbrev={team} size={22} />
                  <span className={s.teamAbbrev}>{team}</span>
                  <span className={s.gameTeamName}>{teamInfo(team)?.name ?? ""}</span>
                </button>
                {state !== "scheduled" ? (
                  <span className={s.gameScore} data-lead={lead == null ? undefined : lead}>
                    {score ?? 0}
                  </span>
                ) : (
                  <span className={s.gameFoot}>{i === 0 ? "away" : "home"}</span>
                )}
              </div>
            ))}
            {lines.length ? (
              <div className={s.gameLines}>
                {lines.map((p) => (
                  <button key={p.player_id} type="button" className={s.gameLine} onClick={() => open({ kind: "player", id: p.player_id })}>
                    <Headshot nbaId={p.player_id} name={p.player_name} size={18} />
                    <span className={s.rowName}>{p.player_name}</span>
                    <span className={s.muted}>{poolById?.get(p.player_id)?.team ?? ""}</span>
                    <span className={s.strong}>{p.fpts.toFixed(1)}</span>
                    <span className={s.muted}>
                      {p.pts}p {p.reb}r {p.ast}a
                    </span>
                  </button>
                ))}
              </div>
            ) : g.arena && state === "scheduled" ? (
              <div className={s.gameFoot}>{g.arena}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function LeadersTable({ leaders, open, limit, poolById, games, date }: { leaders: LivePlayerData[]; open: (f: Focus) => void; limit?: number; poolById?: Map<number, RankingsPlayer>; games?: GameInfo[]; date?: string }) {
  const rows = limit ? leaders.slice(0, limit) : leaders;
  const gameOf = (id: string) => games?.find((g) => g.game_id === id) ?? null;
  return (
    <table className={s.table}>
      <thead>
        <tr>
          <th>PLAYER</th>
          <th className={s.text}>TEAM</th>
          <th className={s.text}>GAME</th>
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
        {rows.map((p) => {
          const team = poolById?.get(p.player_id)?.team ?? null;
          const g = gameOf(p.game_id);
          return (
            <tr key={p.player_id} className={s.click} onClick={() => open({ kind: "player", id: p.player_id })}>
              <td className={s.text}>
                <span className={s.inline}>
                  <Headshot nbaId={p.player_id} name={p.player_name} size={22} />
                  {p.player_name}
                </span>
              </td>
              <td className={s.text}>{team ? <span className={s.inline} style={{ gap: 5 }}><TeamLogo abbrev={team} size={14} />{team}</span> : ""}</td>
              <td className={s.text}>
                {g && date ? (
                  <button type="button" className={s.linkBtn} style={{ font: "inherit" }} onClick={(e) => { e.stopPropagation(); open(gameFocus(date, g.game_id, g.away_team, g.home_team)); }}>
                    {g.away_team}@{g.home_team}
                  </button>
                ) : null}
                <span className={`${s.muted} ${p.game_status === 2 ? s.live : ""}`} style={{ marginLeft: 6 }}>
                  {p.game_status >= 3 ? "Final" : p.game_status === 2 ? `${periodName(p.period)} ${clockText(p.game_clock)}` : "pre"}
                </span>
              </td>
              <td>{p.min}</td>
              <td>{p.pts}</td>
              <td>{p.reb}</td>
              <td>{p.ast}</td>
              <td>{p.stl}</td>
              <td>{p.blk}</td>
              <td>{p.tov}</td>
              <td>{p.fg3m}</td>
              <td>
                {p.fgm}/{p.fga}
              </td>
              <td>
                {p.ftm}/{p.fta}
              </td>
              <td className={s.strong}>{p.fpts.toFixed(1)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// One matchup
// ---------------------------------------------------------------------------

export function GameSheet({ date, gameId, today, open, live }: { date: string; gameId: string; today: string; open: (focus: Focus) => void; live: LiveCtx }) {
  const games = useGamesOnDateQuery(date);
  const game = useMemo(() => {
    const list = games.data?.games ?? [];
    return list.find((g) => g.game_id === gameId) ?? list.find((g) => `${g.away_team}@${g.home_team}` === gameId) ?? null;
  }, [games.data, gameId]);
  const isToday = date === today;
  const detail = useNBATeamLiveGameQuery(isToday && game ? game.home_team : null);
  const d: NBATeamLiveGameData | null = detail.data && game && detail.data.game_id === game.game_id ? detail.data : detail.data && game && detail.data.home_team === game.home_team && detail.data.away_team === game.away_team ? detail.data : null;
  const lines = useMemo(() => (isToday && game?.game_id && live.leaders ? live.leaders.filter((p) => p.game_id === game.game_id) : []), [isToday, game, live.leaders]);
  const split = useMemo(() => {
    const away: LivePlayerData[] = [];
    const home: LivePlayerData[] = [];
    const other: LivePlayerData[] = [];
    for (const p of lines) {
      const team = live.poolById.get(p.player_id)?.team;
      if (game && team === game.away_team) away.push(p);
      else if (game && team === game.home_team) home.push(p);
      else other.push(p);
    }
    return { away, home, other };
  }, [lines, live.poolById, game]);

  if (games.isLoading) return <Skeleton rows={8} />;
  if (games.error) return <div className={s.sheetError}>{userMessage(games.error, "Couldn't load this night")}</div>;
  if (!game) {
    return (
      <div className={s.sheetInner}>
        <div className={s.hero}>
          <span className={s.boardTitle}>No such game</span>
          <span className={s.boardSub}>Nothing on {dayName(date, today).toLowerCase()} matches this id. The night&apos;s matchups are in the sidebar.</span>
        </div>
      </div>
    );
  }
  const state = gameState(game.status);
  const status = gameStatusText(game.status, game.period, game.game_clock, game.start_time_et);
  const awayLead = game.away_score != null && game.home_score != null ? game.away_score > game.home_score : null;
  const periods = d ? Math.max(d.home_periods.length, d.away_periods.length, 4) : 0;

  return (
    <div className={s.sheetInner}>
      <header className={`${s.head} ${s.gameHead}`}>
        <div className={s.gameSide}>
          <button type="button" className={s.gameBig} onClick={() => open({ kind: "team", abbrev: game.away_team })}>
            <TeamLogo abbrev={game.away_team} size={56} />
            <span>
              <span className={s.gameBigName}>{teamInfo(game.away_team)?.name ?? game.away_team}</span>
              <span className={dk.sub}>{game.away_team} · away</span>
            </span>
          </button>
          {state !== "scheduled" ? <span className={s.scoreBig} data-lead={awayLead == null ? undefined : awayLead}>{game.away_score ?? 0}</span> : null}
        </div>
        <div className={s.gameMid}>
          <span className={`${s.gameState} ${state === "live" ? s.live : ""}`}>
            {state === "live" ? <span className={dk.liveDot} /> : null}
            {status}
          </span>
          <span className={dk.sub}>{dayName(date, today)}</span>
          {game.arena ? <span className={dk.sub}>{game.arena}</span> : null}
        </div>
        <div className={`${s.gameSide} ${s.gameSideHome}`}>
          {state !== "scheduled" ? <span className={s.scoreBig} data-lead={awayLead == null ? undefined : !awayLead}>{game.home_score ?? 0}</span> : null}
          <button type="button" className={s.gameBig} onClick={() => open({ kind: "team", abbrev: game.home_team })}>
            <span style={{ textAlign: "right" }}>
              <span className={s.gameBigName}>{teamInfo(game.home_team)?.name ?? game.home_team}</span>
              <span className={dk.sub}>{game.home_team} · home</span>
            </span>
            <TeamLogo abbrev={game.home_team} size={56} />
          </button>
        </div>
      </header>

      {d && periods ? (
        <div className={s.two}>
          <Block title="By period">
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
                    [d.away_team, d.away_periods, d.away_score],
                    [d.home_team, d.home_periods, d.home_score],
                  ] as const
                ).map(([team, per, total]) => (
                  <tr key={team}>
                    <td>
                      <span className={s.inline}>
                        <TeamLogo abbrev={team} size={16} />
                        {team}
                      </span>
                    </td>
                    {Array.from({ length: periods }, (_, i) => (
                      <td key={i}>{per[i] ?? ""}</td>
                    ))}
                    <td className={s.total}>{total ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Block>
          <Block title="Margin" note={d.score_history.length ? `${d.score_history.length} snapshots · ${d.away_team} above the line` : "no snapshots yet"}>
            {d.score_history.length > 1 ? <MarginChart data={d} /> : <div className={s.blockEmpty}>The line draws once the game has run a while.</div>}
          </Block>
        </div>
      ) : null}

      {isToday ? (
        <Block title="On the floor" note={lines.length ? `${lines.length} players · by fantasy points` : state === "scheduled" ? "lines appear once the game tips" : "no lines on record"}>
          {live.leadersLoading ? (
            <Skeleton rows={5} className={s.ledgerSkel} />
          ) : lines.length === 0 ? (
            <div className={s.blockEmpty}>{state === "scheduled" ? `Tips ${status}.` : "Nobody has a line for this game."}</div>
          ) : (
            <div className={s.two} style={{ gap: 0 }}>
              {(
                [
                  [game.away_team, split.away],
                  [game.home_team, split.home],
                ] as const
              ).map(([team, list]) => (
                <div key={team} className={s.sideTable}>
                  <div className={`${dk.label} ${s.inline}`} style={{ marginBottom: 6 }}>
                    <TeamLogo abbrev={team} size={14} />
                    {team}
                  </div>
                  <LineTable rows={list} open={open} />
                </div>
              ))}
              {split.other.length ? (
                <div className={s.sideTable} style={{ gridColumn: "1 / -1" }}>
                  <div className={dk.label} style={{ marginBottom: 6 }}>
                    Unplaced · not in the ranked pool
                  </div>
                  <LineTable rows={split.other} open={open} />
                </div>
              ) : null}
            </div>
          )}
        </Block>
      ) : (
        <Block title="Box score" note={state === "final" ? "final" : "not yet played"}>
          <div className={s.blockEmpty}>{state === "final" ? "Live lines are kept for tonight only; the players' game logs carry this night's box scores." : `Tips ${status}. Lines appear here while it runs.`}</div>
        </Block>
      )}

      {d ? (
        <div className={s.two}>
          <Block title="Top performers" note="from the league feed">
            {d.away_top_performers.length || d.home_top_performers.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {(
                  [
                    [d.away_team, d.away_top_performers],
                    [d.home_team, d.home_top_performers],
                  ] as const
                ).map(([team, list]) => (
                  <div key={team}>
                    <div className={`${dk.label} ${s.inline}`} style={{ marginBottom: 4 }}>
                      <TeamLogo abbrev={team} size={14} />
                      {team}
                    </div>
                    <table className={s.table}>
                      <tbody>
                        {list.slice(0, 5).map((p) => (
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
                ))}
              </div>
            ) : (
              <div className={s.blockEmpty}>None yet.</div>
            )}
          </Block>
          <Block title="Out or doubtful" note={`${d.injured_players.length}`}>
            {d.injured_players.length ? (
              <table className={s.table}>
                <tbody>
                  {d.injured_players.map((p) => (
                    <tr key={p.player_id} className={s.click} onClick={() => open({ kind: "player", id: p.player_id })}>
                      <td className={s.text}>{p.name}</td>
                      <td className={s.text} style={{ color: "var(--warn)" }}>
                        {p.status}
                      </td>
                      <td className={`${s.text} ${s.muted}`}>{p.injury_type ?? ""}</td>
                      <td className={`${s.text} ${s.muted}`}>{p.expected_return ? `back ${p.expected_return}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={s.blockEmpty}>Nobody listed.</div>
            )}
          </Block>
        </div>
      ) : null}
    </div>
  );
}

function LineTable({ rows, open }: { rows: LivePlayerData[]; open: (f: Focus) => void }) {
  if (rows.length === 0) return <div className={s.blockEmpty}>No lines.</div>;
  return (
    <table className={s.table}>
      <thead>
        <tr>
          <th>PLAYER</th>
          <th>MIN</th>
          <th>PTS</th>
          <th>REB</th>
          <th>AST</th>
          <th>STL</th>
          <th>BLK</th>
          <th>TO</th>
          <th>FG</th>
          <th>FPTS</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.player_id} className={s.click} onClick={() => open({ kind: "player", id: p.player_id })}>
            <td className={s.text}>
              <span className={s.inline}>
                <Headshot nbaId={p.player_id} name={p.player_name} size={20} />
                {p.player_name}
              </span>
            </td>
            <td>{p.min}</td>
            <td>{p.pts}</td>
            <td>{p.reb}</td>
            <td>{p.ast}</td>
            <td>{p.stl}</td>
            <td>{p.blk}</td>
            <td>{p.tov}</td>
            <td>
              {p.fgm}/{p.fga}
            </td>
            <td className={s.strong}>{p.fpts.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The score margin over the game's snapshots: away minus home, zero in the middle. */
function MarginChart({ data }: { data: NBATeamLiveGameData }) {
  const pts = data.score_history.map((snap) => snap.away_score - snap.home_score);
  const W = 1000;
  const H = 120;
  const max = Math.max(5, ...pts.map((v) => Math.abs(v)));
  const x = (i: number) => (pts.length === 1 ? W / 2 : (i / (pts.length - 1)) * W);
  const y = (v: number) => H / 2 - (v / max) * (H / 2 - 6);
  const path = pts.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <>
      <svg className={s.chart} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-label="Score margin over time">
        <line className={s.chartMean} x1={0} x2={W} y1={H / 2} y2={H / 2} vectorEffect="non-scaling-stroke" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className={s.chartHover}>
        <span style={{ color: "var(--text)" }}>
          {last > 0 ? `${data.away_team} +${last}` : last < 0 ? `${data.home_team} +${-last}` : "tied"}
        </span>
        <span className={dk.spacer} />
        <span>largest lead ±{max}</span>
      </div>
    </>
  );
}
