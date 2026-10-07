"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { asOfLabel, recapCaveats, standingsMode } from "@/lib/draft-recap";
import { Card } from "@/components/ui/card";
import { RecapPickTable } from "@/components/draft/RecapPickTable";
import { RecapSeatCards } from "@/components/draft/RecapSeatCards";
import { RecapSectionBar } from "@/components/draft/RecapSectionBar";
import { RecapStandings } from "@/components/draft/RecapStandings";
import type { DraftRecapResult } from "@/types/draft";

/**
 * The recap, from the recap alone: caveats first, then the seats graded
 * against each other, every pick priced, and where the rosters project to
 * finish. Nothing here reads a session or an auth state, so the same view can
 * one day render a shared link.
 */
export function RecapView({ recap }: { recap: DraftRecapResult }) {
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const caveats = useMemo(() => recapCaveats(recap.meta, recap.seats.length), [recap]);
  const asOf = asOfLabel(recap.meta);
  const mode = standingsMode(recap.meta, recap.standings);

  if (recap.picks.length === 0) {
    return (
      <Card variant="panel" className="p-8 text-center">
        <p className="text-sm font-medium">Nothing to recap yet</p>
        <p className="mt-1 text-xs text-muted-foreground">{recap.message}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {(caveats.length > 0 || asOf) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5 font-mono text-[10px]">
          {caveats.map((caveat) => (
            <span
              key={caveat.key}
              className={caveat.tone === "warn" ? "text-amber-500" : "text-muted-foreground"}
            >
              {caveat.text}
            </span>
          ))}
          {asOf && <span className="text-muted-foreground/60">{asOf}</span>}
        </div>
      )}

      <Card variant="panel" className="overflow-hidden">
        <RecapSectionBar
          title="Seats"
          right={selectedSlot === null ? "click a seat to see its picks" : "click again to show every pick"}
        />
        <div className="p-3">
          <RecapSeatCards
            seats={recap.seats}
            picks={recap.picks}
            gradedBy={recap.meta?.graded_by ?? null}
            selected={selectedSlot}
            onSelect={(slot) => setSelectedSlot((current) => (current === slot ? null : slot))}
          />
        </div>
      </Card>

      <Card variant="panel" className="overflow-hidden">
        <RecapPickTable
          picks={recap.picks}
          seats={recap.seats}
          meta={recap.meta}
          selectedSlot={selectedSlot}
          onClearFilter={() => setSelectedSlot(null)}
        />
      </Card>

      {mode !== "none" && (
        <Card variant="panel" className={cn("overflow-hidden")}>
          <RecapStandings
            standings={recap.standings}
            seats={recap.seats}
            meta={recap.meta}
            mode={mode}
          />
        </Card>
      )}
    </div>
  );
}
