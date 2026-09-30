"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ExternalLink, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// ---- snapshot shape (written by the review export, see the PR) ------------------------

type FormatRanks = {
  cv: number | null;
  before: number | null;
  espn: number | null;
  value: number | null;
  z?: Record<string, number> | null;
};

type Line = {
  pts: number; reb: number; ast: number; stl: number; blk: number; tov: number;
  fg3m: number; fgm: number; fga: number; ftm: number; fta: number;
};

type ReviewPlayer = {
  id: number;
  name: string;
  team: string | null;
  pos: string | null;
  age: number | null;
  src: string;
  cat: FormatRanks;
  pts: FormatRanks;
  games: number | null;
  min: number | null;
  line: Line | null;
  espn: { games: number | null; min: number | null } | null;
  before: { games: number; min: number } | null;
  po: number | null;
  po_light: number | null;
  po_weeks: number[] | null;
  adj: boolean;
};

type ReviewAdjustment = {
  player_id: number;
  name: string | null;
  kind: string;
  minutes: number | null;
  games: number | null;
  return_date: string | null;
  usage: number | null;
  rates: Record<string, number> | null;
  note: string;
  source_url: string | null;
};

export type ReviewSnapshot = {
  generated_at: string;
  season: string;
  version: string;
  espn_weight: number;
  market_as_of: string | null;
  league: { teams: number; roster: number; categories: string[]; points: string };
  playoffs: { weeks: number[]; label: string; weight: number; min: number; max: number; mean: number };
  backtest: {
    held_out: string[];
    model: { fpts_pg_mae: number; games_mae: number; points_rho_top200: number };
    last_season_line: { fpts_pg_mae: number; games_mae: number; points_rho_top200: number };
  };
  players: ReviewPlayer[];
  adjustments: ReviewAdjustment[];
};

type Format = "cat" | "pts";

const CATEGORY_LABELS: Record<string, string> = {
  fg_pct: "FG%", ft_pct: "FT%", fg3m: "3PM", pts: "PTS", reb: "REB",
  ast: "AST", stl: "STL", blk: "BLK", tov: "TO",
};

const KIND_LABELS: Record<string, string> = {
  injury_return: "Injury return",
  injury_current: "Injured",
  role: "Role",
  trade: "Trade",
  age: "Age",
  year2: "Year 2",
  other: "Other",
};

// Where CV and ESPN disagree by at least this many places, the row is flagged.
const GAP = 25;

// ---- small formatting helpers ---------------------------------------------------------

function pct(makes: number | undefined, attempts: number | undefined): string {
  if (!attempts) return "—";
  return `${((100 * (makes ?? 0)) / attempts).toFixed(1)}%`;
}

function num(v: number | null | undefined, digits = 1): string {
  return v === null || v === undefined ? "—" : v.toFixed(digits);
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short", day: "numeric", timeZone: "UTC",
  });
}

function changeSummary(a: ReviewAdjustment): string[] {
  const parts: string[] = [];
  if (a.minutes !== null) parts.push(`${a.minutes} min`);
  if (a.games !== null) parts.push(`${a.games} games`);
  if (a.return_date) parts.push(`back ${shortDate(a.return_date)}`);
  if (a.usage !== null) parts.push(`usage ×${a.usage.toFixed(2)}`);
  for (const [k, v] of Object.entries(a.rates ?? {})) parts.push(`${CATEGORY_LABELS[k] ?? k} ×${v}`);
  return parts;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function zTint(z: number | undefined): string {
  if (z === undefined) return "text-muted-foreground";
  if (z >= 1) return "text-status-win";
  if (z <= -1) return "text-status-loss";
  return "text-muted-foreground";
}

/** Places moved by the adjustments: positive = up the board. */
function moved(r: FormatRanks | undefined): number | null {
  if (r?.cv == null || r.before == null) return null;
  return r.before - r.cv;
}

function Move({ delta }: { delta: number | null }) {
  if (!delta) return null;
  return (
    <span className={cn("font-mono text-[11px] tabular-nums", delta > 0 ? "text-status-win" : "text-status-loss")}>
      {delta > 0 ? "▲" : "▼"}
      {Math.abs(delta)}
    </span>
  );
}

// ---- rankings tab -----------------------------------------------------------------------

type Filter = "all" | "adjusted" | "gaps";
type Sort = "cv" | "espn" | "gap";

function RankingRow({
  p, format, open, onToggle, adjustment,
}: {
  p: ReviewPlayer;
  format: Format;
  open: boolean;
  onToggle: () => void;
  adjustment?: ReviewAdjustment;
}) {
  const r = p[format];
  const gap = r.cv !== null && r.espn !== null ? r.espn - r.cv : null;
  const line = p.line;
  return (
    <li className="border-b border-border/60 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="grid w-full grid-cols-[2.75rem_1fr_auto] items-center gap-x-3 px-3 py-2.5 text-left hover:bg-muted/40 md:grid-cols-[2.75rem_minmax(12rem,1fr)_4rem_4.5rem_4rem_3.5rem_repeat(6,3rem)_1.5rem]"
      >
        <span className="flex flex-col items-start">
          <span className="font-mono text-base font-semibold tabular-nums">{r.cv ?? "—"}</span>
          {p.adj && <Move delta={moved(r)} />}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-medium">{p.name}</span>
            {p.adj && (
              <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px] font-normal">
                adj
              </Badge>
            )}
          </span>
          <span className="block text-xs text-muted-foreground">
            {p.team ?? "FA"} · {p.pos ?? "—"}
            {p.age !== null && ` · ${p.age}`}
            <span className="md:hidden">
              {" "}· {num(p.games, 0)} g{p.po !== null && ` · PO ${p.po}`}
            </span>
          </span>
        </span>
        {/* phone: ESPN rank and the gap; desktop: its own columns */}
        <span className="flex flex-col items-end md:hidden">
          <span className="font-mono text-xs tabular-nums text-muted-foreground">ESPN {r.espn ?? "—"}</span>
          {gap !== null && Math.abs(gap) >= GAP && (
            <span className={cn("font-mono text-[11px] tabular-nums", gap > 0 ? "text-status-win" : "text-status-loss")}>
              {gap > 0 ? `+${gap}` : gap}
            </span>
          )}
        </span>
        <span className="hidden font-mono text-sm tabular-nums text-muted-foreground md:block">{r.espn ?? "—"}</span>
        <span
          className={cn(
            "hidden font-mono text-sm tabular-nums md:block",
            gap !== null && Math.abs(gap) >= GAP
              ? gap > 0 ? "text-status-win" : "text-status-loss"
              : "text-muted-foreground",
          )}
        >
          {gap === null ? "—" : gap > 0 ? `+${gap}` : gap}
        </span>
        <span className="hidden font-mono text-sm tabular-nums md:block">
          {num(p.games, 0)}
          {p.espn?.games !== null && p.espn?.games !== undefined && (
            <span className="text-muted-foreground"> /{num(p.espn.games, 0)}</span>
          )}
        </span>
        <span className="hidden font-mono text-sm tabular-nums md:block">{p.po ?? "—"}</span>
        <span className="hidden font-mono text-sm tabular-nums md:block">{num(line?.pts)}</span>
        <span className="hidden font-mono text-sm tabular-nums md:block">{num(line?.reb)}</span>
        <span className="hidden font-mono text-sm tabular-nums md:block">{num(line?.ast)}</span>
        <span className="hidden font-mono text-sm tabular-nums md:block">{num(line?.stl)}</span>
        <span className="hidden font-mono text-sm tabular-nums md:block">{num(line?.blk)}</span>
        <span className="hidden font-mono text-sm tabular-nums md:block">{num(line?.fg3m)}</span>
        <ChevronDown
          className={cn("hidden h-4 w-4 text-muted-foreground transition-transform md:block", open && "rotate-180")}
        />
      </button>
      {open && <RowDetail p={p} format={format} adjustment={adjustment} />}
    </li>
  );
}

function RowDetail({ p, format, adjustment }: { p: ReviewPlayer; format: Format; adjustment?: ReviewAdjustment }) {
  const line = p.line;
  const r = p[format];
  return (
    <div className="space-y-3 bg-muted/30 px-3 pb-3 pt-2 text-sm">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Stat label="Games" value={num(p.games, 0)} sub={p.espn?.games ? `ESPN ${num(p.espn.games, 0)}` : undefined} />
        <Stat label="Min" value={num(p.min)} sub={p.espn?.min ? `ESPN ${num(p.espn.min)}` : undefined} />
        <Stat
          label="Playoffs"
          value={p.po === null ? "—" : `${p.po} g`}
          sub={p.po_weeks ? `${p.po_weeks.join("·")}${p.po_light !== null ? ` · ${p.po_light} light` : ""}` : undefined}
        />
        <Stat label={format === "cat" ? "CV value" : "Pts / game"} value={num(r.value)} />
        <Stat label="9-cat" value={`#${p.cat.cv ?? "—"}`} sub={`ESPN #${p.cat.espn ?? "—"}`} />
        <Stat label="Points" value={`#${p.pts.cv ?? "—"}`} sub={`ESPN #${p.pts.espn ?? "—"}`} />
      </div>
      {line && (
        <div className="grid grid-cols-5 gap-2 font-mono text-xs tabular-nums sm:grid-cols-10">
          <Stat label="PTS" value={num(line.pts)} />
          <Stat label="REB" value={num(line.reb)} />
          <Stat label="AST" value={num(line.ast)} />
          <Stat label="STL" value={num(line.stl)} />
          <Stat label="BLK" value={num(line.blk)} />
          <Stat label="3PM" value={num(line.fg3m)} />
          <Stat label="FG%" value={pct(line.fgm, line.fga)} sub={`${num(line.fga)} fga`} />
          <Stat label="FT%" value={pct(line.ftm, line.fta)} sub={`${num(line.fta)} fta`} />
          <Stat label="TO" value={num(line.tov)} />
        </div>
      )}
      {format === "cat" && p.cat.z && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(p.cat.z).map(([k, z]) => (
            <span key={k} className={cn("rounded border px-1.5 py-0.5 font-mono text-[11px] tabular-nums", zTint(z))}>
              {CATEGORY_LABELS[k] ?? k} {z > 0 ? "+" : ""}
              {z.toFixed(1)}
            </span>
          ))}
        </div>
      )}
      {adjustment && <AdjustmentNote a={adjustment} p={p} />}
      {!adjustment && p.src !== "projection" && (
        <p className="text-xs text-muted-foreground">
          No projection yet — valued from {p.src === "baseline" ? "last season's per-game line" : "ESPN's rank only"}.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="truncate font-mono font-medium tabular-nums">{value}</div>
      {sub && <div className="truncate text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function AdjustmentNote({ a, p }: { a: ReviewAdjustment; p?: ReviewPlayer }) {
  const before = p?.before;
  return (
    <div className="rounded-md border border-dashed px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" className="text-[10px]">{KIND_LABELS[a.kind] ?? a.kind}</Badge>
        {changeSummary(a).map((c) => (
          <span key={c} className="font-mono text-xs tabular-nums">{c}</span>
        ))}
      </div>
      {before && p && (
        <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
          unadjusted: {num(before.games, 0)} g · {num(before.min)} min · 9-cat #{p.cat.before ?? "—"} · points #{p.pts.before ?? "—"}
        </p>
      )}
      <p className="mt-1.5 text-xs leading-relaxed">{a.note}</p>
      {a.source_url && (
        <a
          href={a.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          <span className="truncate">{hostOf(a.source_url)}</span>
        </a>
      )}
    </div>
  );
}

function RankingsTab({
  players, format, adjustments,
}: {
  players: ReviewPlayer[];
  format: Format;
  adjustments: Map<number, ReviewAdjustment>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("cv");
  const [open, setOpen] = useState<number | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = players.filter((p) => {
      const r = p[format];
      if (r.cv === null) return false;
      if (q && !p.name.toLowerCase().includes(q) && !(p.team ?? "").toLowerCase().includes(q)) return false;
      if (filter === "adjusted" && !p.adj) return false;
      if (filter === "gaps" && (r.espn === null || Math.abs(r.espn - r.cv) < GAP)) return false;
      return true;
    });
    const gap = (p: ReviewPlayer) => {
      const r = p[format];
      return r.espn === null || r.cv === null ? -1 : Math.abs(r.espn - r.cv);
    };
    list.sort((a, b) => {
      if (sort === "espn") return (a[format].espn ?? 9999) - (b[format].espn ?? 9999);
      if (sort === "gap") return gap(b) - gap(a);
      return (a[format].cv ?? 9999) - (b[format].cv ?? 9999);
    });
    return list;
  }, [players, format, query, filter, sort]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Player or team"
            className="pl-8"
          />
        </div>
        <Chips<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            ["all", "All"],
            ["adjusted", "Adjusted"],
            ["gaps", `±${GAP} vs ESPN`],
          ]}
        />
        <Chips<Sort>
          value={sort}
          onChange={setSort}
          options={[
            ["cv", "CV order"],
            ["espn", "ESPN order"],
            ["gap", "Biggest gap"],
          ]}
          className="sm:ml-auto"
        />
      </div>
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="hidden grid-cols-[2.75rem_minmax(12rem,1fr)_4rem_4.5rem_4rem_3.5rem_repeat(6,3rem)_1.5rem] gap-x-3 border-b px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid">
          <span>CV</span>
          <span>Player</span>
          <span>ESPN</span>
          <span title="ESPN rank minus CV rank: positive means CV likes him more">Gap</span>
          <span title="CV games / ESPN games">Games</span>
          <span title="Games in the fantasy playoff weeks">PO</span>
          <span>PTS</span>
          <span>REB</span>
          <span>AST</span>
          <span>STL</span>
          <span>BLK</span>
          <span>3PM</span>
          <span />
        </div>
        <ul>
          {rows.map((p) => (
            <RankingRow
              key={p.id}
              p={p}
              format={format}
              open={open === p.id}
              onToggle={() => setOpen(open === p.id ? null : p.id)}
              adjustment={adjustments.get(p.id)}
            />
          ))}
        </ul>
        {rows.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No players match.</p>}
      </div>
      <p className="text-xs text-muted-foreground">{rows.length} players</p>
    </div>
  );
}

// ---- adjustments tab ------------------------------------------------------------------

function AdjustmentsTab({
  adjustments, players,
}: {
  adjustments: ReviewAdjustment[];
  players: Map<number, ReviewPlayer>;
}) {
  const kinds = useMemo(() => Array.from(new Set(adjustments.map((a) => a.kind))), [adjustments]);
  const [kind, setKind] = useState<string>("all");
  const [order, setOrder] = useState<"board" | "move">("board");
  const list = useMemo(() => {
    const shown = adjustments.filter((a) => kind === "all" || a.kind === kind);
    // Board order by default: the player's better 9-cat rank of the two, so
    // the adjustments that decide early rounds are read first. Ranks spread
    // out deep in the pool, so "biggest move" favours the bench — an option.
    const best = (a: ReviewAdjustment) => {
      const c = players.get(a.player_id)?.cat;
      return Math.min(c?.cv ?? 9999, c?.before ?? 9999);
    };
    const move = (a: ReviewAdjustment) => Math.abs(moved(players.get(a.player_id)?.cat) ?? 0);
    return shown.sort((a, b) => (order === "board" ? best(a) - best(b) : move(b) - move(a)));
  }, [adjustments, kind, order, players]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <Chips<string>
          value={kind}
          onChange={setKind}
          options={[["all", `All ${adjustments.length}`], ...kinds.map((k) => [k, KIND_LABELS[k] ?? k] as [string, string])]}
        />
        <Chips<"board" | "move">
          value={order}
          onChange={setOrder}
          options={[
            ["board", "Board order"],
            ["move", "Biggest move"],
          ]}
          className="sm:ml-auto"
        />
      </div>
      <ul className="space-y-2">
        {list.map((a) => {
          const p = players.get(a.player_id);
          return (
            <li key={a.player_id} className="rounded-lg border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium leading-snug">{a.name ?? p?.name ?? a.player_id}</div>
                  {p && (
                    <div className="text-xs text-muted-foreground">
                      {p.team ?? "FA"} · {p.pos ?? "—"}
                      {p.age !== null && ` · ${p.age}`}
                    </div>
                  )}
                </div>
                {p && (
                  <div className="shrink-0 text-right font-mono text-xs tabular-nums">
                    <div>
                      9-cat #{p.cat.before ?? "—"} → <span className="font-semibold">#{p.cat.cv ?? "—"}</span>{" "}
                      <Move delta={moved(p.cat)} />
                    </div>
                    <div className="text-muted-foreground">
                      pts #{p.pts.before ?? "—"} → #{p.pts.cv ?? "—"} <Move delta={moved(p.pts)} />
                    </div>
                    <div className="text-muted-foreground">ESPN #{p.cat.espn ?? "—"} / #{p.pts.espn ?? "—"}</div>
                  </div>
                )}
              </div>
              <div className="mt-2">
                <AdjustmentNote a={a} p={p} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---- shared bits ----------------------------------------------------------------------

function Chips<T extends string>({
  value, onChange, options, className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs transition-colors",
            value === v ? "border-foreground/40 bg-foreground/10 font-medium" : "text-muted-foreground hover:bg-muted",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function ReviewClient({ snapshot }: { snapshot: ReviewSnapshot }) {
  const players = snapshot.players;
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const adjustments = useMemo(() => new Map(snapshot.adjustments.map((a) => [a.player_id, a])), [snapshot.adjustments]);
  const bt = snapshot.backtest;

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-10 animate-slide-up-fade">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight">Court Vision base rankings — review</h1>
        <p className="text-sm text-muted-foreground">
          {snapshot.season} · snapshot {snapshot.market_as_of ?? snapshot.generated_at.slice(0, 10)} ·{" "}
          {snapshot.adjustments.length} draft adjustments pending review
        </p>
      </header>

      <details className="rounded-lg border bg-card px-3 py-2 text-sm [&_summary]:cursor-pointer">
        <summary className="font-medium">How these were built</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            <span className="text-foreground">League:</span> {snapshot.league.teams} teams, {snapshot.league.roster} roster
            spots. 9-cat = head-to-head each category; points = {snapshot.league.points} scoring.
          </li>
          <li>
            <span className="text-foreground">Projection:</span> last three seasons weighted 7/2/1 and aged through a
            fitted age curve, blended {Math.round(snapshot.espn_weight * 100)}% with ESPN&apos;s projection, then the
            adjustments. Rookies take ESPN&apos;s line.
          </li>
          <li>
            <span className="text-foreground">Ranking:</span> expected weekly totals (games count) against the
            draftable pool, noisy categories weighted down (G-score). Fantasy playoffs = {snapshot.playoffs.label},
            games there count {snapshot.playoffs.weight}× (teams play {snapshot.playoffs.min}–{snapshot.playoffs.max}).
          </li>
          <li>
            <span className="text-foreground">Backtest</span> ({bt.held_out[0]} to {bt.held_out[bt.held_out.length - 1]},
            never seen in fitting): pts/game error {bt.model.fpts_pg_mae} vs {bt.last_season_line.fpts_pg_mae} for last
            season&apos;s line; rank correlation with what happened {bt.model.points_rho_top200} vs{" "}
            {bt.last_season_line.points_rho_top200}.
          </li>
          <li>
            <span className="text-foreground">Reading a row:</span> ▲/▼ = places the adjustment moved him. Gap = ESPN rank
            minus CV rank (green: CV likes him more). Tap a row for his line, category strengths and the adjustment&apos;s
            reason and source.
          </li>
        </ul>
      </details>

      <Tabs defaultValue="cat">
        <TabsList>
          <TabsTrigger value="cat">9-cat</TabsTrigger>
          <TabsTrigger value="pts">Points</TabsTrigger>
          <TabsTrigger value="adj">Adjustments ({snapshot.adjustments.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="cat" className="mt-3">
          <RankingsTab players={players} format="cat" adjustments={adjustments} />
        </TabsContent>
        <TabsContent value="pts" className="mt-3">
          <RankingsTab players={players} format="pts" adjustments={adjustments} />
        </TabsContent>
        <TabsContent value="adj" className="mt-3">
          <AdjustmentsTab adjustments={snapshot.adjustments} players={byId} />
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Model {snapshot.version}. A review snapshot, not the live board: it does not update, and nothing on it is
        applied in production until the adjustments are approved.
      </p>
    </div>
  );
}
