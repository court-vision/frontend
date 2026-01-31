"use client";

import React from "react";
import Link from "next/link";
import { Zap, UserPlus, Trophy, Swords, Users, BarChart3 } from "lucide-react";
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
    <div className="space-y-6 animate-slide-up-fade">
      {/* Welcome Section */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {selectedTeam
              ? "Here's your fantasy overview."
              : "Select a team to get started."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/lineup-generation">
            <Button variant="default" size="sm">
              <Zap className="h-4 w-4 mr-2" />
              Generate Lineup
            </Button>
          </Link>
        </div>
      </section>

      {/* Quick Stats Row */}
      {selectedTeam && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Main Content Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Matchup Preview - 2 cols */}
        <Card variant="elevated" className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">
              This Week's Matchup
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
        <Card variant="elevated">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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
      <Card variant="elevated">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">
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
      title: "Lineup Generation",
      description: "Optimize your streaming moves for the week with algorithmic recommendations.",
      icon: Zap,
      href: "/lineup-generation",
    },
    {
      title: "Matchup Analysis",
      description: "View your matchup and projected winner in real-time.",
      icon: Swords,
      href: "/matchup",
    },
    {
      title: "Streamer Finder",
      description: "Find the best free agents to add to your lineup.",
      icon: UserPlus,
      href: "/streamers",
    },
    {
      title: "Player Rankings",
      description: "View fantasy rankings updated daily.",
      icon: Trophy,
      href: "/rankings",
    },
    {
      title: "Team Analysis",
      description: "Get a broad snapshot of your teams.",
      icon: Users,
      href: "/your-teams",
    },
    {
      title: "Advanced Tools",
      description: "Developer-grade tools for fantasy dominance.",
      icon: BarChart3,
      href: "/",
    },
  ];

  return (
    <div className="space-y-8 animate-slide-up-fade">
      {/* Hero Section */}
      <section className="text-center py-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
          Welcome to Court Vision
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
          Advanced tools to help you win your ESPN fantasy basketball league.
          Sign in to connect your teams and get started.
        </p>
        <div className="mt-6">
          <Link href="/account">
            <Button variant="glow" size="lg">
              Get Started
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Link key={feature.title} href={feature.href}>
              <Card variant="interactive" className="h-full p-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

function formatDateRange(start: string, end: string): string {
  try {
    // Parse date strings as local dates to avoid timezone conversion issues
    // Date strings like "2025-11-15" are parsed as UTC, which can cause day shifts
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
