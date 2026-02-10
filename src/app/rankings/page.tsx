"use client";

import RankingsDisplay from "@/components/rankings-components/RankingsDisplay";

export default function Rankings() {
  return (
    <div className="space-y-4 animate-slide-up-fade">
      <section>
        <h1 className="font-display text-xl font-bold tracking-tight">
          Rankings
        </h1>
        <p className="text-muted-foreground text-xs mt-0.5">
          Fantasy player rankings updated daily.
        </p>
      </section>
      <RankingsDisplay />
    </div>
  );
}
