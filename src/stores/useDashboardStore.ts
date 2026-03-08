import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DashboardState } from "@/types/dashboard";
import { getWidgetDefinition } from "@/components/dashboard/core/DashboardWidgetRegistry";
import { DEFAULT_LAYOUTS } from "@/components/dashboard/core/defaultLayouts";

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      layouts: {},
      isEditMode: false,

      setLayout: (teamKey, layout) =>
        set((s) => ({
          layouts: { ...s.layouts, [teamKey]: layout },
        })),

      resetLayout: (teamKey) => {
        const template =
          teamKey === "default"
            ? DEFAULT_LAYOUTS["default"]
            : DEFAULT_LAYOUTS["team"];
        // Deep clone with fresh instance IDs
        const reset = {
          ...template,
          widgets: template.widgets.map((w) => ({
            ...w,
            i: crypto.randomUUID(),
          })),
        };
        set((s) => ({
          layouts: { ...s.layouts, [teamKey]: reset },
        }));
      },

      toggleEditMode: () => set((s) => ({ isEditMode: !s.isEditMode })),

      addWidget: (teamKey, definitionId) => {
        const { layouts } = get();
        const current = layouts[teamKey];
        if (!current) return;

        const def = getWidgetDefinition(definitionId);
        if (!def) return;

        set((s) => ({
          layouts: {
            ...s.layouts,
            [teamKey]: {
              ...current,
              widgets: [
                ...current.widgets,
                {
                  i: crypto.randomUUID(),
                  x: 0,
                  y: Infinity, // RGL appends to bottom
                  w: def.defaultW,
                  h: def.defaultH,
                  minW: def.minW,
                  minH: def.minH,
                  definitionId,
                },
              ],
            },
          },
        }));
      },

      removeWidget: (teamKey, instanceId) => {
        const { layouts } = get();
        const current = layouts[teamKey];
        if (!current) return;

        set((s) => ({
          layouts: {
            ...s.layouts,
            [teamKey]: {
              ...current,
              widgets: current.widgets.filter((w) => w.i !== instanceId),
            },
          },
        }));
      },
    }),
    {
      name: "dashboard-store-v1",
      partialize: (s) => ({ layouts: s.layouts }),
    }
  )
);
