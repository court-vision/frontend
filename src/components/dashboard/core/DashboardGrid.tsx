"use client";

import { useCallback } from "react";
import {
  GridLayout,
  useContainerWidth,
  type Layout,
  type LayoutItem,
} from "react-grid-layout";
import { useDashboardStore } from "@/stores/useDashboardStore";
import { DashboardWidget } from "./DashboardWidget";
import { DashboardWidgetRenderer } from "./DashboardWidgetRenderer";
import type { DashboardWidgetItem } from "@/types/dashboard";

import "react-grid-layout/css/styles.css";

const COLS = 12;
const ROW_HEIGHT = 60;
const MARGIN: [number, number] = [8, 8];

interface DashboardGridProps {
  teamKey: string;
  widgets: DashboardWidgetItem[];
}

export function DashboardGrid({ teamKey, widgets }: DashboardGridProps) {
  const { isEditMode, setLayout } = useDashboardStore();
  const { width, containerRef, mounted } = useContainerWidth({
    initialWidth: 1200,
  });

  const handleLayoutChange = useCallback(
    (newLayout: Layout) => {
      // Merge RGL position updates back into our widget items (preserve definitionId)
      const merged: DashboardWidgetItem[] = (
        newLayout as readonly LayoutItem[]
      )
        .map((l) => {
          const original = widgets.find((w) => w.i === l.i);
          if (!original) return null;
          return { ...original, ...l, definitionId: original.definitionId };
        })
        .filter(Boolean) as DashboardWidgetItem[];
      setLayout(teamKey, { cols: COLS, widgets: merged });
    },
    [teamKey, widgets, setLayout]
  );

  const layout: LayoutItem[] = widgets.map(
    ({ i, x, y, w, h, minW, minH, maxW }) => ({
      i,
      x,
      y,
      w,
      h,
      minW,
      minH,
      maxW,
      static: !isEditMode,
    })
  );

  return (
    <div ref={containerRef}>
      {mounted && (
        <GridLayout
          className="layout"
          layout={layout}
          width={width}
          gridConfig={{
            cols: COLS,
            rowHeight: ROW_HEIGHT,
            margin: MARGIN,
          }}
          dragConfig={{
            enabled: isEditMode,
            handle: ".widget-drag-handle",
          }}
          resizeConfig={{
            enabled: isEditMode,
          }}
          onLayoutChange={handleLayoutChange}
          autoSize
        >
          {widgets.map((widget) => (
            <div key={widget.i}>
              <DashboardWidget
                instanceId={widget.i}
                definitionId={widget.definitionId}
                teamKey={teamKey}
                className="h-full"
              >
                <DashboardWidgetRenderer definitionId={widget.definitionId} />
              </DashboardWidget>
            </div>
          ))}
        </GridLayout>
      )}
    </div>
  );
}
