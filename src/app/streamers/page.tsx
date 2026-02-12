"use client";

import StreamerDisplay from "@/components/streamers-components/StreamerDisplay";

export default function Streamers() {
  return (
    <div className="space-y-4 animate-slide-up-fade">
      <section>
        <h1 className="font-display text-xl font-bold tracking-tight">
          Streamers
        </h1>
        <p className="text-muted-foreground text-xs mt-0.5">
          Find the best free agents to stream for the week or pick up today.
        </p>
      </section>
      <StreamerDisplay />
    </div>
  );
}
