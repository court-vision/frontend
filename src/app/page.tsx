"use client";

import React from "react";
import Link from "next/link";
import {
  Zap,
  UserPlus,
  Trophy,
  Swords,
  Users,
  ArrowRight,
  TrendingUp,
  Activity,
  Target,
  Command,
  Github,
  Bell,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  StatCard,
  MatchupPreview,
  QuickActionButton,
  StreamerPreviewList,
} from "@/components/dashboard";
import { useMatchupQuery, useLiveMatchupQuery } from "@/hooks/useMatchup";
import { useTeams } from "@/app/context/TeamsContext";

export default function Home() {
  const { isSignedIn } = useUser();

  if (!isSignedIn) {
    return <WelcomeView />;
  }

  return <DashboardView />;
}

function DashboardView() {
  const { selectedTeam, teams } = useTeams();
  const { data: matchup } = useMatchupQuery(selectedTeam);
  const { data: liveMatchup } = useLiveMatchupQuery(selectedTeam);

  const yourScore = liveMatchup?.your_team.current_score ?? matchup?.your_team.current_score ?? 0;
  const opponentScore = liveMatchup?.opponent_team.current_score ?? matchup?.opponent_team.current_score ?? 0;
  const yourProjected = matchup?.your_team.projected_score ?? 0;
  const scoreDiff = yourScore - opponentScore;

  return (
    <div className="space-y-4 animate-slide-up-fade">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">
            Dashboard
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            {selectedTeam
              ? "Your fantasy overview at a glance."
              : "Select a team to get started."}
          </p>
        </div>
        <Link href="/lineup-generation">
          <Button variant="default" size="sm">
            <Zap className="h-3.5 w-3.5 mr-1.5" />
            Generate Lineup
          </Button>
        </Link>
      </section>

      {/* Stats Row */}
      {selectedTeam && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Current Score"
            value={Math.round(yourScore)}
            subValue={`vs ${Math.round(opponentScore)}`}
            trend={scoreDiff > 0 ? "up" : scoreDiff < 0 ? "down" : "neutral"}
            href="/matchup"
          />
          <StatCard
            label="Projected"
            value={yourProjected.toFixed(1)}
            subValue={matchup?.projected_winner === matchup?.your_team.team_name ? "Projected to win" : ""}
          />
          <StatCard
            label="Teams"
            value={teams?.length ?? 0}
            subValue="connected"
            href="/your-teams"
          />
          <StatCard
            label="Period"
            value={`Week ${matchup?.matchup_period ?? "-"}`}
            subValue={matchup ? formatDateRange(matchup.matchup_period_start, matchup.matchup_period_end) : ""}
          />
        </section>
      )}

      {/* Main Grid - 3 columns */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Matchup Preview - 2 cols */}
        <Card variant="panel" className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold">
              This Week&apos;s Matchup
            </CardTitle>
            <Link href="/matchup">
              <Button variant="ghost" size="sm">
                View Details
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <MatchupPreview />
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card variant="panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <QuickActionButton
              icon={Zap}
              label="Generate Optimal Lineup"
              shortcut="⌘G"
              href="/lineup-generation"
            />
            <QuickActionButton
              icon={UserPlus}
              label="Find Streamers"
              shortcut="⌘S"
              href="/streamers"
            />
            <QuickActionButton
              icon={Trophy}
              label="View Rankings"
              shortcut="⌘R"
              href="/rankings"
            />
            <QuickActionButton
              icon={Swords}
              label="View Matchup"
              shortcut="⌘M"
              href="/matchup"
            />
          </CardContent>
        </Card>
      </section>

      {/* Streamers Preview */}
      <Card variant="panel">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-semibold">
            Recommended Streamers
          </CardTitle>
          <Link href="/streamers">
            <Button variant="ghost" size="sm">
              View All
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <StreamerPreviewList limit={5} />
        </CardContent>
      </Card>
    </div>
  );
}

type FeatureItem = {
  title: string;
  description: string;
  icon: React.ElementType;
  tag: string;
  size: "large" | "small";
  isNew?: boolean;
};

function WelcomeView() {
  const features: FeatureItem[] = [
    {
      title: "Lineup Optimization",
      description:
        "Algorithmically optimize your streaming moves for the week. Our engine evaluates schedules, matchups, and projections to find the best adds and drops.",
      icon: Zap,
      tag: "⌘G",
      size: "large",
    },
    {
      title: "Smart Notifications",
      description:
        "Get email alerts when a player is out or you're leaving points on the bench. Set your reminder window, and we'll handle the rest — more notification types coming soon.",
      icon: Bell,
      tag: "⌘,",
      size: "small",
      isNew: true,
    },
    {
      title: "Matchup Tracking",
      description:
        "Daily score updates, projected winners, and head-to-head breakdowns. Stay on top of your matchup throughout the week.",
      icon: Swords,
      tag: "⌘M",
      size: "small",
    },
    {
      title: "Player Rankings",
      description:
        "Comprehensive fantasy rankings updated daily with per-game and total fantasy point value, optimized for H2H points leagues.",
      icon: Trophy,
      tag: "⌘R",
      size: "small",
    },
    {
      title: "Streamer Finder",
      description:
        "Surface the best free agents based on upcoming schedule, category needs, and matchup difficulty. Never miss a streaming opportunity.",
      icon: UserPlus,
      tag: "⌘S",
      size: "small",
    },
    {
      title: "Analytics Terminal",
      description:
        "A power-user terminal for deep player analysis. Search players, compare stats, view game logs and performance charts side by side.",
      icon: Activity,
      tag: "⌥7",
      size: "large",
    },
    {
      title: "Team Management",
      description:
        "Connect multiple ESPN and Yahoo leagues. Get a unified view across all your teams with roster snapshots and category breakdowns.",
      icon: Users,
      tag: "⌘T",
      size: "small",
    },
  ];

  const stats = [
    { value: "H2H", label: "Points League Focus" },
    { value: "500+", label: "Players Tracked" },
    { value: "Daily", label: "Rankings & Scores" },
    { value: "Smart", label: "Lineup Alerts" },
  ];

  const steps = [
    {
      step: "01",
      title: "Connect your league",
      description:
        "Link your ESPN or Yahoo fantasy basketball league in seconds. We sync your roster, matchups, and league settings automatically.",
    },
    {
      step: "02",
      title: "Get insights instantly",
      description:
        "Your dashboard lights up with live scores, projections, and streaming recommendations tailored to your team's needs.",
    },
    {
      step: "03",
      title: "Dominate your league",
      description:
        "Use lineup optimization, streamer rankings, and the analytics terminal to make smarter moves every week.",
    },
  ];

  return (
    <div className="-m-4 lg:-m-6">
      {/* ================================================================= */}
      {/* HERO */}
      {/* ================================================================= */}
      <section className="relative flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-6 overflow-hidden">
        {/* Radial glow behind brand */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/[0.04] rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 text-center max-w-3xl mx-auto animate-slide-up-fade">
          {/* Brand mark */}
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 mb-6">
            <span className="font-display text-xl font-bold text-primary">
              CV
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
            Your fantasy basketball
            <br />
            <span className="text-primary">command center</span>
          </h1>

          {/* Subtext */}
          <p className="text-muted-foreground mt-5 max-w-lg mx-auto text-sm md:text-base leading-relaxed">
            Advanced analytics, lineup optimization, and streaming
            recommendations — all in one place. Connect your ESPN or Yahoo
            league and start winning.
          </p>

          {/* CTAs */}
          <div className="flex items-center justify-center gap-3 mt-8">
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

          {/* Keyboard hint */}
          <p className="text-muted-foreground/40 text-[11px] mt-5 flex items-center justify-center gap-1.5">
            <kbd className="inline-flex items-center rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>
            <span>to open command palette anytime</span>
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-pulse">
          <span className="text-muted-foreground/30 text-[10px] uppercase tracking-widest">
            Scroll
          </span>
          <div className="w-px h-6 bg-gradient-to-b from-muted-foreground/30 to-transparent" />
        </div>
      </section>

      {/* ================================================================= */}
      {/* STATS BAR */}
      {/* ================================================================= */}
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

      {/* ================================================================= */}
      {/* PRODUCT PREVIEW */}
      {/* ================================================================= */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-10">
            <p className="text-primary text-[11px] font-semibold uppercase tracking-wider mb-2">
              The Dashboard
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
              Everything you need, at a glance
            </h2>
            <p className="text-muted-foreground text-sm mt-3 max-w-md mx-auto">
              Your scores, projections, streamers, and matchups — organized into
              a clean, information-dense dashboard.
            </p>
          </div>

          {/* Mock dashboard preview */}
          <div className="rounded-lg border border-border bg-card/80 shadow-[0_0_40px_hsl(var(--primary)/0.06)] overflow-hidden">
            {/* Mock command strip */}
            <div className="h-10 border-b border-border bg-card flex items-center px-4 gap-4">
              <span className="font-display text-xs font-bold text-primary">
                CV
              </span>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="text-foreground/80">Dashboard</span>
                <span>Teams</span>
                <span>Lineup</span>
                <span>Matchup</span>
                <span>Streamers</span>
                <span>Rankings</span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="h-6 w-32 rounded border border-border bg-muted/50 flex items-center px-2">
                  <span className="text-[10px] text-muted-foreground/50">
                    Command...
                  </span>
                  <span className="ml-auto text-[9px] font-mono text-muted-foreground/30">
                    ⌘K
                  </span>
                </div>
                <div className="h-2 w-2 rounded-full bg-status-win animate-beacon" />
              </div>
            </div>

            {/* Mock content grid */}
            <div className="p-4 grid grid-cols-4 gap-3">
              {/* Score card mock */}
              <div className="rounded-md border border-border bg-card p-3">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
                  Current Score
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="font-mono text-lg font-bold">87</span>
                  <TrendingUp className="h-3 w-3 text-status-win" />
                </div>
                <p className="text-[10px] text-muted-foreground">vs 72</p>
              </div>
              {/* Projected card mock */}
              <div className="rounded-md border border-border bg-card p-3">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
                  Projected
                </p>
                <span className="font-mono text-lg font-bold mt-1 block">
                  142.5
                </span>
                <p className="text-[10px] text-primary/70">
                  Projected to win
                </p>
              </div>
              {/* Teams card mock */}
              <div className="rounded-md border border-border bg-card p-3">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
                  Teams
                </p>
                <span className="font-mono text-lg font-bold mt-1 block">
                  3
                </span>
                <p className="text-[10px] text-muted-foreground">connected</p>
              </div>
              {/* Period card mock */}
              <div className="rounded-md border border-border bg-card p-3">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
                  Period
                </p>
                <span className="font-mono text-lg font-bold mt-1 block">
                  Week 18
                </span>
                <p className="text-[10px] text-muted-foreground">
                  Feb 10 - Feb 16
                </p>
              </div>
            </div>

            {/* Mock lower grid */}
            <div className="px-4 pb-4 grid grid-cols-3 gap-3">
              {/* Matchup preview mock */}
              <div className="col-span-2 rounded-md border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-semibold">
                    This Week&apos;s Matchup
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    View Details →
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <span className="font-mono text-2xl font-bold">87</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Your Team
                    </p>
                  </div>
                  <div className="text-[10px] text-muted-foreground/40 font-mono">
                    VS
                  </div>
                  <div className="text-center">
                    <span className="font-mono text-2xl font-bold text-muted-foreground">
                      72
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Opponent
                    </p>
                  </div>
                </div>
                {/* Score bar */}
                <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden flex">
                  <div
                    className="bg-primary rounded-full"
                    style={{ width: "55%" }}
                  />
                </div>
              </div>
              {/* Quick actions mock */}
              <div className="rounded-md border border-border bg-card p-4">
                <span className="text-[10px] font-semibold block mb-3">
                  Quick Actions
                </span>
                <div className="space-y-2">
                  {[
                    { label: "Generate Lineup", key: "⌘G" },
                    { label: "Find Streamers", key: "⌘S" },
                    { label: "View Rankings", key: "⌘R" },
                  ].map((action) => (
                    <div
                      key={action.label}
                      className="flex items-center justify-between py-1.5 px-2 rounded border border-border bg-muted/30 text-[10px]"
                    >
                      <span>{action.label}</span>
                      <kbd className="font-mono text-[9px] text-muted-foreground/50">
                        {action.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* FEATURES */}
      {/* ================================================================= */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-12">
            <p className="text-primary text-[11px] font-semibold uppercase tracking-wider mb-2">
              Features
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
              Built for competitive managers
            </h2>
            <p className="text-muted-foreground text-sm mt-3 max-w-md mx-auto">
              Every tool you need to gain an edge, from lineup optimization to
              deep player analytics.
            </p>
          </div>

          {/* Feature cards — bento grid */}
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
                    {/* Lineup Optimization: mini UI preview */}
                    {feature.title === "Lineup Optimization" && (
                      <div className="relative h-28 overflow-hidden border-b border-border/50 bg-card select-none pointer-events-none">
                        <div className="absolute inset-0 flex gap-2 p-2">
                          {/* Left: config form */}
                          <div className="w-[72px] flex-none flex flex-col gap-1">
                            <div className="text-[7px] text-muted-foreground/50 uppercase tracking-wider font-mono">Config</div>
                            <div className="rounded border border-border/60 bg-muted/30 px-1.5 py-1">
                              <div className="text-[6px] text-muted-foreground/50">Streaming Slots</div>
                              <div className="text-[9px] font-mono text-foreground/70">3</div>
                            </div>
                            <div className="rounded border border-border/60 bg-muted/30 px-1.5 py-1">
                              <div className="text-[6px] text-muted-foreground/50">Week</div>
                              <div className="text-[9px] font-mono text-foreground/70">18</div>
                            </div>
                            <div className="mt-auto rounded bg-primary/90 px-1.5 py-0.5 text-[7px] font-semibold text-primary-foreground text-center">
                              Generate
                            </div>
                          </div>
                          {/* Right: lineup output */}
                          <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[8px] font-mono font-bold text-[hsl(152_72%_46%)]">+45 pts</span>
                              <span className="text-[6px] text-muted-foreground/40 font-mono">Week 18, Day 1</span>
                            </div>
                            {[
                              { pos: "PG", name: "T. Haliburton", avg: "44.2", isNew: true },
                              { pos: "SG", name: "D. Mitchell",   avg: "38.7", isNew: false },
                              { pos: "SF", name: "L. James",      avg: "51.3", isNew: false },
                              { pos: "PF", name: "E. Mobley",     avg: "32.1", isNew: true },
                              { pos: "C",  name: "A. Davis",      avg: "48.2", isNew: false },
                            ].map((p) => (
                              <div key={p.name} className={`flex items-center gap-1 rounded px-1 py-[2px] ${p.isNew ? "bg-[hsl(152_72%_46%)]/[0.07]" : ""}`}>
                                <span className="text-[7px] text-muted-foreground/40 w-4 font-mono flex-none">{p.pos}</span>
                                <span className="text-[8px] text-foreground/75 flex-1 truncate">{p.name}</span>
                                <span className="text-[7px] font-mono tabular-nums text-foreground/60">{p.avg}</span>
                                {p.isNew && <span className="text-[7px] text-[hsl(152_72%_46%)] font-bold ml-0.5 flex-none">+</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent" />
                      </div>
                    )}
                    {/* Analytics Terminal: mini UI preview */}
                    {feature.title === "Analytics Terminal" && (
                      <div className="relative h-28 overflow-hidden border-b border-border/50 bg-card select-none pointer-events-none">
                        {/* Command bar */}
                        <div className="h-7 border-b border-border/50 bg-muted/20 flex items-center gap-1.5 px-2">
                          <div className="p-0.5 rounded bg-primary/10">
                            <span className="text-[8px] text-primary font-mono leading-none">▸</span>
                          </div>
                          <div className="flex-1 h-[18px] rounded border border-border/50 bg-background/50 flex items-center px-1.5">
                            <span className="text-[7px] text-muted-foreground/40 font-mono">anthony davis</span>
                            <span className="ml-0.5 inline-block w-[1px] h-2.5 bg-primary/70 animate-caret-blink" />
                          </div>
                          <span className="text-[7px] font-mono text-muted-foreground/25 border border-border/40 rounded px-0.5">/</span>
                        </div>
                        {/* Three-column body */}
                        <div className="flex h-[calc(100%-28px)]">
                          {/* Left: player focus */}
                          <div className="w-[88px] flex-none border-r border-border/40 bg-card/80 p-1.5 flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <div className="h-5 w-5 rounded-full bg-muted/60 border border-border/50 flex items-center justify-center flex-none">
                                <span className="text-[6px] text-muted-foreground/60 font-mono">AD</span>
                              </div>
                              <div className="min-w-0">
                                <div className="text-[8px] font-semibold text-foreground/80 truncate">A. Davis</div>
                                <div className="text-[6px] font-mono text-muted-foreground/50">LAL · GP 42</div>
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
                          {/* Center: chart hint */}
                          <div className="flex-1 border-r border-border/40 bg-card/60 p-1.5">
                            <div className="text-[6px] text-muted-foreground/40 font-mono uppercase mb-1">Performance · L10</div>
                            <div className="flex items-end gap-[2px] h-9">
                              {[55,70,48,82,65,88,60,75,80,92].map((h, i) => (
                                <div key={i} className="flex-1 rounded-t-[1px]" style={{ height: `${h}%`, backgroundColor: `hsl(28 92% 52% / ${0.15 + (i / 10) * 0.35})` }} />
                              ))}
                            </div>
                          </div>
                          {/* Right: watchlist */}
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
                    {/* Smart Notifications: mock toast header */}
                    {feature.isNew && (
                      <div className="relative h-28 overflow-hidden border-b border-border/50 flex items-center justify-center">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent" />
                        {/* Ghost toast behind */}
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[72%] rounded-md border border-border/50 bg-muted/30 p-1.5 scale-95 origin-bottom opacity-50">
                          <div className="h-1.5 w-16 bg-muted-foreground/20 rounded-full" />
                        </div>
                        {/* Main mock toast */}
                        <div className="relative z-10 w-[80%] rounded-md border border-border bg-muted/60 p-2.5 shadow-sm">
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 p-1 rounded bg-primary/10 border border-primary/20">
                              <Bell className="h-2.5 w-2.5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-semibold text-foreground/90 leading-none mb-0.5">
                                Player Alert
                              </p>
                              <p className="text-[9px] text-muted-foreground truncate leading-snug">
                                Ja Morant is OUT tonight — check your lineup
                              </p>
                            </div>
                            <div className="text-[8px] text-muted-foreground/40 font-mono shrink-0">
                              90m
                            </div>
                          </div>
                        </div>
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

      {/* ================================================================= */}
      {/* KEYBOARD-DRIVEN */}
      {/* ================================================================= */}
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
              Navigate every page, switch teams, generate lineups, and search
              players — all without touching your mouse. The command palette puts
              every action one shortcut away.
            </p>

            <div className="mt-6 flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <kbd className="inline-flex items-center rounded border border-border bg-muted/50 px-2 py-1 font-mono text-[10px]">
                  ⌘K
                </kbd>
                <span>Commands</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <kbd className="inline-flex items-center rounded border border-border bg-muted/50 px-2 py-1 font-mono text-[10px]">
                  ⌥1-8
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

          {/* Command palette mock */}
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
                { label: "Go to Lineup Generation", icon: "⚡", shortcut: "⌘G" },
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

      {/* ================================================================= */}
      {/* HOW IT WORKS */}
      {/* ================================================================= */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-12">
            <p className="text-primary text-[11px] font-semibold uppercase tracking-wider mb-2">
              Get Started
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
              Up and running in minutes
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <div key={step.step} className="relative">
                {/* Connector line */}
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

      {/* ================================================================= */}
      {/* SUPPORTED PLATFORMS */}
      {/* ================================================================= */}
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
        </div>
      </section>

      {/* ================================================================= */}
      {/* FINAL CTA */}
      {/* ================================================================= */}
      <section className="py-24 px-6 border-t border-border relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-primary/[0.03] rounded-full blur-[80px] pointer-events-none" />

        <div className="relative z-10 text-center max-w-lg mx-auto">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 mb-5">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
            Ready to gain an edge?
          </h2>
          <p className="text-muted-foreground text-sm mt-3 leading-relaxed">
            Connect your league and start making smarter decisions today. Free to
            use, no credit card required.
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

      {/* ================================================================= */}
      {/* FOOTER */}
      {/* ================================================================= */}
      <footer className="border-t border-border py-6 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-display text-xs font-bold text-primary">
              CV
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
              Fantasy basketball analytics platform
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function formatDateRange(start: string, end: string): string {
  try {
    const parseLocalDate = (dateString: string): Date => {
      const [year, month, day] = dateString.split("-").map(Number);
      return new Date(year, month - 1, day);
    };

    const startDate = parseLocalDate(start);
    const endDate = parseLocalDate(end);
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${startDate.toLocaleDateString("en-US", options)} - ${endDate.toLocaleDateString("en-US", options)}`;
  } catch {
    return "";
  }
}
