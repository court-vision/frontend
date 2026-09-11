"use client";

import StreamerDisplay from "@/components/streamers-components/StreamerDisplay";
import { PageHeader } from "@/components/PageHeader";

export default function Streamers() {
  return (
    <div className="space-y-4 animate-slide-up-fade">
      <PageHeader
        title="Streamers"
        subtitle="Find the best free agents to stream for the week or pick up today."
      />
      <StreamerDisplay />
    </div>
  );
}
