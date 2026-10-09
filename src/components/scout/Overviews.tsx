"use client";

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Headshot } from "@/components/desk/Headshot";
import { TeamLogo } from "@/components/desk/TeamLogo";
import { nbaTeamKeys } from "@/hooks/useNBATeam";
import { useOwnershipTrendingQuery } from "@/hooks/useOwnershipTrending";
import { useEspnMarketMoversQuery } from "@/hooks/useScout";
import { apiClient } from "@/lib/api";
import { formatCategoryValue } from "@/lib/category-format";
import { NBA_TEAMS } from "@/lib/nbaTeams";
import {
  MARKET_SECTIONS,
  filterPool,
  fmtDelta,
  fmtPctDot,
  fmtStat,
  standings,
  type Focus,
  type MarketSection,
  type PoolSort,
  type PosFilter,
  type StandingRow,
} from "@/lib/scout";
import type { RankingsMeta, RankingsPlayer, RankingsWindow } from "@/types/rankings";
import type { CategoryDef, ScoringFormat } from "@/types/scoring";
import { Block, MoveChip, Skeleton } from "./blocks";
import type { PoolConfig } from "./useScoutStore";
import dk from "@/components/desk/desk.module.css";
import s from "./scout.module.css";

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function Tape({ ticks }: { ticks: Array<{ label: string; value: React.ReactNode; sub?: React.ReactNode; onClick?: () => void }> }) {
  return (
    <div className={s.tape}>
      {ticks.map((t, i) => (
        <div key={i} className={`${s.tick} ${t.onClick ? s.tickClick : ""}`} onClick={t.onClick} role={t.onClick ? "button" : undefined} tabIndex={t.onClick ? 0 : undefined}>
          <span className={dk.label}>{t.label}</span>
          <span className={s.tickValue}>{t.value}</span>
          {t.sub ? <span className={s.tickSub}>{t.sub}</span> : null}
        </div>
      ))}
    </div>
  );
}

function MiniRail<T extends string | number | null>({ value, options, onChange, label }: { value: T; options: Array<{ v: T; label: string; title?: string }>; onChange: (v: T) => void; label: string }) {
  return (
    <div className={dk.rail} role="radiogroup" aria-label={label} style={{ padding: 1 }}>
      {options.map((o) => (
        <button key={String(o.v)} type="button" role="radio" aria-checked={o.v === value} className={`${dk.seg} ${o.v === value ? dk.segOn : ""}`} style={{ height: 24, padding: "0 8px", fontSize: 10.5 }} onClick={() => onChange(o.v)} title={o.title}>
          {o.v === value ? <span className={dk.segPill} /> : null}
          <span className={dk.segLabel}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pool: the rankings board
// ---------------------------------------------------------------------------

const SORTS: Array<{ v: PoolSort; label: string; title: string }> = [
  { v: "rank", label: "RANK", title: "By the rankings" },
  { v: "fpts", label: "AVG", title: "By per-game value" },
  { v: "change", label: "MOVERS", title: "By rank change over the week" },
  { v: "gp", label: "GP", title: "By games played" },
  { v: "name", label: "A–Z", title: "By name" },
];

const CAT_ORDER = ["pts", "reb", "ast", "stl", "blk", "tov", "fg3m", "fg_pct", "ft_pct"];

export interface PoolOverviewProps {
  rows: RankingsPlayer[];
  loading: boolean;
  error: string | null;
  message: string;
  meta: RankingsMeta | null;
  config: PoolConfig;
  setConfig: (patch: Partial<PoolConfig>) => void;
  categories: CategoryDef[];
  focus: Focus | null;
  open: (focus: Focus) => void;
}

export function PoolOverview({ rows, loading, error, message, meta, config, setConfig, categories, focus, open }: PoolOverviewProps) {
  const shown = useMemo(() => filterPool(rows, "", config.pos, config.sort), [rows, config.pos, config.sort]);
  const cats = config.format === "categories";
  const catCols = useMemo(() => {
    const byKey = new Map(categories.map((c) => [c.key, c]));
    return CAT_ORDER.map((k) => byKey.get(k)).filter((c): c is CategoryDef => !!c);
  }, [categories]);
  const hasCats = cats && rows.some((r) => r.categories);
  const movers = useMemo(() => {
    const up = [...rows].sort((a, b) => b.rank_change - a.rank_change)[0];
    const down = [...rows].sort((a, b) => a.rank_change - b.rank_change)[0];
    return { up: up && up.rank_change > 0 ? up : null, down: down && down.rank_change < 0 ? down : null };
  }, [rows]);
  const basis = meta?.scoring?.basis === "categories" ? "9-cat z-scores" : meta?.scoring?.basis === "league_points" ? "league points" : "fantasy points";

  return (
    <div className={s.sheetInner}>
      <header className={s.head}>
        <div className={s.headBody}>
          <div className={s.headName}>
            <span>Rankings</span>
            <span className={dk.sub}>
              {meta?.season ?? ""}
              {meta?.as_of ? ` · as of ${meta.as_of}` : ""}
              {meta?.window ? ` · last ${meta.window} days` : " · full season"}
            </span>
          </div>
          <div className={s.headMeta} style={{ gap: 10 }}>
            <span className={s.inline} style={{ gap: 6 }}>
              <span className={dk.label}>Score</span>
              <MiniRail label="Scoring" value={config.format} options={[{ v: "points" as ScoringFormat, label: "PTS", title: "Fantasy points, the platform formula" }, { v: "categories" as ScoringFormat, label: "9-CAT", title: "Summed category z-scores" }]} onChange={(v) => setConfig({ format: v })} />
            </span>
            <span className={s.inline} style={{ gap: 6 }}>
              <span className={dk.label}>Span</span>
              <MiniRail label="Span" value={config.span} options={[{ v: null as RankingsWindow, label: "SEASON" }, { v: 30 as RankingsWindow, label: "30D" }, { v: 14 as RankingsWindow, label: "14D" }, { v: 7 as RankingsWindow, label: "7D" }]} onChange={(v) => setConfig({ span: v })} />
            </span>
            <span className={s.inline} style={{ gap: 6 }}>
              <span className={dk.label}>Pos</span>
              <MiniRail label="Position" value={config.pos} options={(["ALL", "G", "F", "C"] as PosFilter[]).map((p) => ({ v: p, label: p }))} onChange={(v) => setConfig({ pos: v })} />
            </span>
            <span className={s.inline} style={{ gap: 6 }}>
              <span className={dk.label}>Sort</span>
              <MiniRail label="Sort" value={config.sort} options={SORTS} onChange={(v) => setConfig({ sort: v })} />
            </span>
          </div>
        </div>
      </header>

      <Tape
        ticks={[
          { label: "Pool", value: rows.length ? rows.length.toLocaleString("en-US") : "—", sub: "ranked players" },
          { label: "Basis", value: basis, sub: meta?.scoring?.league_name ?? "platform default" },
          { label: "Floor", value: meta?.min_games ? `${meta.min_games} GP` : "none", sub: meta?.max_gp ? `most played ${meta.max_gp}` : undefined },
          {
            label: "Riser of the week",
            value: movers.up ? <span className={s.inline}><MoveChip change={movers.up.rank_change} /> {movers.up.player_name}</span> : "—",
            sub: movers.up ? `now #${movers.up.rank}` : "ranks move after a week",
            onClick: movers.up ? () => open({ kind: "player", id: movers.up!.id }) : undefined,
          },
          {
            label: "Faller",
            value: movers.down ? <span className={s.inline}><MoveChip change={movers.down.rank_change} /> {movers.down.player_name}</span> : "—",
            sub: movers.down ? `now #${movers.down.rank}` : undefined,
            onClick: movers.down ? () => open({ kind: "player", id: movers.down!.id }) : undefined,
          },
        ]}
      />

      <Block title="Board" note={`${shown.length} shown · click a row for the player`}>
        {loading ? (
          <Skeleton rows={12} className={s.ledgerSkel} />
        ) : error ? (
          <div className={dk.error}>{error}</div>
        ) : shown.length === 0 ? (
          <div className={s.blockEmpty}>{rows.length === 0 ? message || "The pool is empty." : "No players at this position."}</div>
        ) : (
          <div className={s.tableWrap}>
            <table className={`${s.table} ${s.board}`}>
              <thead>
                <tr>
                  <th>#</th>
                  <th className={s.text}>PLAYER</th>
                  <th className={s.text}>TEAM</th>
                  <th className={s.text}>POS</th>
                  <th>GP</th>
                  <th>{cats ? "Z" : "FPTS"}</th>
                  {hasCats ? catCols.map((c) => <th key={c.key}>{c.label}</th>) : null}
                  <th>7D</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const f: Focus = { kind: "player", id: r.id };
                  const on = focus?.kind === "player" && focus.id === r.id;
                  return (
                    <tr key={r.id} className={`${s.click} ${on ? s.on : ""}`} onClick={() => open(f)}>
                      <td className={s.muted}>{r.rank}</td>
                      <td className={s.text}>
                        <span className={s.inline}>
                          <Headshot nbaId={r.id} name={r.player_name} size={22} />
                          {r.player_name}
                        </span>
                      </td>
                      <td className={s.text}>
                        <span className={s.inline} style={{ gap: 5 }}>
                          <TeamLogo abbrev={r.team} size={14} />
                          {r.team}
                        </span>
                      </td>
                      <td className={s.text}>{r.position ?? ""}</td>
                      <td>{r.gp ?? "—"}</td>
                      <td className={s.strong}>{cats ? fmtStat(r.score) : fmtStat(r.avg_fpts)}</td>
                      {hasCats
                        ? catCols.map((c) => {
                            const z = r.category_z?.[c.key];
                            return (
                              <td key={c.key} className={z != null && z > 1 ? s.best : z != null && z < -1 ? s.worst : ""} title={z != null ? `z ${fmtDelta(z, 2)}` : undefined}>
                                {formatCategoryValue(r.categories?.[c.key] ?? null, c)}
                              </td>
                            );
                          })
                        : null}
                      <td>
                        <MoveChip change={r.rank_change} />
                      </td>
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
// Teams: standings
// ---------------------------------------------------------------------------

export function TeamsOverview({ focus, open }: { focus: Focus | null; open: (focus: Focus) => void }) {
  const results = useQueries({
    queries: NBA_TEAMS.map((t) => ({
      queryKey: nbaTeamKeys.stats(t.abbrev),
      queryFn: () => apiClient.getNBATeamStats(t.abbrev),
      staleTime: 1000 * 60 * 30,
      meta: { toast: false },
    })),
  });
  const loading = results.some((r) => r.isLoading);
  const rows = useMemo(
    () =>
      results
        .map((r, i) => {
          const t = r.data;
          const info = NBA_TEAMS[i];
          return { abbrev: info.abbrev, name: t?.team_name ?? info.name, conference: t?.conference ?? info.conference, w: t?.w ?? null, l: t?.l ?? null, net: t?.net_rating ?? null, off: t?.off_rating ?? null, def: t?.def_rating ?? null, pace: t?.pace ?? null, pts: t?.pts ?? null, asOf: t?.as_of_date ?? null, season: t?.season ?? null };
        })
        .filter((r) => r.w != null || r.l != null),
    [results]
  );
  const table = useMemo(() => standings(rows), [rows]);
  const asOf = rows.find((r) => r.asOf)?.asOf ?? null;
  const season = rows.find((r) => r.season)?.season ?? null;
  const best = (pick: (r: StandingRow) => number | null, high: boolean) => {
    const all = [...table.East, ...table.West].filter((r) => pick(r) != null);
    if (!all.length) return null;
    return all.sort((a, b) => (high ? (pick(b) ?? 0) - (pick(a) ?? 0) : (pick(a) ?? 0) - (pick(b) ?? 0)))[0];
  };
  const bestNet = best((r) => r.net, true);
  const bestOff = best((r) => r.off, true);
  const bestDef = best((r) => r.def, false);
  const fastest = best((r) => r.pace, true);
  const teamTick = (label: string, r: StandingRow | null, value: (r: StandingRow) => string) => ({
    label,
    value: r ? (
      <span className={s.inline}>
        <TeamLogo abbrev={r.abbrev} size={18} /> {r.abbrev}
      </span>
    ) : (
      "—"
    ),
    sub: r ? value(r) : undefined,
    onClick: r ? () => open({ kind: "team", abbrev: r.abbrev }) : undefined,
  });

  return (
    <div className={s.sheetInner}>
      <header className={s.head}>
        <div className={s.headBody}>
          <div className={s.headName}>
            <span>Standings</span>
            <span className={dk.sub}>
              {season ?? ""}
              {asOf ? ` · as of ${asOf}` : ""}
            </span>
          </div>
          <span className={s.headSub}>Both conferences by winning percentage, with the ratings that explain the record. A team opens its sheet.</span>
        </div>
      </header>
      <Tape
        ticks={[
          teamTick("Best net rating", bestNet, (r) => fmtDelta(r.net)),
          teamTick("Best offense", bestOff, (r) => `${fmtStat(r.off)} per 100`),
          teamTick("Best defense", bestDef, (r) => `${fmtStat(r.def)} per 100`),
          teamTick("Fastest", fastest, (r) => `${fmtStat(r.pace)} pace`),
        ]}
      />
      {loading && rows.length === 0 ? (
        <Skeleton rows={12} />
      ) : rows.length === 0 ? (
        <div className={s.sheetError}>No team records on file yet.</div>
      ) : (
        <div className={`${s.two} ${s.twoStandings}`}>
          {(["East", "West"] as const).map((conf) => (
            <Block key={conf} title={conf} note={`${table[conf].length} teams`}>
              <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th className={s.text}>TEAM</th>
                    <th>W</th>
                    <th>L</th>
                    <th>PCT</th>
                    <th>GB</th>
                    <th>NET</th>
                    <th>OFF</th>
                    <th>DEF</th>
                    <th>PACE</th>
                  </tr>
                </thead>
                <tbody>
                  {table[conf].map((r, i) => {
                    const on = focus?.kind === "team" && focus.abbrev === r.abbrev;
                    return (
                      <tr key={r.abbrev} className={`${s.click} ${on ? s.on : ""} ${i === 5 ? s.cutline : ""}`} onClick={() => open({ kind: "team", abbrev: r.abbrev })} title={r.name}>
                        <td className={s.muted}>{i + 1}</td>
                        <td className={s.text}>
                          <span className={s.inline}>
                            <TeamLogo abbrev={r.abbrev} size={18} />
                            <span className={s.teamAbbrev}>{r.abbrev}</span>
                            <span className={s.muted} style={{ fontFamily: "var(--desk-sans)" }}>{r.name.replace(/^.*\s/, "")}</span>
                          </span>
                        </td>
                        <td className={s.strong}>{r.w}</td>
                        <td>{r.l}</td>
                        <td>{fmtPctDot(r.pct)}</td>
                        <td>{r.gb === 0 ? "—" : r.gb.toFixed(1).replace(/\.0$/, "")}</td>
                        <td className={r.net != null && r.net > 0 ? s.best : r.net != null && r.net < 0 ? s.worst : ""}>{fmtDelta(r.net)}</td>
                        <td>{fmtStat(r.off)}</td>
                        <td>{fmtStat(r.def)}</td>
                        <td>{fmtStat(r.pace)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </Block>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Market: the overview and each list
// ---------------------------------------------------------------------------

export const TRENDING_DAYS = [7, 14, 30] as const;

export function useMarketLists(days: number) {
  const trending = useOwnershipTrendingQuery({ days, limit: 50, sort_by: "change", direction: "both" });
  const movers = useEspnMarketMoversQuery(days, "adp", "both", 50);
  const draft = useMemo(
    () =>
      (movers.data?.players ?? [])
        .filter((p) => p.changes.adp != null)
        .sort((a, b) => Math.abs(b.changes.adp ?? 0) - Math.abs(a.changes.adp ?? 0)),
    [movers.data]
  );
  return {
    adds: trending.data?.trending_up ?? [],
    drops: trending.data?.trending_down ?? [],
    draft,
    loading: trending.isLoading || movers.isLoading,
    error: trending.error ?? movers.error,
    from: movers.data?.from_as_of_date ?? null,
    to: movers.data?.to_as_of_date ?? null,
  };
}

export function MarketOverview({ open, focus }: { open: (focus: Focus) => void; focus: Focus | null }) {
  const [days, setDays] = useState<number>(7);
  const m = useMarketLists(days);
  const top = (list: Array<{ player_id: number; player_name: string; change: number }>) => list[0];
  const topAdd = top(m.adds);
  const topDrop = top(m.drops);
  const topDraft = m.draft[0];
  return (
    <div className={s.sheetInner}>
      <header className={s.head}>
        <div className={s.headBody}>
          <div className={s.headName}>
            <span>Market</span>
            <span className={dk.sub}>ESPN ownership and the draft market</span>
          </div>
          <div className={s.headMeta}>
            <span className={dk.label}>Over</span>
            <MiniRail label="Days" value={days} options={TRENDING_DAYS.map((d) => ({ v: d as number, label: `${d}D` }))} onChange={setDays} />
          </div>
        </div>
      </header>
      <Tape
        ticks={[
          { label: "Most added", value: topAdd ? topAdd.player_name : "—", sub: topAdd ? `${fmtDelta(topAdd.change)} pts of ownership` : "nothing moved", onClick: topAdd ? () => open({ kind: "player", id: topAdd.player_id }) : undefined },
          { label: "Most dropped", value: topDrop ? topDrop.player_name : "—", sub: topDrop ? `${fmtDelta(topDrop.change)} pts of ownership` : undefined, onClick: topDrop ? () => open({ kind: "player", id: topDrop.player_id }) : undefined },
          { label: "Biggest draft move", value: topDraft ? topDraft.name : "—", sub: topDraft ? `ADP ${fmtDelta(topDraft.changes.adp)}${topDraft.after?.adp != null ? ` to ${topDraft.after.adp.toFixed(1)}` : ""}` : "no two snapshots yet", onClick: topDraft ? () => open({ kind: "player", id: topDraft.player_id }) : undefined },
          { label: "Snapshots", value: m.from && m.to ? `${m.from.slice(5)} → ${m.to.slice(5)}` : "—", sub: "draft market compared" },
        ]}
      />
      <div className={s.three}>
        {MARKET_SECTIONS.map((sec) => (
          <Block
            key={sec.id}
            title={sec.label}
            note={sec.title}
            right={
              <button type="button" className={s.linkBtn} style={{ fontSize: 12 }} onClick={() => open({ kind: "market", section: sec.id })}>
                Full list <ArrowRight size={11} />
              </button>
            }
          >
            <MarketList section={sec.id} m={m} limit={10} open={open} focus={focus} compact />
          </Block>
        ))}
      </div>
    </div>
  );
}

export function MarketSheet({ section, open, focus }: { section: MarketSection; open: (focus: Focus) => void; focus: Focus | null }) {
  const [days, setDays] = useState<number>(7);
  const m = useMarketLists(days);
  const info = MARKET_SECTIONS.find((x) => x.id === section)!;
  const count = section === "adds" ? m.adds.length : section === "drops" ? m.drops.length : m.draft.length;
  return (
    <div className={s.sheetInner}>
      <header className={s.head}>
        <div className={s.headBody}>
          <div className={s.headName}>
            <span>{info.label}</span>
            <span className={dk.sub}>{info.title}</span>
          </div>
          <div className={s.headMeta}>
            <span className={dk.label}>Over</span>
            <MiniRail label="Days" value={days} options={TRENDING_DAYS.map((d) => ({ v: d as number, label: `${d}D` }))} onChange={setDays} />
            {section === "draft" && m.from && m.to ? <span className={s.muted}>snapshots {m.from} → {m.to}</span> : null}
          </div>
        </div>
      </header>
      <Block title="List" note={m.loading ? "loading…" : `${count} players · click a row for the player`}>
        <MarketList section={section} m={m} open={open} focus={focus} />
      </Block>
    </div>
  );
}

function MarketList({ section, m, limit, open, focus, compact = false }: { section: MarketSection; m: ReturnType<typeof useMarketLists>; limit?: number; open: (f: Focus) => void; focus: Focus | null; compact?: boolean }) {
  if (m.loading) return <Skeleton rows={compact ? 5 : 10} className={s.ledgerSkel} />;
  if (m.error) return <div className={dk.error}>Couldn&apos;t load the market.</div>;
  const onRow = (id: number) => focus?.kind === "player" && focus.id === id;
  if (section === "draft") {
    const rows = limit ? m.draft.slice(0, limit) : m.draft;
    if (rows.length === 0) return <div className={s.blockEmpty}>No two ESPN snapshots this far apart yet.</div>;
    return (
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>#</th>
              <th className={s.text}>PLAYER</th>
              {compact ? null : <th>RANK</th>}
              <th>ADP</th>
              <th>Δ ADP</th>
              {compact ? null : <th>$</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const good = (p.changes.adp ?? 0) > 0;
              return (
                <tr key={p.player_id} className={`${s.click} ${onRow(p.player_id) ? s.on : ""}`} onClick={() => open({ kind: "player", id: p.player_id })}>
                  <td className={s.muted}>{i + 1}</td>
                  <td className={s.text}>
                    <span className={s.inline}>
                      <Headshot nbaId={p.player_id} name={p.name} size={22} />
                      {p.name}
                    </span>
                  </td>
                  {compact ? null : (
                    <td>
                      {p.before?.overall_rank != null ? `#${p.before.overall_rank}` : "—"} → <span className={s.strong}>{p.after?.overall_rank != null ? `#${p.after.overall_rank}` : "—"}</span>
                    </td>
                  )}
                  <td>
                    {compact ? "" : `${p.before?.adp != null ? p.before.adp.toFixed(1) : "—"} → `}
                    <span className={s.strong}>{p.after?.adp != null ? p.after.adp.toFixed(1) : "—"}</span>
                  </td>
                  <td className={good ? s.best : s.worst}>{fmtDelta(p.changes.adp)}</td>
                  {compact ? null : <td>{p.after?.auction_value != null ? `$${Math.round(p.after.auction_value)}` : "—"}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
  const list = section === "adds" ? m.adds : m.drops;
  const rows = limit ? list.slice(0, limit) : list;
  if (rows.length === 0) return <div className={s.blockEmpty}>Nothing moved.</div>;
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>#</th>
            <th className={s.text}>PLAYER</th>
            <th className={s.text}>TEAM</th>
            <th>OWN</th>
            {compact ? null : <th>WAS</th>}
            <th>Δ</th>
            {compact ? null : <th>/ DAY</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={p.player_id} className={`${s.click} ${onRow(p.player_id) ? s.on : ""}`} onClick={() => open({ kind: "player", id: p.player_id })}>
              <td className={s.muted}>{i + 1}</td>
              <td className={s.text}>
                <span className={s.inline}>
                  <Headshot nbaId={p.player_id} name={p.player_name} size={22} />
                  {p.player_name}
                </span>
              </td>
              <td className={s.text}>
                <span className={s.inline} style={{ gap: 5 }}>
                  <TeamLogo abbrev={p.team ?? ""} size={14} />
                  {p.team ?? ""}
                </span>
              </td>
              <td className={s.strong}>{p.current_ownership.toFixed(1)}%</td>
              {compact ? null : <td>{p.previous_ownership.toFixed(1)}%</td>}
              <td className={p.change > 0 ? s.best : s.worst}>{fmtDelta(p.change)}</td>
              {compact ? null : <td>{fmtDelta(p.velocity, 2)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
