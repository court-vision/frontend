"use client";

import { useState } from "react";
import { DashboardWidget } from "./DashboardWidget";
import { DashboardWidgetRenderer } from "./DashboardWidgetRenderer";
import { getWidgetDefinition } from "./DashboardWidgetRegistry";
import type { DashboardWidgetItem } from "@/types/dashboard";

/** Matches DashboardGrid's ROW_HEIGHT so a widget is about as tall as on desktop. */
const ROW_HEIGHT = 60;
/** Cap so one widget never fills a phone screen by itself. */
const MAX_CONTENT_HEIGHT = 420;

interface DashboardStackProps {
  teamKey: string;
  /** Already in display order — see `orderForMobile`. */
  widgets: DashboardWidgetItem[];
}

/**
 * Phone dashboard: a read-only vertical stack of collapsible widgets. No
 * drag/resize/edit, and nothing here writes to the persisted dashboard store —
 * collapsed state is local to the session.
 */
export function DashboardStack({ teamKey, widgets }: DashboardStackProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const toggle = (instanceId: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      {widgets.map((widget) => {
        const def = getWidgetDefinition(widget.definitionId);
        const contentHeight = Math.min(
          (def?.defaultH ?? widget.h) * ROW_HEIGHT,
          MAX_CONTENT_HEIGHT
        );
        return (
          <DashboardWidget
            key={widget.i}
            instanceId={widget.i}
            definitionId={widget.definitionId}
            teamKey={teamKey}
            collapsed={collapsed.has(widget.i)}
            onToggleCollapsed={() => toggle(widget.i)}
            contentHeight={contentHeight}
          >
            <DashboardWidgetRenderer definitionId={widget.definitionId} />
          </DashboardWidget>
        );
      })}
    </div>
  );
}
