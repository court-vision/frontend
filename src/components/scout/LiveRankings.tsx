"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Headshot } from "@/components/desk/Headshot";
import { TeamLogo } from "@/components/desk/TeamLogo";
import { useLiveRankingsQuery } from "@/hooks/useScout";
import { userMessage } from "@/lib/api-error";
import {
  LIVE_BOARDS,
  LIVE_SORTS,
  comparedText,
  dayTicks,
  espnAgeText,
  filterLive,
  flagText,
  fmtPlaces,
  gapText,
  lastDay,
  liveMovers,
  liveRows,
  loneDays,
  nearestPoint,
  rankChart,
  rankChartSummary,
  rankPoints,
  spreadLabels,
  widestGap,
  type LiveBoard,
  type LiveRow,
  type RankPoint,
} from "@/lib/live-rankings";
import { dow, fmtStat, monthDay, type Focus, type PosFilter } from "@/lib/scout";
import { healthOf } from "@/lib/week-grid";
import type { LivePlayerRankData } from "@/types/scout";
import { Block, MiniRail, MoveChip, Skeleton, Tape } from "./blocks";
import type { PoolBoard, PoolConfig } from "./useScoutStore";
import dk from "@/components/desk/desk.module.css";
import s from "./scout.module.css";

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

const POOL_BOARDS: ReadonlyArray<{ v: PoolBoard; label: string; title: string }> = [
  { v: "season", label: "SO FAR", title: "What players have scored this season, or over a span of it" },
  { v: "live", label: "REST OF SEASON", title: "Court Vision's live rankings: each player priced from today to the end of the season, rebuilt every morning" },
];

/** Which of Scout's two rankings the board shows: what has happened, or what is left. */
export function BoardRail({ board, setBoard }: { board: PoolBoard; setBoard: (board: PoolBoard) => void }) {
  return <MiniRail label="Rankings board" value={board} options={POOL_BOARDS} onChange={setBoard} />;
}

const BOARD_OPTIONS = LIVE_BOARDS.map((b) => ({ v: b.id, label: b.label, title: b.title }));
const NO_EARLIER_BOARD = "No earlier board near enough to measure against";

/** The availability flag a board was built with; nothing for a player who plays. */
function Flag({ status }: { status: string | null }) {
  const text = flagText(status);
  if (!text) return null;
  return (
    <span className={`${dk.chip} ${healthOf(status) === "out" ? dk.down : dk.warnChip}`} title="His availability when the board was built">
      {text}
    </span>
  );
}

/** Places gained as a chip, and a dash where the board had nothing to measure against. */
function Moved({ places }: { places: number | null }) {
  if (places == null) {
    return (
      <span className={s.muted} title={NO_EARLIER_BOARD}>
        —
      </span>
    );
  }
  return <MoveChip change={places} />;
}

/** A signed count of places, green up and red down. */
function Signed({ places }: { places: number | null | undefined }) {
  return <span style={{ color: places == null || places === 0 ? undefined : places > 0 ? "var(--up)" : "var(--down)" }}>{fmtPlaces(places)}</span>;
}

const valueLabel = (board: LiveBoard) => (board === "points" ? "FPTS" : "INDEX");
const VALUE_TITLE = "Per game from the board's day on: fantasy points on the points board, the nine-category index on the 9-cat board";

// ---------------------------------------------------------------------------
// The rest-of-season board
// ---------------------------------------------------------------------------

export interface LivePoolOverviewProps {
  config: PoolConfig;
  setConfig: (patch: Partial<PoolConfig>) => void;
  focus: Focus | null;
  open: (focus: Focus) => void;
}

/** Court Vision's rest-of-season rankings as stored this morning, with each player's move and ESPN's rank beside him. */
export function LivePoolOverview({ config, setConfig, focus, open }: LivePoolOverviewProps) {
  const live = useLiveRankingsQuery();
  const data = live.data ?? null;
  const board: LiveBoard = config.format;
  const rows = useMemo(() => liveRows(data?.players, board), [data, board]);
  const shown = useMemo(() => filterLive(rows, config.pos, config.liveSort), [rows, config.pos, config.liveSort]);
  const movers = useMemo(() => liveMovers(rows, "day", 1), [rows]);
  const gap = useMemo(() => widestGap(rows), [rows]);
  const up = movers.up[0] ?? null;
  const down = movers.down[0] ?? null;
  const day = data?.compared?.day ?? null;
  const week = data?.compared?.week ?? null;
  const player = (r: LiveRow) => () => open({ kind: "player", id: r.id });

  return (
    <div className={s.sheetInner}>
      <header className={s.head}>
        <div className={s.headBody}>
          <div className={s.headName}>
            <span>Rankings</span>
            <span className={dk.sub}>
              {data?.season ?? ""}
              {" · rest of season"}
              {data?.as_of ? ` · as of ${monthDay(data.as_of)}` : ""}
              {data?.espn_as_of && data.espn_as_of !== data.as_of ? ` · ESPN's ranks from ${monthDay(data.espn_as_of)}` : ""}
            </span>
          </div>
          <span className={s.headSub}>Where each player ranks from today to the end of the season, rebuilt every morning from box scores and availability. ESPN&apos;s own rank that day sits beside ours.</span>
          <div className={s.headMeta} style={{ gap: 10 }}>
            <span className={s.inline} style={{ gap: 6 }}>
              <span className={dk.label}>Board</span>
              <BoardRail board={config.board} setBoard={(v) => setConfig({ board: v })} />
            </span>
            <span className={s.inline} style={{ gap: 6 }}>
              <span className={dk.label}>Score</span>
              <MiniRail label="Scoring" value={board} options={BOARD_OPTIONS} onChange={(v) => setConfig({ format: v })} />
            </span>
            <span className={s.inline} style={{ gap: 6 }}>
              <span className={dk.label}>Pos</span>
              <MiniRail label="Position" value={config.pos} options={(["ALL", "G", "F", "C"] as PosFilter[]).map((p) => ({ v: p, label: p }))} onChange={(v) => setConfig({ pos: v })} />
            </span>
            <span className={s.inline} style={{ gap: 6 }}>
              <span className={dk.label}>Sort</span>
              <MiniRail label="Sort" value={config.liveSort} options={LIVE_SORTS} onChange={(v) => setConfig({ liveSort: v })} />
            </span>
          </div>
        </div>
      </header>

      <Tape
        ticks={[
          { label: "Pool", value: rows.length ? rows.length.toLocaleString("en-US") : "—", sub: "ranked rest of season" },
          {
            label: "Moves since",
            value: day ? monthDay(day) : "—",
            sub: week ? `and ${monthDay(week)} for the week` : day ? "no board a week back yet" : "no earlier board yet",
          },
          {
            label: "Riser of the day",
            value: up ? (
              <span className={s.inline}>
                <MoveChip change={up.day} /> {up.name}
              </span>
            ) : (
              "—"
            ),
            sub: up ? `now #${up.rank}` : day ? "nobody near the top moved" : "moves need an earlier board",
            onClick: up ? player(up) : undefined,
          },
          {
            label: "Faller",
            value: down ? (
              <span className={s.inline}>
                <MoveChip change={down.day} /> {down.name}
              </span>
            ) : (
              "—"
            ),
            sub: down ? `now #${down.rank}` : undefined,
            onClick: down ? player(down) : undefined,
          },
          {
            label: "Widest gap to ESPN",
            value: gap ? gap.name : "—",
            sub: gap ? `#${gap.rank} here · #${gap.espnRank} at ESPN` : "inside the top 100",
            onClick: gap ? player(gap) : undefined,
          },
        ]}
      />

      <Block title="Board" note={`${shown.length} shown · ${comparedText(data?.compared)} · click a row for the player`}>
        {live.isLoading ? (
          <Skeleton rows={12} className={s.ledgerSkel} />
        ) : live.error ? (
          <div className={dk.error}>{userMessage(live.error, "Couldn't load the rest-of-season rankings")}</div>
        ) : !data?.as_of ? (
          <div className={s.blockEmpty}>No rest-of-season board is stored for this season yet. One is built every morning once games are played.</div>
        ) : shown.length === 0 ? (
          <div className={s.blockEmpty}>{rows.length === 0 ? "Nobody is ranked on this board." : "No players at this position."}</div>
        ) : (
          <div className={s.tableWrap}>
            <table className={`${s.table} ${s.board}`}>
              <thead>
                <tr>
                  <th>#</th>
                  <th className={s.text}>PLAYER</th>
                  <th className={s.text}>TEAM</th>
                  <th className={s.text}>POS</th>
                  <th title={VALUE_TITLE}>{valueLabel(board)}</th>
                  <th title="Games he is expected to play from the board's day on">GAMES</th>
                  <th title="Places gained since the previous stored board">1D</th>
                  <th title="Places gained since the board of a week ago">7D</th>
                  <th title={board === "points" ? "ESPN's own points rank that day" : "ESPN's own roto rank that day"}>ESPN</th>
                  <th title="ESPN's rank minus ours: positive when Court Vision has him higher">VS ESPN</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const on = focus?.kind === "player" && focus.id === r.id;
                  return (
                    <tr key={r.id} className={`${s.click} ${on ? s.on : ""}`} onClick={player(r)}>
                      <td className={s.muted}>{r.rank}</td>
                      <td className={s.text}>
                        <span className={s.inline}>
                          <Headshot nbaId={r.id} name={r.name} size={22} />
                          {r.name}
                          <Flag status={r.status} />
                        </span>
                      </td>
                      <td className={s.text}>
                        {r.team ? (
                          <span className={s.inline} style={{ gap: 5 }}>
                            <TeamLogo abbrev={r.team} size={14} />
                            {r.team}
                          </span>
                        ) : (
                          <span className={s.muted}>FA</span>
                        )}
                      </td>
                      <td className={s.text}>{r.position ?? ""}</td>
                      <td className={s.strong}>{fmtStat(r.value)}</td>
                      <td>{fmtStat(r.games, 0)}</td>
                      <td>
                        <Moved places={r.day} />
                      </td>
                      <td>
                        <Moved places={r.week} />
                      </td>
                      <td>{r.espnRank != null ? r.espnRank : <span className={s.muted}>—</span>}</td>
                      <td title={gapText(r.gap) ?? "ESPN does not rank him"}>{r.gap != null ? fmtPlaces(r.gap) : <span className={s.muted}>—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Block>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The front sheet: who moved this morning
// ---------------------------------------------------------------------------

/** This morning's biggest risers and fallers on the rest-of-season board. Nothing before the first board is stored. */
export function LiveMovers({ board, open, onBoard }: { board: LiveBoard; open: (focus: Focus) => void; onBoard: () => void }) {
  const live = useLiveRankingsQuery();
  const data = live.data ?? null;
  const rows = useMemo(() => liveRows(data?.players, board), [data, board]);
  const movers = useMemo(() => liveMovers(rows, "day", 8), [rows]);
  if (!live.isLoading && !data?.as_of) return null;
  const day = data?.compared?.day ?? null;
  const note = `rest-of-season rank${day ? ` · since ${monthDay(day)}` : ""}`;
  const empty = day ? "Nobody near the top moved." : "Moves show once a second morning's board is stored.";
  return (
    <div className={s.two}>
      <Block
        title="Rising"
        note={note}
        right={
          <button type="button" className={s.linkBtn} style={{ fontSize: 12, whiteSpace: "nowrap" }} onClick={onBoard}>
            Rest of season <ArrowRight size={11} />
          </button>
        }
      >
        <MoverList rows={movers.up} loading={live.isLoading} empty={empty} open={open} />
      </Block>
      <Block title="Falling" note={note}>
        <MoverList rows={movers.down} loading={live.isLoading} empty={empty} open={open} />
      </Block>
    </div>
  );
}

function MoverList({ rows, loading, empty, open }: { rows: LiveRow[]; loading: boolean; empty: string; open: (focus: Focus) => void }) {
  if (loading) return <Skeleton rows={5} className={s.ledgerSkel} />;
  if (rows.length === 0) return <div className={s.blockEmpty}>{empty}</div>;
  return (
    <table className={s.table}>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className={s.click} onClick={() => open({ kind: "player", id: r.id })}>
            <td className={s.text}>
              <span className={s.inline}>
                <Headshot nbaId={r.id} name={r.name} size={22} />
                {r.name}
              </span>
            </td>
            <td className={s.muted}>{r.team ?? ""}</td>
            <td>#{r.rank}</td>
            <td>
              <MoveChip change={r.day} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// A player's sheet: his rank now and over the season
// ---------------------------------------------------------------------------

function Tile({ label, value, sub, lead = false, title }: { label: string; value: React.ReactNode; sub?: React.ReactNode; lead?: boolean; title?: string }) {
  return (
    <div className={`${s.stat} ${lead ? s.statLead : ""}`} title={title}>
      <span className={s.statLabel}>{label}</span>
      <span className={s.statValue}>{value}</span>
      <span className={s.statDelta}>{sub}</span>
    </div>
  );
}

export interface RankBlockProps {
  /** The player's live ranking; null when the backend does not know him, undefined before it has answered. */
  data: LivePlayerRankData | null | undefined;
  /** Still to come: the request is out, or held until the sheet rests. */
  loading: boolean;
  error: unknown;
  name: string;
  /** The board shown first: the pool's own format. */
  board: LiveBoard;
}

/** Where Court Vision ranks one player for the rest of the season, against ESPN, today and on every stored day. */
export function RankBlock({ data, loading, error, name, board: first }: RankBlockProps) {
  const [picked, setPicked] = useState<LiveBoard | null>(null);
  const board = picked ?? first;
  const points = useMemo(() => rankPoints(data, board), [data, board]);
  const rail = <MiniRail label="Rankings board" value={board} options={BOARD_OPTIONS} onChange={setPicked} />;

  if (loading && !data) {
    return (
      <Block title="Court Vision rank" note="rest of season" right={rail}>
        <Skeleton rows={3} className={s.ledgerSkel} />
      </Block>
    );
  }
  if (error && !data) {
    return (
      <Block title="Court Vision rank" note="rest of season">
        <div className={s.blockEmpty}>{userMessage(error, "Couldn't load his rest-of-season rank")}</div>
      </Block>
    );
  }
  if (!data?.as_of) {
    return (
      <Block title="Court Vision rank" note="rest of season">
        <div className={s.blockEmpty}>{data ? "No rest-of-season board is stored for this season yet." : "Court Vision has no rest-of-season rank for this player."}</div>
      </Block>
    );
  }

  const place = data[board];
  const espn = data.espn?.[board] ?? null;
  const gap = place && espn ? espn.rank - place.rank : null;
  const boardName = board === "points" ? "points" : "9-cat";
  const note = `rest of season · as of ${monthDay(data.as_of)}`;

  if (!place && !points.length) {
    return (
      <Block title="Court Vision rank" note={note} right={rail}>
        <div className={s.blockEmpty}>Not on the {boardName} board this season: it ranks the players with enough games to price.</div>
      </Block>
    );
  }

  const lastRanked = lastDay(points, "cv");

  return (
    <Block title="Court Vision rank" note={note} right={rail}>
      {place ? (
        <div className={`${s.line} ${s.rankLine}`}>
          <Tile
            label="Rank"
            lead
            value={`#${place.rank}`}
            sub={
              <>
                1D <Signed places={place.move_1d} /> · 7D <Signed places={place.move_7d} />
              </>
            }
            title={comparedText(data.compared)}
          />
          <Tile label="ESPN" value={espn ? `#${espn.rank}` : "—"} sub={espn ? espnAgeText(espn) : "not ranked by ESPN"} title={board === "points" ? "ESPN's own points rank" : "ESPN's own roto rank"} />
          <Tile label="Vs ESPN" value={fmtPlaces(gap)} sub={gapText(gap) ?? ""} title="ESPN's rank minus ours: positive when Court Vision has him higher" />
          <Tile label={`${valueLabel(board)} / G`} value={fmtStat(place.value)} sub="from today on" title={VALUE_TITLE} />
          <Tile
            label="Games left"
            value={fmtStat(data.games, 0)}
            sub={
              <>
                {data.season_gp != null ? `${data.season_gp} played` : ""}
                {flagText(data.injury_status) ? `${data.season_gp != null ? " · " : ""}${flagText(data.injury_status)} when built` : ""}
              </>
            }
            title="Games he is expected to play from the board's day to the end of the season"
          />
        </div>
      ) : (
        <div className={s.blockEmpty}>
          Not on this morning&apos;s {boardName} board.
          {lastRanked >= 0 ? ` He was last on it at #${points[lastRanked].cv}, on ${monthDay(points[lastRanked].day)}.` : ""}
          {espn ? ` ESPN has him #${espn.rank}.` : ""}
        </div>
      )}
      <RankChart points={points} name={name} board={board} />
    </Block>
  );
}

// ---------------------------------------------------------------------------
// Rank over time
// ---------------------------------------------------------------------------

const CHART_H = 168;
const CHART_PAD = { top: 14, right: 46, bottom: 24, left: 40 };
/** The chart's width before it has been measured (the server's render, and the first frame). */
const CHART_W = 720;

/** The width an element is laid out at, kept current as it resizes. */
function useWidth<T extends HTMLElement>(): [(el: T | null) => void, number] {
  const [el, setEl] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return [setEl, width];
}

const readout = (rank: number | null) => (rank == null ? "—" : `#${rank}`);

/**
 * One player's rank on every stored day: ours as the line, ESPN's as a dashed
 * reference under it, rank 1 at the top. The row beneath names both and reads
 * the day under the pointer (the newest when there is none); the arrow keys
 * walk the days when the chart has the focus.
 */
function RankChart({ points, name, board }: { points: RankPoint[]; name: string; board: LiveBoard }) {
  const [ref, measured] = useWidth<HTMLDivElement>();
  const [at, setAt] = useState<number | null>(null);
  const width = measured || CHART_W;
  const geometry = useMemo(() => rankChart(points, width, CHART_H, CHART_PAD), [points, width]);
  if (!geometry) return null;

  const last = points.length - 1;
  const active = at != null && at <= last ? at : last;
  const point = points[active];
  const endCv = lastDay(points, "cv");
  const endEspn = lastDay(points, "espn");
  // A label beside a line's end only where the line reaches the plot's right edge; elsewhere it would print over the other line.
  const [labelCv, labelEspn] = spreadLabels(
    endCv === last ? geometry.y(points[endCv].cv as number) : null,
    endEspn === last ? geometry.y(points[endEspn].espn as number) : null
  );
  const right = width - CHART_PAD.right;
  const dayText = `${dow(point.day)} ${monthDay(point.day)}`;

  const move = (to: number) => setAt(Math.max(0, Math.min(last, to)));
  const onKey = (e: React.KeyboardEvent) => {
    const to = e.key === "ArrowLeft" ? active - 1 : e.key === "ArrowRight" ? active + 1 : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (to == null) return;
    // The arrows here walk the chart's days, not the desk's players.
    e.preventDefault();
    e.stopPropagation();
    move(to);
  };

  return (
    <div className={s.rank}>
      <div
        ref={ref}
        className={s.rankPlot}
        role="slider"
        tabIndex={0}
        aria-label={`${name}'s rank by stored day`}
        aria-valuemin={0}
        aria-valuemax={last}
        aria-valuenow={active}
        aria-valuetext={`${dayText}: Court Vision ${point.cv ?? "not ranked"}, ESPN ${point.espn ?? "not ranked"}`}
        onKeyDown={onKey}
        onBlur={() => setAt(null)}
      >
        <svg
          className={s.rankSvg}
          viewBox={`0 0 ${width} ${CHART_H}`}
          height={CHART_H}
          aria-hidden
          onPointerMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            setAt(nearestPoint(points, geometry, ((e.clientX - box.left) / box.width) * width));
          }}
          onPointerLeave={() => setAt(null)}
        >
          {geometry.ticks.map((t) => (
            <g key={t}>
              <line className={s.rankRule} x1={CHART_PAD.left} x2={right} y1={geometry.y(t)} y2={geometry.y(t)} />
              <text className={s.chartAxis} x={CHART_PAD.left - 8} y={geometry.y(t) + 3.5} textAnchor="end">
                #{t}
              </text>
            </g>
          ))}
          {dayTicks(points, geometry).map((i) => (
            <text key={points[i].day} className={s.chartAxis} x={geometry.x(points[i].day)} y={CHART_H - 6} textAnchor={i === 0 && last > 0 ? "start" : i === last && last > 0 ? "end" : "middle"}>
              {monthDay(points[i].day)}
            </text>
          ))}
          {at != null ? <line className={s.rankCross} x1={geometry.x(point.day)} x2={geometry.x(point.day)} y1={CHART_PAD.top - 4} y2={CHART_H - CHART_PAD.bottom + 4} /> : null}
          {geometry.espn.map((d, i) => (
            <path key={`espn-${i}`} className={s.rankEspn} d={d} />
          ))}
          {geometry.cv.map((d, i) => (
            <path key={`cv-${i}`} className={s.rankCv} d={d} />
          ))}
          {loneDays(points, "espn").map((i) => (
            <circle key={`espn-lone-${i}`} className={s.rankDotEspn} cx={geometry.x(points[i].day)} cy={geometry.y(points[i].espn as number)} r={3.5} />
          ))}
          {loneDays(points, "cv").map((i) => (
            <circle key={`cv-lone-${i}`} className={s.rankDotCv} cx={geometry.x(points[i].day)} cy={geometry.y(points[i].cv as number)} r={3.5} />
          ))}
          {endEspn >= 0 ? <circle className={s.rankDotEspn} cx={geometry.x(points[endEspn].day)} cy={geometry.y(points[endEspn].espn as number)} r={4} /> : null}
          {endCv >= 0 ? <circle className={s.rankDotCv} cx={geometry.x(points[endCv].day)} cy={geometry.y(points[endCv].cv as number)} r={4.5} /> : null}
          {active !== endEspn && point.espn != null ? <circle className={s.rankDotEspn} cx={geometry.x(point.day)} cy={geometry.y(point.espn)} r={4} /> : null}
          {active !== endCv && point.cv != null ? <circle className={s.rankDotCv} cx={geometry.x(point.day)} cy={geometry.y(point.cv)} r={4.5} /> : null}
          {labelEspn != null ? (
            <text className={s.rankEnd} data-ref x={right + 9} y={labelEspn + 3.5}>
              #{points[endEspn].espn}
            </text>
          ) : null}
          {labelCv != null ? (
            <text className={s.rankEnd} x={right + 9} y={labelCv + 3.5}>
              #{points[endCv].cv}
            </text>
          ) : null}
        </svg>
      </div>
      <div className={`${s.chartHover} ${s.rankReadout}`}>
        <span style={{ color: "var(--text)" }}>{dayText}</span>
        <span className={s.rankKey}>
          <span className={s.rankSwatch} />
          Court Vision <span style={{ color: "var(--text)" }}>{readout(point.cv)}</span>
        </span>
        <span className={s.rankKey}>
          <span className={s.rankSwatch} data-ref />
          ESPN <span style={{ color: "var(--text)" }}>{readout(point.espn)}</span>
        </span>
        <span className={dk.spacer} />
        <span>
          {points.length} stored {points.length === 1 ? "day" : "days"} · rank 1 at the top
        </span>
      </div>
      <table className={s.srOnly}>
        <caption>{rankChartSummary(points, name, board)}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Court Vision rank</th>
            <th scope="col">ESPN rank</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.day}>
              <th scope="row">{monthDay(p.day)}</th>
              <td>{p.cv ?? (p.cvStored ? "not ranked" : "no board stored")}</td>
              <td>{p.espn ?? (p.espnStored ? "not ranked" : "no ranks stored")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
