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
import { useMatchupQuery } from "@/hooks/useMatchup";
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

  const yourScore = matchup?.your_team.current_score ?? 0;
  const opponentScore = matchup?.opponent_team.current_score ?? 0;
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

function WelcomeView() {
  const features = [
    {
      title: "Lineup Optimization",
      description:
        "Algorithmically optimize your streaming moves for the week. Our engine evaluates schedules, matchups, and projections to find the best adds and drops.",
      icon: Zap,
      tag: "⌘G",
    },
    {
      title: "Live Matchup Tracking",
      description:
        "Real-time scoring, projected winners, and head-to-head breakdowns. Watch your matchup unfold with live stat updates.",
      icon: Swords,
      tag: "⌘M",
    },
    {
      title: "Streamer Finder",
      description:
        "Surface the best free agents based on upcoming schedule, category needs, and matchup difficulty. Never miss a streaming opportunity.",
      icon: UserPlus,
      tag: "⌘S",
    },
    {
      title: "Player Rankings",
      description:
        "Comprehensive fantasy rankings updated daily with per-game and total value across all nine categories.",
      icon: Trophy,
      tag: "⌘R",
    },
    {
      title: "Analytics Terminal",
      description:
        "A power-user terminal for deep player analysis. Search players, compare stats, view game logs and performance charts side by side.",
      icon: Activity,
      tag: "⌥7",
    },
    {
      title: "Team Management",
      description:
        "Connect multiple ESPN and Yahoo leagues. Get a unified view across all your teams with roster snapshots and category breakdowns.",
      icon: Users,
      tag: "⌘T",
    },
  ];

  const stats = [
    { value: "9-Cat", label: "Category Analysis" },
    { value: "500+", label: "Players Tracked" },
    { value: "Daily", label: "Rankings Updates" },
    { value: "Real-time", label: "Score Tracking" },
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

          {/* Feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={feature.title}
                  variant="panel"
                  className="p-5 group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
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
                </Card>
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
          <p className="text-[10px] text-muted-foreground/40">
            Fantasy basketball analytics platform
          </p>
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
