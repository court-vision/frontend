"use client";

import RankingsDisplay from "@/components/rankings-components/RankingsDisplay";
import { SeasonBanner } from "@/components/SeasonBanner";
import { useSeason } from "@/hooks/useSeason";
import { seasonHeadline } from "@/lib/season";

export default function Rankings() {
  const season = useSeason();
  return (
    <div className="space-y-4 animate-slide-up-fade">
      <section>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Rankings
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {seasonHeadline("rankings", season.phase, season)}
        </p>
      </section>
      <SeasonBanner />
      <RankingsDisplay />
    </div>
  );
}
