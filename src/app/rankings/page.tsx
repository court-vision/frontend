"use client";

import RankingsDisplay from "@/components/rankings-components/RankingsDisplay";
import { SeasonBanner } from "@/components/SeasonBanner";

export default function Rankings() {
  return (
    <div className="space-y-4 animate-slide-up-fade">
      <section>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Rankings
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          2025–26 season leaders — final standings.
        </p>
      </section>
      <SeasonBanner />
      <RankingsDisplay />
    </div>
  );
}
