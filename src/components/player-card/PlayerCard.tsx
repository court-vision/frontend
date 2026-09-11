"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { Minus, Terminal, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { DialogClose, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlayerHeadshot } from "@/components/terminal/shared";
import {
  usePlayerPercentilesQuery,
  usePlayerStatsByNameQuery,
  usePlayerStatsQuery,
  type PlayerIdType,
} from "@/hooks/usePlayer";
import { usePlayerStatusQuery } from "@/hooks/usePlayerStatus";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { calculateMovingAverage, calculateRecentFormTrend } from "@/lib/chart-utils";
import { cn } from "@/lib/utils";
import type {
  AdvancedStatsData,
  AvgStats,
  GameLog,
  PercentileData,
  PlayerStats,
  PlayerStatusData,
} from "@/types/player";
import type { FantasyProvider } from "@/types/team";

export interface PlayerCardProps {
  /** ESPN or NBA id, per `idType`. */
  playerId?: number | null;
  idType?: PlayerIdType;
  /** Yahoo has no usable id: name + team resolve the player instead. */
  playerName?: string;
  playerTeam?: string;
  provider?: FantasyProvider;
  /** Display position ("PG", "SG/SF"); not in the stats payload. */
  position?: string | null;
  /** Overall rank when the caller knows it (rankings page). */
  rank?: number | null;
  /** Rendered between the identity header and the numbers (e.g. breakout context). */
  aside?: ReactNode;
  /** Extra footer actions, left of Close (e.g. Add to roster). */
  actions?: ReactNode;
}

const WINDOWS = [
  { value: "l7", label: "L7", games: 7 },
  { value: "l15", label: "L15", games: 15 },
  { value: "l30", label: "L30", games: 30 },
  { value: "season", label: "Season", games: null },
] as const;
type StatWindow = (typeof WINDOWS)[number]["value"];

const CHART_GAMES = 30;
const LOG_GAMES = 15;

// ---------------------------------------------------------------------------
// Formatting

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-02-22" → "2/22". Split, not `new Date`: a bare ISO date parses as UTC and lands a day early in US zones. */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function longDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1] ?? m} ${d}`;
}

function opponentLabel(g: Pick<GameLog, "opponent" | "home">): string | null {
  if (!g.opponent) return null;
  return `${g.home === false ? "@" : "vs "}${g.opponent}`;
}

function signed(n: number, decimals = 1): string {
  const s = n.toFixed(decimals);
  return n > 0 ? `+${s}` : n < 0 ? `−${s.slice(1)}` : s;
}

// ---------------------------------------------------------------------------
// Card

export function PlayerCard({
  playerId,
  idType = "espn",
  playerName,
  playerTeam,
  provider = "espn",
  position,
  rank,
  aside,
  actions,
}: PlayerCardProps) {
  const [window, setWindow] = useState<StatWindow>("season");

  const useNameLookup = provider === "yahoo" && !!playerName && !!playerTeam;
  const idQuery = usePlayerStatsQuery(useNameLookup ? null : (playerId ?? null), idType, window);
  const nameQuery = usePlayerStatsByNameQuery(
    useNameLookup ? playerName : null,
    useNameLookup ? playerTeam : null,
    window
  );
  const { data: stats, isPending, isFetching } = useNameLookup ? nameQuery : idQuery;

  // Every lookup path resolves to the NBA id, which the per-player endpoints need.
  const nbaId = stats?.id ?? null;
  const { data: percentiles } = usePlayerPercentilesQuery(nbaId);
  const { data: status } = usePlayerStatusQuery(nbaId);

  // Season average from the full log (the payload's averages follow the window).
  const seasonAvg = useMemo(() => {
    const logs = stats?.game_logs ?? [];
    if (!logs.length) return null;
    return Math.round((logs.reduce((acc, g) => acc + g.fpts, 0) / logs.length) * 10) / 10;
  }, [stats]);

  if (isPending) {
    return <PlayerCardSkeleton name={playerName} />;
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 px-6 py-16 text-center">
        <DialogTitle className="font-display text-lg font-semibold">
          {playerName ?? "Player"}
        </DialogTitle>
        <DialogDescription>No stats available for this player yet.</DialogDescription>
        <DialogClose asChild>
          <Button variant="outline" size="sm" className="mt-4">
            Close
          </Button>
        </DialogClose>
      </div>
    );
  }

  const avg = stats.avg_stats;
  const windowDef = WINDOWS.find((w) => w.value === window)!;
  const gamesShown = window === "season" ? stats.games_played : stats.window_games;

  return (
    <div className="relative flex flex-col">
      {/* A warm glow behind the headshot; nothing else in the card is decorative. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(520px_220px_at_6%_0%,hsl(var(--primary)/0.07),transparent_70%)]" />

      {/* Identity */}
      <div className="relative flex flex-col gap-4 px-5 pb-4 pr-12 pt-5 sm:flex-row sm:items-start sm:gap-5 sm:px-7 sm:pr-14 sm:pt-6">
        <PlayerHeadshot playerId={nbaId} name={stats.name} size="xl" className="bg-popover" />
        <div className="min-w-0 flex-1 sm:pt-1">
          <DialogTitle className="truncate font-display text-2xl font-bold leading-none tracking-tight sm:text-[28px]">
            {stats.name}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Detailed stats and performance history.
          </DialogDescription>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] text-muted-foreground">
              {stats.team}
              {position ? ` · ${position}` : ""}
            </span>
            {rank != null && <Badge>#{rank} overall</Badge>}
            <StatusBadge status={status} />
          </div>
        </div>
        <WindowSwitch value={window} onChange={setWindow} />
      </div>

      {aside && <div className="relative px-5 pb-4 sm:px-7">{aside}</div>}

      {/* Hero: fantasy points, form, context */}
      <div
        className={cn(
          "relative flex flex-col gap-4 px-5 pb-5 transition-opacity sm:flex-row sm:items-end sm:justify-between sm:px-7",
          isFetching && "opacity-60"
        )}
      >
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Fantasy points / game
            {windowDef.games ? ` · last ${windowDef.games}` : ""}
          </span>
          <div className="flex items-end gap-4">
            <span className="font-mono text-[44px] font-bold leading-[0.9] tracking-tight tabular-nums">
              {avg.avg_fpts.toFixed(1)}
            </span>
            {seasonAvg != null && <FormChip logs={stats.game_logs} seasonAvg={seasonAvg} />}
            {stats.game_logs.length >= 3 && (
              <div className="flex items-center gap-2 pb-0.5">
                <Sparkline values={stats.game_logs.slice(-10).map((g) => g.fpts)} />
                <span className="text-[10px] text-muted-foreground/70">last 10</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-7">
          <MiniStat label="GP" value={String(gamesShown)} />
          <MiniStat label="MIN" value={avg.avg_minutes.toFixed(1)} />
          {stats.advanced_stats?.usg_pct != null && (
            <MiniStat label="USG%" value={stats.advanced_stats.usg_pct.toFixed(1)} />
          )}
          <MiniStat label="TS%" value={avg.avg_ts_pct.toFixed(1)} />
        </div>
      </div>

      {/* Nine categories with league percentiles */}
      <div
        className={cn(
          "relative flex flex-col gap-2 px-5 pb-5 transition-opacity sm:px-7",
          isFetching && "opacity-60"
        )}
      >
        <CategoryStrip avg={avg} percentiles={percentiles ?? null} />
        {percentiles && (
          <p className="text-[10px] text-muted-foreground/60">
            Bars: percentile among qualified players, full season.
          </p>
        )}
      </div>

      {/* Detail tabs */}
      <Tabs defaultValue="overview">
        <div className="border-y border-muted px-5 sm:px-7">
          <TabsList className="h-11 justify-start gap-1 rounded-none bg-transparent p-0">
            <TabsTrigger value="overview" className={TAB_CLASS}>
              Overview
            </TabsTrigger>
            <TabsTrigger value="log" className={TAB_CLASS}>
              Game log
            </TabsTrigger>
            <TabsTrigger value="advanced" className={TAB_CLASS}>
              Advanced
            </TabsTrigger>
          </TabsList>
        </div>
        {/* Same height for every tab: the dialog is centred, so a shorter tab would shift the whole card. */}
        <TabsContent value="overview" className="mt-0 min-h-[308px] px-5 py-4 sm:px-7">
          <FptsChart logs={stats.game_logs} seasonAvg={seasonAvg} />
        </TabsContent>
        <TabsContent value="log" className="mt-0 min-h-[308px]">
          <GameLogTable logs={stats.game_logs} />
        </TabsContent>
        <TabsContent value="advanced" className="mt-0 min-h-[308px] px-5 py-4 sm:px-7">
          <AdvancedGrid adv={stats.advanced_stats} />
        </TabsContent>
      </Tabs>

      {/* Shooting splits + actions */}
      <div className="flex flex-col gap-4 border-t border-muted px-5 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-7">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Split label="FG" makes={avg.avg_fgm} attempts={avg.avg_fga} pct={avg.avg_fg_pct} />
          <Split label="3P" makes={avg.avg_fg3m} attempts={avg.avg_fg3a} pct={avg.avg_fg3_pct} />
          <Split label="FT" makes={avg.avg_ftm} attempts={avg.avg_fta} pct={avg.avg_ft_pct} />
          <MiniStat label="eFG%" value={avg.avg_efg_pct.toFixed(1)} small />
          <MiniStat label="AST / TOV" value={astToTov(avg, stats.advanced_stats)} small />
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          {actions}
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Close
            </Button>
          </DialogClose>
          <OpenInTerminal nbaId={nbaId} secondary={!!actions} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header pieces

function WindowSwitch({
  value,
  onChange,
}: {
  value: StatWindow;
  onChange: (w: StatWindow) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Stat window"
      className="flex self-start overflow-hidden rounded-md border border-border text-xs sm:mt-1"
    >
      {WINDOWS.map((w) => (
        <button
          key={w.value}
          type="button"
          role="radio"
          aria-checked={value === w.value}
          onClick={() => onChange(w.value)}
          className={cn(
            "h-8 px-2.5 font-medium transition-colors",
            value === w.value
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {w.label}
        </button>
      ))}
    </div>
  );
}

/** Injury status only: a player with no report gets no badge rather than an inferred "Healthy". */
function StatusBadge({ status }: { status: PlayerStatusData | null | undefined }) {
  const label = status?.status;
  if (!label || /^(available|active|healthy)$/i.test(label)) return null;
  const variant = /^(out|doubtful|suspended)/i.test(label) ? "loss" : "projected";
  const detail = status?.injury_detail ?? status?.injury_type ?? undefined;
  return (
    <Badge variant={variant} title={detail}>
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Hero pieces

function FormChip({ logs, seasonAvg }: { logs: GameLog[]; seasonAvg: number }) {
  if (logs.length < 5) return null;
  const form = calculateRecentFormTrend(logs, seasonAvg);
  const Icon = form.trend === "hot" ? TrendingUp : form.trend === "cold" ? TrendingDown : Minus;
  const color =
    form.trend === "hot"
      ? "text-status-win"
      : form.trend === "cold"
        ? "text-status-loss"
        : "text-muted-foreground";
  return (
    <div
      className={cn("flex items-center gap-1.5 whitespace-nowrap pb-0.5", color)}
      title="Last five games versus the season average"
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="font-mono text-xs tabular-nums">{signed(form.diff)} L5</span>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 72;
  const h = 22;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  const d = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - ((v - lo) / span) * (h - 2) - 1).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w + 2} height={h + 2} viewBox={`-1 -1 ${w + 2} ${h + 2}`} aria-hidden="true" className="block">
      <path
        d={d}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MiniStat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <span className={cn("font-mono tabular-nums", small ? "text-xs" : "text-sm font-semibold")}>
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Categories

interface CategoryDef {
  label: string;
  value: (a: AvgStats) => number;
  percentile: (p: PercentileData) => number | undefined;
  lowerIsBetter?: boolean;
}

const CATEGORIES: CategoryDef[] = [
  { label: "PTS", value: (a) => a.avg_points, percentile: (p) => p.avg_points },
  { label: "REB", value: (a) => a.avg_rebounds, percentile: (p) => p.avg_rebounds },
  { label: "AST", value: (a) => a.avg_assists, percentile: (p) => p.avg_assists },
  { label: "STL", value: (a) => a.avg_steals, percentile: (p) => p.avg_steals },
  { label: "BLK", value: (a) => a.avg_blocks, percentile: (p) => p.avg_blocks },
  { label: "3PM", value: (a) => a.avg_fg3m, percentile: (p) => p.avg_fg3m },
  { label: "FG%", value: (a) => a.avg_fg_pct, percentile: (p) => p.avg_fg_pct },
  { label: "FT%", value: (a) => a.avg_ft_pct, percentile: (p) => p.avg_ft_pct },
  { label: "TOV", value: (a) => a.avg_turnovers, percentile: (p) => p.avg_turnovers, lowerIsBetter: true },
];

function barColor(pct: number): string {
  if (pct >= 75) return "bg-primary";
  if (pct >= 30) return "bg-muted-foreground";
  return "bg-status-loss";
}

function CategoryStrip({ avg, percentiles }: { avg: AvgStats; percentiles: PercentileData | null }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-9">
      {CATEGORIES.map((c) => {
        // TOV is already inverted server-side: a high percentile means few turnovers.
        const pct = percentiles ? c.percentile(percentiles) : undefined;
        return (
          <div key={c.label} className="flex flex-col gap-1.5 rounded-md bg-muted/30 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {c.label}
                {c.lowerIsBetter && (
                  <span className="ml-0.5 text-[9px] opacity-60" title="Lower is better">
                    ▾
                  </span>
                )}
              </span>
              {pct != null && (
                <span
                  className="font-mono text-[10px] tabular-nums text-muted-foreground/70"
                  title={`${pct}th percentile`}
                >
                  {pct}
                </span>
              )}
            </div>
            <span className="font-mono text-lg font-semibold leading-none tabular-nums">
              {c.value(avg).toFixed(1)}
            </span>
            <div className="h-[3px] overflow-hidden rounded-full bg-border/60">
              {pct != null && (
                <div
                  className={cn("h-full rounded-full", barColor(pct))}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs

const TAB_CLASS =
  "relative h-11 rounded-none px-2.5 text-[13px] font-medium text-muted-foreground shadow-none " +
  "data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none " +
  "after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-transparent " +
  "data-[state=active]:after:bg-primary";

const chartConfig = {
  fpts: { label: "Fantasy points", color: "hsl(var(--chart-1))" },
  movingAvg: { label: "5-game avg", color: "hsl(var(--muted-foreground))" },
} satisfies ChartConfig;

type ChartPoint = ReturnType<typeof calculateMovingAverage>[number] &
  Pick<GameLog, "opponent" | "home">;

function FptsChart({ logs, seasonAvg }: { logs: GameLog[]; seasonAvg: number | null }) {
  const [showMovingAvg, setShowMovingAvg] = useState(true);
  const [showSeasonAvg, setShowSeasonAvg] = useState(true);
  const gradientId = useId();

  const data = useMemo<ChartPoint[]>(() => {
    const recent = logs.slice(-CHART_GAMES);
    return calculateMovingAverage(recent, 5).map((d, i) => ({
      ...d,
      opponent: recent[i].opponent,
      home: recent[i].home,
    }));
  }, [logs]);

  if (!data.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No games yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-xs font-medium">
          Fantasy points · last {data.length} game{data.length === 1 ? "" : "s"}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="h-0.5 w-3.5 rounded-full bg-primary" />
          FPTS
        </span>
        {showMovingAvg && (
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="w-3.5 border-t-2 border-dashed border-muted-foreground" />
            5-game avg
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <ToggleChip on={showMovingAvg} onClick={() => setShowMovingAvg((v) => !v)}>
            5-game avg
          </ToggleChip>
          {seasonAvg != null && (
            <ToggleChip on={showSeasonAvg} onClick={() => setShowSeasonAvg((v) => !v)}>
              Season avg
            </ToggleChip>
          )}
        </div>
      </div>

      <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-fpts)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--color-fpts)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={32}
            tickFormatter={shortDate}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickCount={4}
            width={32}
            domain={["auto", "auto"]}
          />
          <ChartTooltip cursor={{ strokeWidth: 1 }} content={<FptsTooltip />} />
          {showSeasonAvg && seasonAvg != null && (
            <ReferenceLine
              y={seasonAvg}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="2 4"
              label={{
                value: `avg ${seasonAvg}`,
                position: "insideTopRight",
                fill: "hsl(var(--muted-foreground))",
                fontSize: 10,
              }}
            />
          )}
          <Area
            dataKey="fpts"
            type="monotone"
            stroke="var(--color-fpts)"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4.5, strokeWidth: 2, stroke: "hsl(var(--card))" }}
            isAnimationActive={false}
          />
          {showMovingAvg && (
            <Line
              dataKey="movingAvg"
              type="monotone"
              stroke="var(--color-movingAvg)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}

function FptsTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as ChartPoint;
  const opp = opponentLabel(point);
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 shadow-md">
      <p className="text-[10px] text-muted-foreground">
        {longDate(point.date)}
        {opp ? ` · ${opp}` : ""}
      </p>
      <p className="font-mono text-[13px] font-semibold tabular-nums">
        {point.fpts} fpts
        {point.movingAvg != null && (
          <span className="ml-2 font-normal text-muted-foreground">avg5 {point.movingAvg}</span>
        )}
      </p>
    </div>
  );
}

function ToggleChip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "h-6 rounded-full border px-2.5 text-[11px] font-medium transition-colors",
        on
          ? "border-primary/25 bg-primary/15 text-primary"
          : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

const NUM_CELL = "py-2 text-right font-mono text-xs tabular-nums";

function GameLogTable({ logs }: { logs: GameLog[] }) {
  const rows = logs.slice(-LOG_GAMES).reverse();
  if (!rows.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No games yet.</p>;
  }
  return (
    <div className="max-h-[308px] overflow-y-auto">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]">
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-9 pl-5 sm:pl-7">Date</TableHead>
            <TableHead className="h-9">Opp</TableHead>
            {["MIN", "PTS", "REB", "AST", "STL", "BLK", "TOV", "FG", "3P", "FT"].map((h) => (
              <TableHead key={h} className="h-9 text-right">
                {h}
              </TableHead>
            ))}
            <TableHead className="h-9 pr-5 text-right sm:pr-7">FPTS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((g) => (
            <TableRow key={g.game_id ?? g.date} className="hover:bg-muted/40">
              <TableCell className="py-2 pl-5 font-mono text-xs text-muted-foreground sm:pl-7">
                {shortDate(g.date)}
              </TableCell>
              <TableCell className="py-2 font-mono text-xs">{opponentLabel(g) ?? "—"}</TableCell>
              <TableCell className={NUM_CELL}>{g.min}</TableCell>
              <TableCell className={NUM_CELL}>{g.pts}</TableCell>
              <TableCell className={NUM_CELL}>{g.reb}</TableCell>
              <TableCell className={NUM_CELL}>{g.ast}</TableCell>
              <TableCell className={NUM_CELL}>{g.stl}</TableCell>
              <TableCell className={NUM_CELL}>{g.blk}</TableCell>
              <TableCell className={NUM_CELL}>{g.tov}</TableCell>
              <TableCell className={NUM_CELL}>{g.fgm}-{g.fga}</TableCell>
              <TableCell className={NUM_CELL}>{g.fg3m}-{g.fg3a}</TableCell>
              <TableCell className={NUM_CELL}>{g.ftm}-{g.fta}</TableCell>
              <TableCell className={cn(NUM_CELL, "pr-5 font-semibold sm:pr-7")}>{g.fpts}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const ADVANCED: { label: string; key: keyof AdvancedStatsData; decimals?: number }[] = [
  { label: "Off Rtg", key: "off_rating" },
  { label: "Def Rtg", key: "def_rating" },
  { label: "Net Rtg", key: "net_rating" },
  { label: "USG%", key: "usg_pct" },
  { label: "AST%", key: "ast_pct" },
  { label: "REB%", key: "reb_pct" },
  { label: "OREB%", key: "oreb_pct" },
  { label: "DREB%", key: "dreb_pct" },
  { label: "AST / TO", key: "ast_to_tov", decimals: 2 },
  { label: "Pace", key: "pace" },
  { label: "PIE", key: "pie" },
  { label: "+/−", key: "plus_minus" },
];

function AdvancedGrid({ adv }: { adv: AdvancedStatsData | null }) {
  const cells = adv ? ADVANCED.filter((a) => adv[a.key] != null) : [];
  if (!cells.length) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No advanced stats for this player yet.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
      {cells.map((a) => (
        <div key={a.key} className="flex flex-col gap-1.5 rounded-md bg-muted/30 px-3 py-2.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {a.label}
          </span>
          <span className="font-mono text-lg font-semibold leading-none tabular-nums">
            {(adv![a.key] as number).toFixed(a.decimals ?? 1)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer pieces

function Split({
  label,
  makes,
  attempts,
  pct,
}: {
  label: string;
  makes: number;
  attempts: number;
  pct: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-xs tabular-nums">
        {makes.toFixed(1)} / {attempts.toFixed(1)}
        <span className="text-muted-foreground"> · </span>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

function astToTov(avg: AvgStats, adv: AdvancedStatsData | null): string {
  if (adv?.ast_to_tov != null) return adv.ast_to_tov.toFixed(2);
  if (avg.avg_turnovers > 0) return (avg.avg_assists / avg.avg_turnovers).toFixed(2);
  return "—";
}

/** The terminal is desktop-only, so this stays hidden below `lg` like its nav entry. */
function OpenInTerminal({ nbaId, secondary }: { nbaId: number | null; secondary: boolean }) {
  const router = useRouter();
  const setFocusedPlayer = useTerminalStore((s) => s.setFocusedPlayer);
  if (nbaId == null) return null;
  return (
    <Button
      size="sm"
      variant={secondary ? "outline" : "default"}
      className="hidden gap-1.5 lg:inline-flex"
      onClick={() => {
        setFocusedPlayer(nbaId);
        router.push("/terminal");
      }}
    >
      <Terminal className="h-3.5 w-3.5" />
      Open in Terminal
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Loading

function PlayerCardSkeleton({ name }: { name?: string }) {
  return (
    <div className="flex flex-col">
      <DialogTitle className="sr-only">{name ?? "Player"} details</DialogTitle>
      <DialogDescription className="sr-only">Loading player stats.</DialogDescription>
      <div className="flex gap-5 px-5 pb-4 pt-5 sm:px-7 sm:pt-6">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="flex flex-col gap-3 pt-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="flex items-end justify-between px-5 pb-5 sm:px-7">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-10 w-28" />
        </div>
        <Skeleton className="h-9 w-56" />
      </div>
      <div className="grid grid-cols-3 gap-2 px-5 pb-5 sm:grid-cols-5 sm:px-7 md:grid-cols-9">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-[66px] rounded-md" />
        ))}
      </div>
      <div className="border-y border-muted px-5 sm:px-7">
        <Skeleton className="my-3 h-5 w-60" />
      </div>
      <div className="px-5 py-4 sm:px-7">
        <Skeleton className="h-[240px] w-full" />
      </div>
      <div className="border-t border-muted px-5 py-4 sm:px-7">
        <Skeleton className="h-8 w-72" />
      </div>
    </div>
  );
}
