"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Headshot } from "@/components/desk/Headshot";
import { TeamLogo } from "@/components/desk/TeamLogo";
import { useGamesOnDateQuery } from "@/hooks/useGames";
import { userMessage } from "@/lib/api-error";
import { addDays, clockText, dayName, dow, gameState, gameStatusText, monthDay, periodName, teamInfo, type Focus } from "@/lib/scout";
import type { GameInfo } from "@/types/games";
import type { LivePlayerData } from "@/types/live";
import { Block, Skeleton } from "./blocks";
import dk from "@/components/desk/desk.module.css";
import s from "./scout.module.css";

export interface SlateSheetProps {
  date: string;
  today: string;
  open: (focus: Focus) => void;
  leaders: LivePlayerData[] | undefined;
  leadersLoading: boolean;
}

export function SlateSheet({ date, today, open, leaders, leadersLoading }: SlateSheetProps) {
  const games = useGamesOnDateQuery(date);
  const isToday = date === today;
  const live = (games.data?.games ?? []).filter((g) => gameState(g.status) === "live").length;
  return (
    <div className={s.sheetInner}>
      <header className={s.head}>
        <div className={s.headBody}>
          <div className={s.headName}>
            <span>{dayName(date, today)}</span>
            {dayName(date, today) !== `${dow(date)} ${monthDay(date)}` ? <span className={dk.sub}>{`${dow(date)} ${monthDay(date)}`}</span> : null}
          </div>
          <div className={s.headMeta}>
            <span>{games.isLoading ? "…" : `${games.data?.count ?? 0} games`}</span>
            {live ? (
              <>
                <span className={s.dot}>·</span>
                <span className={s.live}>{live} live</span>
              </>
            ) : null}
          </div>
        </div>
        <div className={s.headActions}>
          <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => open({ kind: "slate", date: addDays(date, -1) })} title="The night before (←)">
            <ChevronLeft size={13} /> {dow(addDays(date, -1))}
          </button>
          {!isToday ? (
            <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => open({ kind: "slate", date: today })}>
              Tonight
            </button>
          ) : null}
          <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => open({ kind: "slate", date: addDays(date, 1) })} title="The night after (→)">
            {dow(addDays(date, 1))} <ChevronRight size={13} />
          </button>
        </div>
      </header>

      <Block title="Games" note={isToday ? "scores refresh every minute" : undefined}>
        {games.isLoading ? (
          <Skeleton rows={4} className={s.ledgerSkel} />
        ) : games.error ? (
          <div className={s.blockEmpty}>{userMessage(games.error, "Couldn't load the games")}</div>
        ) : !games.data || games.data.games.length === 0 ? (
          <div className={s.blockEmpty}>No games this night.</div>
        ) : (
          <GameCards games={games.data.games} open={open} />
        )}
      </Block>

      {isToday ? (
        <Block title="On the floor" note="every player with minutes tonight · fantasy points">
          {leadersLoading ? (
            <Skeleton rows={6} className={s.ledgerSkel} />
          ) : !leaders || leaders.length === 0 ? (
            <div className={s.blockEmpty}>Nobody has checked in yet. Lines appear once the first game tips.</div>
          ) : (
            <div className={s.tableWrap}>
              <LeadersTable leaders={leaders} open={open} />
            </div>
          )}
        </Block>
      ) : null}
    </div>
  );
}

export function GameCards({ games, open }: { games: GameInfo[]; open: (f: Focus) => void }) {
  return (
    <div className={s.games}>
      {games.map((g) => {
        const state = gameState(g.status);
        const status = gameStatusText(g.status, g.period, g.game_clock, g.start_time_et);
        const awayLead = g.away_score != null && g.home_score != null ? g.away_score > g.home_score : null;
        return (
          <div key={g.game_id ?? `${g.away_team}@${g.home_team}`} className={s.game} data-state={state}>
            <div className={s.gameStatus}>
              {state === "live" ? <span className={dk.liveDot} /> : null}
              {status}
            </div>
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
                  <span className={s.gameTeamName}>
                    {i === 0 ? "" : ""}
                    {teamInfo(team)?.name ?? ""}
                  </span>
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
            {g.arena ? <div className={s.gameFoot}>{g.arena}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

export function LeadersTable({ leaders, open, limit }: { leaders: LivePlayerData[]; open: (f: Focus) => void; limit?: number }) {
  const rows = limit ? leaders.slice(0, limit) : leaders;
  return (
    <table className={s.table}>
      <thead>
        <tr>
          <th>PLAYER</th>
          <th>GAME</th>
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
        {rows.map((p) => (
          <tr key={p.player_id} className={s.click} onClick={() => open({ kind: "player", id: p.player_id })}>
            <td className={s.text}>
              <span className={s.inline}>
                <Headshot nbaId={p.player_id} name={p.player_name} size={22} />
                {p.player_name}
              </span>
            </td>
            <td className={p.game_status === 2 ? s.live : s.muted}>{p.game_status >= 3 ? "Final" : p.game_status === 2 ? `${periodName(p.period)} ${clockText(p.game_clock)}` : "pre"}</td>
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
        ))}
      </tbody>
    </table>
  );
}
