"use client";

import { CalendarClock, Medal, Sparkles } from "lucide-react";
import Link from "next/link";
import { useSeason } from "@/hooks/useSeason";
import { formatSeasonDate } from "@/lib/season";

/**
 * Season-phase banner. Renders nothing during the regular season; otherwise
 * points users at what's useful right now (bracket, connect a league, ...).
 */
export function SeasonBanner() {
  const season = useSeason();
  const { phase } = season;
  if (phase === "regular") return null;

  const link = (href: string, text: string) => (
    <Link href={href} className="text-primary hover:underline font-medium">
      {text}
    </Link>
  );

  const tipoff = formatSeasonDate(season.regularSeasonStart);

  let Icon = Medal;
  let body: React.ReactNode;

  if (phase === "playoffs") {
    body = (
      <>
        The {season.label} fantasy regular season is over. NBA Playoffs are live —{" "}
        {link("/playoffs", "view the bracket")} or {link("/terminal", "follow games in the terminal")}.
      </>
    );
  } else if (phase === "preseason") {
    Icon = CalendarClock;
    body = (
      <>
        Preseason is underway. {season.label} tips off {tipoff} —{" "}
        {link("/manage-teams", "connect your league")} and sync its scoring format to be ready for opening
        night.
      </>
    );
  } else if (season.isUpcoming) {
    // Offseason, calendar already on the upcoming season.
    Icon = Sparkles;
    body = (
      <>
        The {season.prevLabel} season is in the books. {season.label} tips off {tipoff} —{" "}
        {link("/manage-teams", "connect your league now")} so matchups, rankings, and streamers are tuned to
        your scoring format from day one.
      </>
    );
  } else {
    // Offseason after the Finals, before the calendar rolls over to next season.
    Icon = Sparkles;
    body = (
      <>
        The {season.label} season is in the books. {season.nextLabel} tips off in October —{" "}
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
