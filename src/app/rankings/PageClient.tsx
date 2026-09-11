"use client";

import { PageHeader } from "@/components/PageHeader";
import RankingsDisplay from "@/components/rankings-components/RankingsDisplay";
import { SeasonBanner } from "@/components/SeasonBanner";
import { useSeason } from "@/hooks/useSeason";
import { seasonHeadline } from "@/lib/season";

export default function Rankings() {
  const season = useSeason();
  return (
    <div className="space-y-4 animate-slide-up-fade">
      <PageHeader title="Rankings" subtitle={seasonHeadline("rankings", season.phase, season)} />
      <SeasonBanner />
      <RankingsDisplay />
    </div>
  );
}
