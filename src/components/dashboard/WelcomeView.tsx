"use client";

import React from "react";
import Link from "next/link";
import {
  Zap,
  UserPlus,
  Trophy,
  Swords,
  ArrowRight,
  TrendingUp,
  Activity,
  Target,
  Command,
  Github,
  Bell,
  ListChecks,
  ClipboardList,
  LayoutList,
  Code,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type FeatureItem = {
  title: string;
  description: string;
  icon: React.ElementType;
  tag: string;
  size: "large" | "small";
  isNew?: boolean;
  /** Mini UI preview drawn above the card body. */
  preview?: "daily" | "draft" | "terminal";
};

// Sample values in the mock panels below are illustrative, not live data.
const DAILY_ROWS = [
  { kind: "Pick up", who: "Derrick White", why: "open seat · plays tonight · 37.2 avg", action: "Pickup" },
  { kind: "Start", who: "Joel Embiid", why: "bench → PF · 43.5 avg", action: "Stage" },
  { kind: "Sit", who: "Ja Morant", why: "out tonight", action: "Swap" },
];

export function WelcomeView() {
  const features: FeatureItem[] = [
    {
      title: "Daily Actions",
      description:
        "Every morning the dashboard lists what your roster needs today: who to start, who is out, which open seat a streamer could fill. Approve a row and the move is sent to ESPN.",
      icon: ListChecks,
      tag: "⌥" + "1",
      size: "large",
      isNew: true,
      preview: "daily",
    },
    {
      title: "Draft Lab",
      description:
        "Draft rooms with a live board, pick-by-pick recommendations, and a recap that grades every pick. Follow your ESPN draft as it happens, or run a mock against the field first.",
      icon: ClipboardList,
      tag: "⌘D",
      size: "small",
      isNew: true,
      preview: "draft",
    },
    {
      title: "Streamers",
      description:
        "The best free agents for the week or for tonight, ranked by games left and your league's scoring. Add them to your ESPN roster straight from the list.",
      icon: UserPlus,
      tag: "⌘S",
      size: "small",
    },
    {
      title: "Rankings",
      description:
        "Every player ranked the way your league scores: standard points, your league's own point settings, or nine-category z-scores. The full player card is one click away.",
      icon: Trophy,
      tag: "⌘R",
      size: "small",
    },
    {
      title: "Matchup",
      description:
        "Live scores with tonight's games layered on ESPN's totals, projected winners, and category-by-category breakdowns for nine-cat leagues.",
      icon: Swords,
      tag: "⌘M",
      size: "small",
    },
    {
      title: "Analytics Terminal",
      description:
        "Twenty-seven panels — player focus, game logs, comparisons, category strengths, live rosters, NBA team pages, the playoff bracket — in a layout you arrange and keep.",
      icon: Activity,
      tag: "⌥" + "7",
      size: "large",
      preview: "terminal",
    },
    {
      title: "Lineup Editor",
      description:
        "Your roster as ESPN sees it, with tonight's games and lock times. Move players between slots, hit Optimize today, and apply on ESPN with one confirmation.",
      icon: LayoutList,
      tag: "⌘T",
      size: "small",
    },
    {
      title: "Weekly Optimizer",
      description:
        "Plan the week's streaming. The engine weighs schedules, projections, and your open slots to find the adds and drops worth making.",
      icon: Zap,
      tag: "⌘G",
      size: "small",
    },
    {
      title: "Lineup Alerts",
      description:
        "An email when a starter is out or you are leaving points on the bench, sent when you choose before tip-off.",
      icon: Bell,
      tag: "⌘,",
      size: "small",
    },
    {
      title: "Developer API",
      description:
        "The same rankings, stats, and schedules through a public API with your own keys, plus a SQL query builder over the live tables.",
      icon: Code,
      tag: "⌥" + "8",
      size: "small",
    },
  ];

  const stats = [
    { value: "ESPN + Yahoo", label: "Leagues connected" },
    { value: "Points + 9-cat", label: "Scoring formats" },
    { value: "27", label: "Terminal panels" },
    { value: "1 click", label: "Moves sent to ESPN" },
  ];

  const steps = [
    {
      step: "01",
      title: "Connect your league",
      description:
        "Connect ESPN once and every team on the account comes along; Yahoo links with a click. Your scoring settings sync, so rankings and streamers use your league's math.",
    },
    {
      step: "02",
      title: "Draft on the board",
      description:
        "Open a room on draft night. With the Court Vision extension the board follows your ESPN draft pick by pick, prices every player, and tells you who to take.",
    },
    {
      step: "03",
      title: "Run the season from the dashboard",
      description:
        "Each day: approve the staged moves, check the matchup, stream the open seat. Court Vision sends the changes to ESPN for you.",
    },
  ];

  return (
    <div>
      {/* HERO */}
      <section className="relative flex flex-col items-center justify-center min-h-[calc(100vh-var(--chrome-h))] supports-[height:100dvh]:min-h-[calc(100dvh-var(--chrome-h))] px-4 py-20 sm:px-6 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/[0.04] rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-3xl mx-auto text-center animate-slide-up-fade">
          {/* The key, drawn around the copy: the mark sits in the free-throw
              semicircle, the words sit in the paint, and the three-point arc
              wraps the lot. Borders rather than an image, so the lines follow
              the copy wherever it wraps; the section clips the overflow. */}
          {/* Three-point line: a semicircle whose ends continue straight down
              to the corners, as on the floor, rather than one circle bending
              back in at the bottom of the hero. */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[-80px] -z-10 w-[min(1200px,200%)] -translate-x-1/2 md:top-[-60px]"
          >
            <div className="aspect-[2/1] w-full rounded-t-full border border-b-0 border-foreground/[0.07]" />
            <div className="h-[200vh] w-full border-x border-foreground/[0.07]" />
          </div>

          {/* The semicircle and the lane share one width, so the free-throw
              circle spans the paint. The mark is sized in container units so
              it grows with the arc. */}
          <div className="relative mx-auto flex aspect-[2/1] w-full max-w-[600px] items-end justify-center [container-type:inline-size]">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-t-full border border-b-0 border-foreground/[0.12]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-full -z-10 h-[200vh] border-x border-t border-foreground/[0.12] bg-primary/[0.035]"
            />
            <div className="pb-[15%] font-display text-[24cqw] font-black leading-none tracking-tighter">
              C<span className="text-primary">V</span>
            </div>
          </div>

          <h1 className="mt-8 font-display text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
            See the move.
            <br />
            <span className="text-primary">Make the move.</span>
          </h1>

          <p className="text-muted-foreground mt-5 max-w-lg mx-auto text-sm md:text-base leading-relaxed">
            Court Vision reads your ESPN or Yahoo league, ranks every player by
            the way your league scores, and stages each day&apos;s adds, drops, and
            lineup changes. One click sends them to ESPN.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/account">
              <Button variant="glow" size="lg" className="gap-2">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/rankings">
              <Button variant="outline" size="lg" className="gap-2">
                Explore Rankings
              </Button>
            </Link>
          </div>

          <p className="text-muted-foreground/40 text-[11px] mt-5 flex items-center justify-center gap-1.5">
            <kbd className="inline-flex items-center rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px]">
              {"⌘"}K
            </kbd>
            <span>to open command palette anytime</span>
          </p>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-pulse">
          <span className="text-muted-foreground/30 text-[10px] uppercase tracking-widest">
            Scroll
          </span>
          <div className="w-px h-6 bg-gradient-to-b from-muted-foreground/30 to-transparent" />
        </div>
      </section>

      {/* STATS BAR */}
      <section className="border-y border-border bg-card/50">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`flex flex-col items-center justify-center py-6 px-4 ${
                i < stats.length - 1 ? "md:border-r border-border" : ""
              } ${i < 2 ? "border-b md:border-b-0 border-border" : ""}`}
            >
              <span className="font-mono text-xl font-bold text-primary tabular-nums">
                {stat.value}
              </span>
              <span className="text-[11px] text-muted-foreground mt-1">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* PRODUCT PREVIEW */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-primary text-[11px] font-semibold uppercase tracking-wider mb-2">
              The Dashboard
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
              Your day, already sorted
            </h2>
            <p className="text-muted-foreground text-sm mt-3 max-w-md mx-auto">
              Today&apos;s moves, your matchup, your streamers, and your roster on
              one screen &mdash; arranged the way you like, and kept that way.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card/80 shadow-[0_0_40px_hsl(var(--primary)/0.06)] overflow-hidden select-none">
            <div className="h-10 border-b border-border bg-card flex items-center px-4 gap-4">
              <span className="font-display text-xs font-black tracking-tighter">
                COURT<span className="text-primary">VISION</span>
              </span>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="text-foreground/80">Home</span>
                <span>Teams</span>
                <span>Matchup</span>
                <span>Streamers</span>
                <span>Rankings</span>
                <span>Draft</span>
                <span>Terminal</span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="h-6 w-32 rounded border border-border bg-muted/50 flex items-center px-2">
                  <span className="text-[10px] text-muted-foreground/50">
                    Command...
                  </span>
                  <span className="ml-auto text-[9px] font-mono text-muted-foreground/30">
                    {"⌘"}K
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Daily Actions */}
              <div className="sm:col-span-2 rounded-md border border-border bg-card p-3">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[10px] font-semibold">Daily Actions</span>
                  <span className="text-[9px] font-mono text-muted-foreground">
                    Tue &middot; 3 moves
                  </span>
                </div>
                <div className="space-y-1.5">
                  {DAILY_ROWS.map((row) => (
                    <div
                      key={row.who}
                      className="flex items-center gap-2 rounded border border-border/60 bg-muted/20 px-2 py-1.5"
                    >
                      <span className="w-10 shrink-0 text-[9px] font-semibold text-primary">
                        {row.kind}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[10px]">
                        {row.who}
                        <span className="text-muted-foreground/60"> &middot; {row.why}</span>
                      </span>
                      <span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-[8px] font-semibold text-primary-foreground">
                        {row.action}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Matchup Score */}
              <div className="rounded-md border border-border bg-card p-3">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[10px] font-semibold">Matchup Score</span>
                  <span className="text-[9px] text-primary/70">Projected to win</span>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-2xl font-bold">87</span>
                      <TrendingUp className="h-3 w-3 text-status-win" />
                    </div>
                    <p className="text-[9px] text-muted-foreground">Your team</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-2xl font-bold text-muted-foreground">
                      72
                    </span>
                    <p className="text-[9px] text-muted-foreground">Opponent</p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden flex">
                  <div className="bg-primary rounded-full" style={{ width: "55%" }} />
                </div>
              </div>

              {/* Today's lineup */}
              <div className="rounded-md border border-border bg-card p-3">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[10px] font-semibold">Today&apos;s Lineup</span>
                  <span className="rounded border border-border bg-muted/30 px-1.5 py-0.5 text-[8px] font-medium">
                    Optimize today
                  </span>
                </div>
                <div className="space-y-1">
                  {[
                    ["PG", "S. Castle", "35.1"],
                    ["SG", "A. Edwards", "45.6"],
                    ["PF", "J. Embiid", "43.5"],
                    ["C", "N. Jokić", "66.3"],
                  ].map(([slot, name, avg]) => (
                    <div key={slot} className="flex items-center gap-2 text-[10px]">
                      <span className="w-5 font-mono text-[8px] text-muted-foreground/60">
                        {slot}
                      </span>
                      <span className="flex-1 truncate">{name}</span>
                      <span className="font-mono tabular-nums text-muted-foreground">{avg}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team Streamers */}
              <div className="rounded-md border border-border bg-card p-3">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[10px] font-semibold">Team Streamers</span>
                  <span className="text-[9px] font-mono text-muted-foreground">this week</span>
                </div>
                <div className="space-y-1">
                  {[
                    ["J. Duren", "DET", "38.6"],
                    ["D. White", "BOS", "37.2"],
                    ["P. George", "PHI", "35.3"],
                    ["M. Bridges", "NYK", "33.3"],
                  ].map(([name, team, avg]) => (
                    <div key={name} className="flex items-center gap-2 text-[10px]">
                      <span className="flex-1 truncate">{name}</span>
                      <span className="font-mono text-[8px] text-muted-foreground/60">{team}</span>
                      <span className="font-mono tabular-nums text-primary">{avg}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category strengths */}
              <div className="rounded-md border border-border bg-card p-3">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[10px] font-semibold">Category Strengths</span>
                  <span className="text-[9px] font-mono text-muted-foreground">9-cat</span>
                </div>
                <div className="space-y-1.5">
                  {[
                    ["REB", 92],
                    ["AST", 78],
                    ["3PM", 61],
                    ["FT%", 34],
                  ].map(([cat, pct]) => (
                    <div key={cat} className="flex items-center gap-2">
                      <span className="w-7 font-mono text-[8px] text-muted-foreground">{cat}</span>
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${Number(pct) >= 50 ? "bg-primary" : "bg-status-loss"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-5 text-right font-mono text-[8px] tabular-nums text-muted-foreground">
                        {pct}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-primary text-[11px] font-semibold uppercase tracking-wider mb-2">
              Features
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
              Draft night to the last week of the playoffs
            </h2>
            <p className="text-muted-foreground text-sm mt-3 max-w-md mx-auto">
              Every decision a manager makes in a season, with the numbers behind
              it and, on ESPN, the button that makes it happen.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              const isLarge = feature.size === "large";
              return (
                <div
                  key={feature.title}
                  className={`transition-transform duration-150 hover:scale-[1.01] ${isLarge ? "col-span-3 md:col-span-2" : "col-span-3 md:col-span-1"}`}
                >
                  <Card variant="panel" className="h-full overflow-hidden group">
                    {/* Daily Actions: the morning's staged moves */}
                    {feature.preview === "daily" && (
                      <div className="relative h-28 overflow-hidden border-b border-border/50 bg-card select-none pointer-events-none">
                        <div className="absolute inset-0 flex flex-col gap-1 p-2">
                          <div className="mb-0.5 flex items-center justify-between">
                            <span className="text-[7px] font-mono uppercase tracking-wider text-muted-foreground/50">
                              Daily Actions &middot; Tue
                            </span>
                            <span className="text-[7px] font-mono text-primary">3 moves</span>
                          </div>
                          {DAILY_ROWS.map((row) => (
                            <div
                              key={row.who}
                              className="flex items-center gap-1.5 rounded border border-border/50 bg-muted/20 px-1.5 py-1"
                            >
                              <span className="w-7 shrink-0 text-[7px] font-semibold text-primary">
                                {row.kind}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-[8px] text-foreground/80">
                                {row.who}
                                <span className="text-muted-foreground/50"> &middot; {row.why}</span>
                              </span>
                              <span className="shrink-0 rounded bg-primary/90 px-1 py-[1px] text-[6px] font-semibold text-primary-foreground">
                                {row.action}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-card to-transparent" />
                      </div>
                    )}
                    {/* Draft Lab: the board, mid-draft */}
                    {feature.preview === "draft" && (
                      <div className="relative h-28 overflow-hidden border-b border-border/50 bg-card select-none pointer-events-none">
                        <div className="absolute inset-0 flex flex-col gap-1 p-2">
                          <div className="mb-0.5 flex items-center justify-between">
                            <span className="text-[7px] font-mono uppercase tracking-wider text-muted-foreground/50">
                              Round 2 &middot; Pick 14
                            </span>
                            <span className="flex items-center gap-1 text-[7px] font-mono text-status-win">
                              <span className="h-1 w-1 rounded-full bg-status-win animate-beacon" />
                              live
                            </span>
                          </div>
                          <div className="rounded border border-primary/25 bg-primary/10 px-1.5 py-1 text-[8px] font-semibold text-primary">
                            You&apos;re on the clock
                          </div>
                          {[
                            ["E. Mobley", "C", "+4.2"],
                            ["J. Williams", "F", "+3.1"],
                            ["T. Maxey", "G", "+2.8"],
                          ].map(([name, pos, value]) => (
                            <div key={name} className="flex items-center gap-1.5 px-1 text-[8px]">
                              <span className="w-3 font-mono text-[7px] text-muted-foreground/40">{pos}</span>
                              <span className="flex-1 truncate text-foreground/80">{name}</span>
                              <span className="font-mono text-[7px] text-status-win">{value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-card to-transparent" />
                      </div>
                    )}
                    {/* Analytics Terminal: mini UI preview */}
                    {feature.preview === "terminal" && (
                      <div className="relative h-28 overflow-hidden border-b border-border/50 bg-card select-none pointer-events-none">
                        <div className="h-7 border-b border-border/50 bg-muted/20 flex items-center gap-1.5 px-2">
                          <div className="p-0.5 rounded bg-primary/10">
                            <span className="text-[8px] text-primary font-mono leading-none">{"▸"}</span>
                          </div>
                          <div className="flex-1 h-[18px] rounded border border-border/50 bg-background/50 flex items-center px-1.5">
                            <span className="text-[7px] text-muted-foreground/40 font-mono">anthony davis</span>
                            <span className="ml-0.5 inline-block w-[1px] h-2.5 bg-primary/70 animate-caret-blink" />
                          </div>
                          <span className="text-[7px] font-mono text-muted-foreground/25 border border-border/40 rounded px-0.5">/</span>
                        </div>
                        <div className="flex h-[calc(100%-28px)]">
                          <div className="w-[88px] flex-none border-r border-border/40 bg-card/80 p-1.5 flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <div className="h-5 w-5 rounded-full bg-muted/60 border border-border/50 flex items-center justify-center flex-none">
                                <span className="text-[6px] text-muted-foreground/60 font-mono">AD</span>
                              </div>
                              <div className="min-w-0">
                                <div className="text-[8px] font-semibold text-foreground/80 truncate">A. Davis</div>
                                <div className="text-[6px] font-mono text-muted-foreground/50">LAL &middot; GP 42</div>
                              </div>
                            </div>
                            <div className="rounded bg-primary/5 border border-primary/20 px-1 py-0.5">
                              <div className="text-[6px] text-muted-foreground/50 uppercase tracking-wider">FP/G</div>
                              <span className="text-[13px] font-mono font-bold text-primary leading-none">48.2</span>
                            </div>
                            <div className="grid grid-cols-3 gap-0.5">
                              {[["PTS","27.4"],["REB","12.8"],["AST","3.5"]].map(([l,v]) => (
                                <div key={l} className="bg-muted/30 rounded px-0.5 py-0.5 text-center">
                                  <div className="text-[5px] text-muted-foreground/50 uppercase">{l}</div>
                                  <div className="text-[7px] font-mono font-bold">{v}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex-1 border-r border-border/40 bg-card/60 p-1.5">
                            <div className="text-[6px] text-muted-foreground/40 font-mono uppercase mb-1">Performance &middot; L10</div>
                            <div className="flex items-end gap-[2px] h-9">
                              {[55,70,48,82,65,88,60,75,80,92].map((h, i) => (
                                <div key={i} className="flex-1 rounded-t-[1px]" style={{ height: `${h}%`, backgroundColor: `hsl(var(--primary) / ${0.15 + (i / 10) * 0.35})` }} />
                              ))}
                            </div>
                          </div>
                          <div className="w-[52px] flex-none bg-card/80 p-1">
                            <div className="text-[6px] text-muted-foreground/40 uppercase tracking-wider font-mono mb-1">Watch</div>
                            {["L. James","N. Jokić","S. Curry","K. Durant"].map(name => (
                              <div key={name} className="text-[6px] text-muted-foreground/60 truncate py-[2px] border-b border-border/30 font-mono">{name}</div>
                            ))}
                          </div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-t from-card to-transparent" />
                        <div className="absolute top-0 right-0 bottom-0 w-5 bg-gradient-to-l from-card/60 to-transparent" />
                      </div>
                    )}
                    {/* Card body */}
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-primary/10 border border-primary/10">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          {feature.isNew && (
                            <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                              New
                            </span>
                          )}
                        </div>
                        <kbd className="font-mono text-[10px] text-muted-foreground/40 px-1.5 py-0.5 rounded border border-border bg-muted/30">
                          {feature.tag}
                        </kbd>
                      </div>
                      <h3 className="font-semibold text-sm mb-1.5">
                        {feature.title}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* KEYBOARD-DRIVEN */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-primary text-[11px] font-semibold uppercase tracking-wider mb-2">
              Power User First
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
              Keyboard-driven by design
            </h2>
            <p className="text-muted-foreground text-sm mt-3 leading-relaxed">
              Navigate every page, switch teams, stage moves, and search players
              without touching your mouse. The command palette puts every action
              one shortcut away.
            </p>

            <div className="mt-6 flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <kbd className="inline-flex items-center rounded border border-border bg-muted/50 px-2 py-1 font-mono text-[10px]">
                  {"⌘"}K
                </kbd>
                <span>Commands</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <kbd className="inline-flex items-center rounded border border-border bg-muted/50 px-2 py-1 font-mono text-[10px]">
                  {"⌥"}1-9
                </kbd>
                <span>Pages</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <kbd className="inline-flex items-center rounded border border-border bg-muted/50 px-2 py-1 font-mono text-[10px]">
                  ?
                </kbd>
                <span>All Shortcuts</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card/80 shadow-[0_0_30px_hsl(var(--primary)/0.05)] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card">
              <div className="flex items-center gap-2">
                <Command className="h-3.5 w-3.5 text-primary" />
                <span className="font-display text-xs font-semibold text-foreground/80">
                  Commands
                </span>
              </div>
              <span className="text-[9px] font-mono text-muted-foreground/40">
                Esc to close
              </span>
            </div>
            <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
              <span className="text-primary font-mono text-sm">{">"}</span>
              <span className="text-xs text-muted-foreground/50">
                Type a command or search...
              </span>
            </div>
            <div className="p-1.5">
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider px-2 py-1.5">
                Navigation
              </p>
              {[
                { label: "Go to Draft Lab", icon: "▦", shortcut: "⌘D" },
                { label: "Go to Matchup", icon: "⚔️", shortcut: "⌘M" },
                { label: "Go to Rankings", icon: "🏆", shortcut: "⌘R" },
                { label: "Go to Terminal", icon: "▸", shortcut: "⌥7" },
              ].map((item, i) => (
                <div
                  key={item.label}
                  className={`flex items-center justify-between px-2 py-2 rounded text-xs ${
                    i === 0
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] w-4 text-center">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground/40">
                    {item.shortcut}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-primary text-[11px] font-semibold uppercase tracking-wider mb-2">
              Get Started
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
              Connected before opening night
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <div key={step.step} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-6 left-full w-6 border-t border-dashed border-border z-0" />
                )}
                <div className="relative z-10">
                  <span className="font-mono text-2xl font-bold text-primary/20">
                    {step.step}
                  </span>
                  <h3 className="font-semibold text-sm mt-2">{step.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1.5">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SUPPORTED PLATFORMS */}
      <section className="py-14 px-6 border-t border-border bg-card/30">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-muted-foreground/50 text-[11px] uppercase tracking-wider mb-4">
            Works with your league
          </p>
          <div className="flex items-center justify-center gap-8">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-[hsl(0_100%_45%)]/10 border border-[hsl(0_100%_45%)]/20 flex items-center justify-center">
                <span className="font-display text-[10px] font-bold text-[hsl(0_100%_50%)]">
                  ESPN
                </span>
              </div>
              <span className="text-sm font-medium">ESPN Fantasy</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-[hsl(270_70%_55%)]/10 border border-[hsl(270_70%_55%)]/20 flex items-center justify-center">
                <span className="font-display text-[10px] font-bold text-[hsl(270_70%_60%)]">
                  Y!
                </span>
              </div>
              <span className="text-sm font-medium">Yahoo Fantasy</span>
            </div>
          </div>
          <p className="text-muted-foreground/60 text-[11px] mt-5">
            Adds, drops, and lineup changes are sent to ESPN today. Yahoo leagues
            are read-only for now.
          </p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 px-6 border-t border-border relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-primary/[0.03] rounded-full blur-[80px] pointer-events-none" />

        <div className="relative z-10 text-center max-w-lg mx-auto">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 mb-5">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
            Ready for opening night?
          </h2>
          <p className="text-muted-foreground text-sm mt-3 leading-relaxed">
            Connect your league before tip-off and the rankings, streamers, and
            draft board are tuned to your scoring from day one. Free to use, no
            credit card required.
          </p>
          <div className="mt-7">
            <Link href="/account">
              <Button variant="glow" size="lg" className="gap-2">
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border py-6 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-black leading-none tracking-tighter">
              C<span className="text-primary">V</span>
            </span>
            <span className="text-[11px] text-muted-foreground">
              Court Vision
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/court-vision"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <Github className="h-4 w-4" />
            </a>
            <p className="text-[10px] text-muted-foreground">
              Fantasy basketball, run from one screen
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
