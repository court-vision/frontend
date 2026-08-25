"use client";

import { CalendarClock, Medal, Sparkles } from "lucide-react";
import Link from "next/link";
import { SEASON, getSeasonPhase } from "@/lib/season";

/**
 * Season-phase banner. Renders nothing during the regular season; otherwise
 * points users at what's useful right now (bracket, connect a league, ...).
 */
export function SeasonBanner() {
  const phase = getSeasonPhase();
  if (phase === "regular") return null;

  const link = (href: string, text: string) => (
    <Link href={href} className="text-primary hover:underline font-medium">
      {text}
    </Link>
  );

  let Icon = Medal;
  let body: React.ReactNode;

  if (phase === "playoffs") {
    body = (
      <>
        The {SEASON.label} fantasy regular season is over. NBA Playoffs are live —{" "}
        {link("/playoffs", "view the bracket")} or {link("/terminal", "follow games in the terminal")}.
      </>
    );
  } else if (phase === "preseason") {
    Icon = CalendarClock;
    body = (
      <>
        The {SEASON.nextLabel} season tips off soon. {link("/manage-teams", "Connect your league")} and sync
        its scoring format so you&apos;re ready for opening night.
      </>
    );
  } else {
    Icon = Sparkles;
    body = (
      <>
        The {SEASON.label} season is in the books. {SEASON.nextLabel} tips off in October —{" "}
        {link("/manage-teams", "connect your league now")} so matchups, rankings, and streamers are tuned to
        your scoring format from day one.
      </>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-primary/5 border border-primary/15 text-sm">
      <Icon className="h-4 w-4 text-primary shrink-0" />
      <span className="text-muted-foreground">{body}</span>
    </div>
  );
}
