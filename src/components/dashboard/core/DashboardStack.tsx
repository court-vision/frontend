"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { DashboardWidget } from "./DashboardWidget";
import { DashboardWidgetRenderer } from "./DashboardWidgetRenderer";
import { getWidgetDefinition } from "./DashboardWidgetRegistry";
import type { DashboardWidgetItem } from "@/types/dashboard";

/** Matches DashboardGrid's ROW_HEIGHT so a widget is about as tall as on desktop. */
const ROW_HEIGHT = 60;
/** Cap so one widget never fills a phone screen by itself. */
const MAX_CONTENT_HEIGHT = 420;
/** Widgets shown open at the top of the phone; the rest wait behind chips. */
const LEAD_COUNT = 2;

interface DashboardStackProps {
  teamKey: string;
  /** Already in display order — see `orderForMobile`. */
  widgets: DashboardWidgetItem[];
}

function contentHeightFor(widget: DashboardWidgetItem): number {
  const def = getWidgetDefinition(widget.definitionId);
  return Math.min((def?.defaultH ?? widget.h) * ROW_HEIGHT, MAX_CONTENT_HEIGHT);
}

/**
 * Phone dashboard. The first widgets in the phone order (Daily Actions and
 * the matchup for a team) open at the top; every other widget sits behind a
 * row of chips and shows one at a time, so the day's decisions come first
 * and nothing scrolls for ever. Read-only: nothing here writes to the
 * persisted dashboard store, and the collapsed/picked state is per session.
 */
export function DashboardStack({ teamKey, widgets }: DashboardStackProps) {
  const lead = widgets.slice(0, LEAD_COUNT);
  const rest = widgets.slice(LEAD_COUNT);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [pickedId, setPickedId] = useState<string | null>(null);
  const picked = rest.find((w) => w.i === pickedId) ?? rest[0] ?? null;

  const toggle = (instanceId: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      {lead.map((widget) => (
        <DashboardWidget
          key={widget.i}
          instanceId={widget.i}
          definitionId={widget.definitionId}
          teamKey={teamKey}
          collapsed={collapsed.has(widget.i)}
          onToggleCollapsed={() => toggle(widget.i)}
          contentHeight={contentHeightFor(widget)}
        >
          <DashboardWidgetRenderer definitionId={widget.definitionId} />
        </DashboardWidget>
      ))}

      {picked && (
        <section className="flex flex-col gap-2" aria-label="More panels">
          <div
            role="tablist"
            className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {rest.map((widget) => {
              const def = getWidgetDefinition(widget.definitionId);
              const Icon = def?.icon;
              const active = widget.i === picked.i;
              return (
                <button
                  key={widget.i}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPickedId(widget.i)}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                    active
                      ? "border-primary/25 bg-primary/15 text-primary"
                      : "border-border bg-card/60 text-muted-foreground"
                  )}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {def?.name ?? widget.definitionId}
                </button>
              );
            })}
          </div>
          <DashboardWidget
            key={picked.i}
            instanceId={picked.i}
            definitionId={picked.definitionId}
            teamKey={teamKey}
            contentHeight={contentHeightFor(picked)}
            readOnly
          >
            <DashboardWidgetRenderer definitionId={picked.definitionId} />
          </DashboardWidget>
        </section>
      )}
    </div>
  );
}
