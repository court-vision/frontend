"use client";

import { Fragment } from "react";
import { Lock } from "lucide-react";
import {
  dayRange,
  matchupSpan,
  ordinal,
  pct,
  pts,
  rankTone,
  signedPts,
  tierEdge,
  trackPos,
  type TierRow,
  type Track,
} from "@/lib/team-desk";
import type { LeagueProjectionData, LinePlayerValue, StreamingLineData, ValueWindowKey } from "@/types/team-desk";
import dk from "@/components/desk/desk.module.css";
import s from "./team.module.css";

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

export function Pane({ title, sub, className, children }: { title: string; sub?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={`${s.pane} ${className ?? ""}`} aria-label={title}>
      <header className={s.phead}>
        <span className={dk.label} style={{ color: "var(--text-2)" }}>
          {title}
        </span>
        {sub ? <span className={s.psub}>{sub}</span> : null}
      </header>
      {children}
    </section>
  );
}

export function PaneSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className={s.skel} aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className={dk.skel} style={{ width: `${88 - ((i * 13) % 40)}%` }} />
      ))}
    </div>
  );
}

export function PaneError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className={s.paneError}>
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

function RankChip({ rank, teams }: { rank: number | null | undefined; teams: number }) {
  if (rank == null) return <span className={`${dk.chip} ${dk.flat} ${s.rankChip}`}>–</span>;
  const tone = rankTone(rank, teams);
  return (
    <span className={`${dk.chip} ${tone === "up" ? dk.up : tone === "down" ? dk.down : dk.flat} ${s.rankChip}`} title={`${ordinal(rank)} of ${teams}`}>
      {ordinal(rank)}
    </span>
  );
}

const INJURY_SHORT: Record<string, string> = { OUT: "OUT", DAY_TO_DAY: "DTD", QUESTIONABLE: "Q", DOUBTFUL: "D", SUSPENSION: "SUSP" };

function InjuryChip({ status }: { status: string | null | undefined }) {
  if (!status || status === "ACTIVE") return null;
  const short = INJURY_SHORT[status] ?? status.slice(0, 4);
  return <span className={`${dk.chip} ${status === "OUT" || status === "SUSPENSION" ? dk.down : s.warnChip} ${s.injury}`}>{short}</span>;
}

/** "J. Murray" where the row is tight; the full name is the title. */
function shortName(name: string): string {
  const parts = name.split(" ");
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

// ---------------------------------------------------------------------------
// The tape: the season against the league's
// ---------------------------------------------------------------------------

function Tile({ label, value, sub, title }: { label: string; value: React.ReactNode; sub: React.ReactNode; title?: string }) {
  return (
    <div className={s.tile} title={title}>
      <span className={dk.label}>{label}</span>
      <span className={s.tileV}>{value}</span>
      <span className={s.tileS}>{sub}</span>
    </div>
  );
}

export function Tape({ p, tiers, starters, windowLabel }: { p: LeagueProjectionData | undefined; tiers: TierRow[] | null; starters: number; windowLabel: string }) {
  if (!p) {
    return (
      <div className={s.tape} aria-busy>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={s.tile}>
            <span className={dk.skel} style={{ width: "55%" }} />
            <span className={dk.skel} style={{ width: "70%", height: 18 }} />
            <span className={dk.skel} style={{ width: "80%" }} />
          </div>
        ))}
      </div>
    );
  }
  const me = p.teams.find((t) => t.mine) ?? null;
  const n = p.teams_count || p.teams.length;
  const rs = p.benchmarks.regular_season;
  const po = p.benchmarks.playoffs;
  const bestTeam = p.teams.find((t) => !t.mine && t.regular_season_rank === 1)?.team_name ?? (me?.regular_season_rank === 1 ? "you" : null);
  const firstPo = p.playoff_matchups[0];
  const lastPo = p.playoff_matchups[p.playoff_matchups.length - 1];
  const poLabel = firstPo != null ? `Playoffs · ${matchupSpan(firstPo, lastPo)}` : "Playoffs";
  const pfRank = me?.points_for != null ? 1 + p.teams.filter((t) => (t.points_for ?? -Infinity) > me.points_for!).length : null;
  const paRank = me?.points_against != null ? 1 + p.teams.filter((t) => (t.points_against ?? -Infinity) > me.points_against!).length : null;
  const vsLine = (b: typeof rs) => {
    if (b.you == null || b.line == null) return "";
    const d = b.you - b.line;
    if (b.rank === p.playoff_teams) return "you are the playoff line";
    return d >= 0 ? `${signedPts(d)} over the playoff line (${ordinal(p.playoff_teams)})` : `${pts(-d)} under the playoff line (${ordinal(p.playoff_teams)})`;
  };
  const edge = tiers ? tierEdge(tiers, starters) : null;
  return (
    <div className={s.tape}>
      <Tile
        label="Projected week"
        value={
          <>
            {pts(rs.you)}
            <small>{rs.rank ? `${ordinal(rs.rank)} of ${n}` : ""}</small>
          </>
        }
        sub={vsLine(rs)}
        title="Your typical regular-season week from here on, every roster projected the same way"
      />
      <Tile
        label="Against the league"
        value={
          <>
            <span className={rs.you != null && rs.median != null && rs.you >= rs.median ? s.upText : s.downText}>{rs.you != null && rs.median != null ? signedPts(rs.you - rs.median) : "–"}</span>
            <small>vs the median</small>
          </>
        }
        sub={`median ${pts(rs.median)} · best ${pts(rs.best)}${rs.you != null && rs.best != null && rs.rank !== 1 ? ` (${signedPts(rs.you - rs.best)})` : ""}`}
        title={`Your typical week against the league's median roster and its best${bestTeam ? ` (${bestTeam})` : ""}`}
      />
      <Tile
        label={poLabel}
        value={
          <>
            {pts(po.you)}
            <small>{po.rank ? ordinal(po.rank) : ""}</small>
          </>
        }
        sub={vsLine(po)}
        title="Your typical week in the playoff matchups, against every roster's"
      />
      <Tile
        label="Playoff odds"
        value={
          <>
            {pct(me?.playoff_odds)}
            <small>title {pct(me?.title_odds)}</small>
          </>
        }
        sub={`${me?.projected_wins != null ? `${me.projected_wins.toFixed(1)} wins projected · ` : ""}${p.simulations.toLocaleString("en-US")} seasons`}
        title={`${p.playoff_teams} of ${n} make the playoffs`}
      />
      <Tile
        label="Scored so far"
        value={
          <>
            {pts(me?.points_for)}
            <small>{pfRank ? ordinal(pfRank) : ""}</small>
          </>
        }
        sub={me ? `${me.wins}–${me.losses}${me.ties ? `–${me.ties}` : ""}${me.standing ? ` · ${ordinal(me.standing)}` : ""} · ${pts(me.points_against)} against${paRank ? `, ${ordinal(paRank)}-most` : ""}` : ""}
      />
      <Tile
        label={`Your top ${starters} · ${windowLabel}`}
        value={
          edge ? (
            <>
              <span className={edge.total >= 0 ? s.upText : s.downText}>{signedPts(edge.total)}</span>
              <small>vs the league</small>
            </>
          ) : (
            <span className={dk.skel} style={{ width: 90, height: 18 }} />
          )
        }
        sub={edge ? `ahead at ${edge.ahead} of ${edge.tiers} tiers` : ""}
        title={`Your 1st to ${ordinal(starters)} best players against the league's average 1st to ${ordinal(starters)} best, over the window`}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Where your points come from
// ---------------------------------------------------------------------------

export function Tracks({ tracks }: { tracks: Track[] }) {
  return (
    <div className={s.tracks}>
      <div className={s.trackHead}>
        <span />
        <span className={s.trackEnds}>
          <span>league worst</span>
          <span>best</span>
        </span>
        <span />
        <span />
      </div>
      {tracks.map((t) => (
        <div key={t.id} className={s.trackRow} title={`${t.note}. League median ${pts(t.median)}, playoff line ${pts(t.line)}, best ${pts(t.best)}, worst ${pts(t.worst)}.`}>
          <span className={s.trackLabel}>{t.label}</span>
          <span className={s.track}>
            <span className={s.trackRule} />
            <span className={s.trackMedian} style={{ left: `${trackPos(t.median, t)}%` }} />
            <span className={s.trackLine} style={{ left: `${trackPos(t.line, t)}%` }} />
            <span className={s.trackYou} style={{ left: `${trackPos(t.you, t)}%` }} />
          </span>
          <span className={s.trackValue}>{pts(t.you)}</span>
          <RankChip rank={t.rank} teams={t.teams} />
        </div>
      ))}
      <div className={s.trackKey}>
        <span>
          <i className={s.keyMedian} /> median
        </span>
        <span>
          <i className={s.keyLine} /> playoff line
        </span>
        <span>
          <i className={s.keyYou} /> you
        </span>
        <span className={s.trackKeyNote}>Right is better on every row</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Your roster by tier
// ---------------------------------------------------------------------------

export function Tiers({ rows, starters }: { rows: TierRow[]; starters: number }) {
  const scale = Math.max(1, ...rows.map((r) => Math.abs(r.diff ?? 0)));
  const edge = tierEdge(rows, starters);
  return (
    <>
      <table className={`${s.table} ${s.tierTable}`}>
        <thead>
          <tr>
            <th className={s.l}>#</th>
            <th className={s.l}>Player</th>
            <th title="Points over the window">Pts</th>
            <th title="The league's average Nth best">League</th>
            <th className={s.c}>vs league</th>
            <th />
            <th title="Your Nth best among the league's Nth bests">Rank</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const d = r.diff ?? 0;
            const w = Math.min(46, (Math.abs(d) / scale) * 46);
            return (
              <Fragment key={r.tier}>
                {r.tier === starters + 1 ? (
                  <tr className={s.ruleRow} aria-hidden>
                    <td colSpan={7}>
                      <span className={`${s.ruleLabel} ${s.benchRule}`}>your bench · the {ordinal(starters + 1)} best on</span>
                    </td>
                  </tr>
                ) : null}
                <tr>
                  <td className={`${s.l} ${s.dim}`}>{r.tier}</td>
                  <td className={s.l}>
                    {r.player ? (
                      <span className={s.playerCell} title={`${r.player.name}${r.player.nba_team ? ` · ${r.player.nba_team}` : ""} · ${r.player.games.toFixed(1)} of ${r.player.team_games} games`}>
                        <span className={s.pname}>{shortName(r.player.name)}</span>
                        <span className={s.ppos}>{r.player.positions.join("-")}</span>
                        <InjuryChip status={r.player.injury_status} />
                      </span>
                    ) : (
                      <span className={s.dim}>–</span>
                    )}
                  </td>
                  <td>{pts(r.you)}</td>
                  <td className={s.dim}>{pts(r.average)}</td>
                  <td className={s.c}>
                    <span className={s.diverge}>
                      <span className={s.divergeAxis} />
                      {r.diff != null ? <i className={d >= 0 ? s.divergeUp : s.divergeDown} style={d >= 0 ? { left: "50%", width: w } : { right: "50%", width: w }} /> : null}
                    </span>
                  </td>
                  <td className={d > 0.05 ? s.upText : d < -0.05 ? s.downText : s.dim}>{signedPts(r.diff)}</td>
                  <td className={s.dim}>{r.rank ?? "–"}</td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {edge.best || edge.worst ? (
        <p className={s.foot}>
          {edge.best ? (
            <>
              Your {ordinal(edge.best.tier)} best is your biggest edge, <b className={s.upText}>{signedPts(edge.best.diff)}</b>
              {edge.worst ? ", and " : "."}
            </>
          ) : null}
          {edge.worst ? (
            <>
              {edge.best ? "your" : "Your"} {ordinal(edge.worst.tier)} best gives back the most, <b className={s.downText}>{signedPts(edge.worst.diff)}</b>.
            </>
          ) : null}
        </p>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// The streaming line
// ---------------------------------------------------------------------------

function LineRow({ p, line }: { p: LinePlayerValue; line: number | null }) {
  const d = line != null ? p.per_game - line : null;
  return (
    <tr className={p.below_line ? s.belowRow : undefined}>
      <td className={s.l}>
        <span className={s.playerCell} title={`${p.name}${p.nba_team ? ` · ${p.nba_team}` : ""}${p.protected ? " · protected: never dropped or streamed" : ""}`}>
          <span className={s.pname}>{shortName(p.name)}</span>
          <span className={s.ppos}>{p.positions.join("-")}</span>
          {p.on_ir ? <span className={`${dk.chip} ${dk.flat} ${s.injury}`}>IR</span> : <InjuryChip status={p.injury_status} />}
          {p.protected ? <Lock size={11} className={s.lock} aria-label="Protected" /> : null}
        </span>
      </td>
      <td>{p.per_game.toFixed(1)}</td>
      <td className={d == null ? s.dim : d >= 0 ? s.upText : s.downText}>{d == null || p.below_line == null ? "–" : signedPts(d)}</td>
      <td className={s.l}>
        {p.streamed_in.length ? (
          <span className={s.streamed} title="Matchups where the plan streams his spot, within your adds">
            {p.streamed_in.map((m) => (
              <span key={m} className={s.streamChip}>
                {m}
              </span>
            ))}
          </span>
        ) : (
          <span className={s.dim}>–</span>
        )}
      </td>
    </tr>
  );
}

export function StreamLine({ data, asked, readOver }: { data: StreamingLineData; asked: ValueWindowKey; readOver: ValueWindowKey }) {
  const players = data.players;
  const line = data.line;
  // The rule goes above the first player under the line
  const cut = line != null ? players.findIndex((p) => p.per_game < line && !p.on_ir) : -1;
  const span = matchupSpan(data.first_matchup, data.last_matchup);
  return (
    <>
      <div className={s.lineHero}>
        {line != null ? (
          <>
            <span className={s.lineV}>
              {line.toFixed(1)}
              <small>a game</small>
            </span>
            <span className={s.lineS}>
              What the free agents optimal streaming picks up score a game over {data.first_matchup === data.last_matchup ? "matchup" : "matchups"} {span}, within your adds.
              {data.line_low != null && data.line_low < line ? ` ${data.line_low.toFixed(1)} if the best of them is gone and you have one add fewer.` : ""}
            </span>
          </>
        ) : (
          <span className={s.lineS}>No stream lane is worth running over {data.first_matchup === data.last_matchup ? "matchup" : "matchups"} {span}: no free agent beats what your roster already plays.</span>
        )}
        {asked !== readOver ? <span className={s.lineNote}>The line looks four matchups ahead at most, so this is the next four.</span> : null}
      </div>
      <table className={s.table}>
        <thead>
          <tr>
            <th className={s.l}>Your player</th>
            <th title="His projected points per game">/game</th>
            <th title="His points per game minus the line">vs line</th>
            <th className={s.l} title="Matchups where the plan streams his spot, within your adds">Streamed in</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => (
            <LineFragment key={p.espn_id || p.name} p={p} line={line} rule={i === cut} />
          ))}
        </tbody>
      </table>
      <div className={s.lineMatchups}>
        {data.matchups.map((m) => (
          <div key={m.matchup} className={s.lineMatchup}>
            <span className={s.lmHead}>
              <b>{m.matchup}</b> {dayRange(m.start, m.end)}
            </span>
            <span className={s.lmBody}>
              {m.line != null ? `${m.line.toFixed(1)}/g · ` : ""}
              {m.worth_running ? `${m.worth_running} ${m.worth_running === 1 ? "lane" : "lanes"}` : "no lane"}
              {m.adds != null ? ` · ${m.adds} ${m.adds === 1 ? "add" : "adds"}` : ""}
              {m.streamed.length ? ` · streams ${m.streamed.map((x) => x.name.split(" ").slice(-1)[0]).join(", ")}` : ""}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function LineFragment({ p, line, rule }: { p: LinePlayerValue; line: number | null; rule: boolean }) {
  return (
    <>
      {rule && line != null ? (
        <tr className={s.ruleRow} aria-hidden>
          <td colSpan={4}>
            <span className={s.ruleLabel}>the line · {line.toFixed(1)} a game</span>
          </td>
        </tr>
      ) : null}
      <LineRow p={p} line={line} />
    </>
  );
}
