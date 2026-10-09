"use client";

import { useGamesOnDateQuery } from "@/hooks/useGames";
import { useOwnershipTrendingQuery } from "@/hooks/useOwnershipTrending";
import { Headshot } from "@/components/desk/Headshot";
import { TeamLogo } from "@/components/desk/TeamLogo";
import { dayName, fmtDelta, gameState, shortName, type Focus, type Lens } from "@/lib/scout";
import type { LivePlayerData } from "@/types/live";
import type { RankingsPlayer } from "@/types/rankings";
import { Block, Skeleton } from "./blocks";
const TRENDING_PARAMS = { days: 7, limit: 50, sort_by: "change" as const, direction: "both" as const };
import { GameCards, LeadersTable } from "./Slate";
import dk from "@/components/desk/desk.module.css";
import s from "./scout.module.css";

export interface BoardSheetProps {
  today: string;
  open: (focus: Focus) => void;
  setLens: (lens: Lens) => void;
  openSearch: () => void;
  leaders: LivePlayerData[] | undefined;
  leadersLoading: boolean;
  recent: Focus[];
  nameOf: (focus: Focus) => string;
  pool: RankingsPlayer[];
  poolById: Map<number, RankingsPlayer>;
  seasonNote: string | null;
}

/** What the sheet shows with nothing open: tonight, who is scoring, who is moving, where you were. */
export function BoardSheet({ today, open, setLens, openSearch, leaders, leadersLoading, recent, nameOf, pool, poolById, seasonNote }: BoardSheetProps) {
  const games = useGamesOnDateQuery(today);
  const trending = useOwnershipTrendingQuery(TRENDING_PARAMS);
  const live = (games.data?.games ?? []).filter((g) => gameState(g.status) === "live").length;
  const top = pool.slice(0, 10);
  return (
    <div className={s.sheetInner}>
      <div className={s.boardHero}>
        <span className={s.boardTitle}>Scout</span>
        <span className={s.boardSub}>
          One player, one team or one night at a time, with every public number Court Vision keeps on it. Pick from the ledger on the left, or find anything with{" "}
          <button type="button" className={s.linkBtn} onClick={openSearch}>
            the search box
          </button>
          .{seasonNote ? ` ${seasonNote}` : ""}
        </span>
        <div className={s.hintRow}>
          <span>
            <span className={dk.kbd}>/</span> find
          </span>
          <span>
            <span className={dk.kbd}>[</span>
            <span className={dk.kbd}>]</span> lens
          </span>
          <span>
            <span className={dk.kbd}>↑</span>
            <span className={dk.kbd}>↓</span> move · <span className={dk.kbd}>⏎</span> open
          </span>
          <span>
            <span className={dk.kbd}>P</span> pin · <span className={dk.kbd}>C</span> compare
          </span>
          <span>
            <span className={dk.kbd}>W</span> window
          </span>
        </div>
        {recent.length ? (
          <div className={s.recent} style={{ marginTop: 10 }}>
            <span className={dk.label}>Recent</span>
            {recent.slice(0, 8).map((f, i) => (
              <button key={`${f.kind}-${i}`} type="button" className={s.benchChip} onClick={() => open(f)}>
                {f.kind === "player" ? <Headshot nbaId={f.id} name={nameOf(f)} size={20} /> : f.kind === "team" ? <TeamLogo abbrev={f.abbrev} size={20} /> : <span className={s.benchMark}>{f.kind === "game" ? "G" : f.kind === "market" ? "M" : "O"}</span>}
                <span>{f.kind === "player" ? shortName(nameOf(f)) : nameOf(f)}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <Block
        title="Tonight"
        note={games.isLoading ? "…" : `${dayName(today, today)} · ${games.data?.count ?? 0} games${live ? ` · ${live} live` : ""}`}
        right={
          <button type="button" className={s.linkBtn} style={{ fontSize: 12 }} onClick={() => open({ kind: "overview", lens: "slate" })}>
            The tracker →
          </button>
        }
      >
        {games.isLoading ? (
          <Skeleton rows={3} className={s.ledgerSkel} />
        ) : !games.data || games.data.games.length === 0 ? (
          <div className={s.blockEmpty}>
            No games tonight.{" "}
            <button type="button" className={s.linkBtn} onClick={() => open({ kind: "overview", lens: "slate" })}>
              See the nights ahead
            </button>
            .
          </div>
        ) : (
          <GameCards games={games.data.games} date={today} open={open} leaders={leaders} poolById={poolById} />
        )}
      </Block>

      {leaders && leaders.length > 0 ? (
        <Block
          title="On the floor"
          note="top ten by fantasy points · live"
          right={
            <button type="button" className={s.linkBtn} style={{ fontSize: 12 }} onClick={() => open({ kind: "overview", lens: "slate" })}>
              Everyone →
            </button>
          }
        >
          <div className={s.tableWrap}>
            <LeadersTable leaders={leaders} open={open} limit={10} poolById={poolById} games={games.data?.games} date={today} />
          </div>
        </Block>
      ) : leadersLoading ? null : null}

      <div className={s.two}>
        <Block
          title="Being added"
          note="ESPN ownership · 7 days"
          right={
            <button type="button" className={s.linkBtn} style={{ fontSize: 12 }} onClick={() => open({ kind: "overview", lens: "market" })}>
              Market →
            </button>
          }
        >
          <TrendList rows={trending.data?.trending_up ?? []} loading={trending.isLoading} open={open} />
        </Block>
        <Block title="Being dropped" note="ESPN ownership · 7 days">
          <TrendList rows={trending.data?.trending_down ?? []} loading={trending.isLoading} open={open} />
        </Block>
      </div>

      {top.length ? (
        <Block
          title="Top of the pool"
          note="by the rankings"
          right={
            <button type="button" className={s.linkBtn} style={{ fontSize: 12 }} onClick={() => open({ kind: "overview", lens: "pool" })}>
              Rankings →
            </button>
          }
        >
          <table className={s.table}>
            <tbody>
              {top.map((p) => (
                <tr key={p.id} className={s.click} onClick={() => open({ kind: "player", id: p.id })}>
                  <td className={s.muted} style={{ width: 28 }}>
                    {p.rank}
                  </td>
                  <td className={s.text}>
                    <span className={s.inline}>
                      <Headshot nbaId={p.id} name={p.player_name} size={22} />
                      {p.player_name}
                    </span>
                  </td>
                  <td className={s.muted}>
                    {p.team}
                    {p.position ? ` · ${p.position}` : ""}
                  </td>
                  <td>{p.gp ?? "—"} gp</td>
                  <td className={s.strong}>{p.score != null && p.categories ? p.score.toFixed(1) : p.avg_fpts.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>
      ) : null}
    </div>
  );
}

function TrendList({ rows, loading, open }: { rows: Array<{ player_id: number; player_name: string; team: string | null; current_ownership: number; change: number }>; loading: boolean; open: (f: Focus) => void }) {
  if (loading) return <Skeleton rows={5} className={s.ledgerSkel} />;
  if (rows.length === 0) return <div className={s.blockEmpty}>Nothing moved this week.</div>;
  return (
    <table className={s.table}>
      <tbody>
        {rows.slice(0, 8).map((p) => (
          <tr key={p.player_id} className={s.click} onClick={() => open({ kind: "player", id: p.player_id })}>
            <td className={s.text}>
              <span className={s.inline}>
                <Headshot nbaId={p.player_id} name={p.player_name} size={22} />
                {p.player_name}
              </span>
            </td>
            <td className={s.muted}>{p.team ?? ""}</td>
            <td>{p.current_ownership.toFixed(1)}%</td>
            <td className={p.change > 0 ? s.best : s.worst}>{fmtDelta(p.change)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
