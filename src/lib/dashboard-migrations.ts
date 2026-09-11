/**
 * Versioned migrations for the persisted dashboard store. Pure and
 * deterministic so they are testable and idempotent; the store's `persist`
 * config wires `migrateDashboardStore` in.
 *
 * v1 (2026-09): the Daily Actions widget joins every saved team layout at the
 * top-left. Seeding only ever runs for a team key that has no layout yet, so
 * existing users would otherwise never see it without the catalog or a reset.
 */
import type { DashboardLayouts, DashboardWidgetItem } from "@/types/dashboard";

export const DASHBOARD_STORE_VERSION = 1;
export const DAILY_ACTIONS_ID = "daily-actions";
export const DAILY_ACTIONS_SIZE = { w: 5, h: 5, minW: 3, minH: 3 } as const;

/**
 * Put the Daily Actions widget at (0, 0) of every non-"default" layout that
 * has widgets but no such widget yet, shifting the rest down by its height
 * (the grid re-packs vertically on first render). Everything else passes
 * through untouched.
 */
export function insertDailyActions(layouts: DashboardLayouts): DashboardLayouts {
  const out: DashboardLayouts = {};
  for (const [key, layout] of Object.entries(layouts)) {
    const widgets = layout?.widgets ?? [];
    if (key === "default" || widgets.length === 0 || widgets.some((w) => w.definitionId === DAILY_ACTIONS_ID)) {
      out[key] = layout;
      continue;
    }
    const item: DashboardWidgetItem = {
      i: `${DAILY_ACTIONS_ID}-${key}`,
      definitionId: DAILY_ACTIONS_ID,
      x: 0,
      y: 0,
      ...DAILY_ACTIONS_SIZE,
    };
    out[key] = {
      ...layout,
      widgets: [item, ...widgets.map((w) => ({ ...w, y: w.y + DAILY_ACTIONS_SIZE.h }))],
    };
  }
  return out;
}

export interface PersistedDashboardState {
  layouts: DashboardLayouts;
}

export function migrateDashboardStore(persisted: unknown, version: number): PersistedDashboardState {
  const state = (persisted ?? {}) as Partial<PersistedDashboardState>;
  const layouts = state.layouts ?? {};
  if (version < 1) return { ...state, layouts: insertDailyActions(layouts) };
  return { ...state, layouts };
}
