import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  TerminalState,
  LayoutPreset,
  StatWindow,
  LayoutState,
  PanelInstance,
  WatchlistPlayer,
} from "@/types/terminal";

const MAX_COMPARISON_PLAYERS = 4;
const MAX_RECENT_VIEWS = 20;
const MAX_COMMAND_HISTORY = 50;

const defaultLayout: LayoutState = {
  preset: "default",
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  leftPanelSize: 25,
  rightPanelSize: 25,
  centerPanels: [],
};

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set, get) => ({
      // Player focus
      focusedPlayerId: null,
      comparisonPlayerIds: [],

      // Watchlist
      watchlist: [],
      recentlyViewed: [],

      // Layout
      layout: defaultLayout,

      // View options
      statWindow: "season",

      // Command history
      commandHistory: [],

      // Actions
      setFocusedPlayer: (id) => {
        set({ focusedPlayerId: id });
        if (id !== null) {
          get().addRecentView(id);
        }
      },

      addToComparison: (id) => {
        const { comparisonPlayerIds } = get();
        if (
          comparisonPlayerIds.length < MAX_COMPARISON_PLAYERS &&
          !comparisonPlayerIds.includes(id)
        ) {
          set({ comparisonPlayerIds: [...comparisonPlayerIds, id] });
        }
      },

      removeFromComparison: (id) => {
        const { comparisonPlayerIds } = get();
        set({
          comparisonPlayerIds: comparisonPlayerIds.filter((pid) => pid !== id),
        });
      },

      clearComparison: () => {
        set({ comparisonPlayerIds: [] });
      },

      addToWatchlist: (id) => {
        const { watchlist } = get();
        if (!watchlist.some((p) => p.id === id)) {
          const newPlayer: WatchlistPlayer = { id, addedAt: Date.now() };
          set({ watchlist: [...watchlist, newPlayer] });
        }
      },

      removeFromWatchlist: (id) => {
        const { watchlist } = get();
        set({ watchlist: watchlist.filter((p) => p.id !== id) });
      },

      addRecentView: (id) => {
        const { recentlyViewed } = get();
        const filtered = recentlyViewed.filter((pid) => pid !== id);
        const updated = [id, ...filtered].slice(0, MAX_RECENT_VIEWS);
        set({ recentlyViewed: updated });
      },

      setLayoutPreset: (preset) => {
        // Different presets configure different panel visibility
        let leftPanelCollapsed = false;
        let rightPanelCollapsed = false;

        switch (preset) {
          case "chart":
            // Chart-focused: hide right panel
            rightPanelCollapsed = true;
            break;
          case "comparison":
            // Comparison: hide left panel to give more space
            leftPanelCollapsed = true;
            break;
          case "data":
            // Data-focused: hide both sidebars
            leftPanelCollapsed = true;
            rightPanelCollapsed = true;
            break;
          case "default":
          default:
            // Default: show all panels
            break;
        }

        set((state) => ({
          layout: {
            ...state.layout,
            preset,
            leftPanelCollapsed,
            rightPanelCollapsed,
          },
        }));
      },

      toggleLeftPanel: () => {
        set((state) => ({
          layout: {
            ...state.layout,
            leftPanelCollapsed: !state.layout.leftPanelCollapsed,
          },
        }));
      },

      toggleRightPanel: () => {
        set((state) => ({
          layout: {
            ...state.layout,
            rightPanelCollapsed: !state.layout.rightPanelCollapsed,
          },
        }));
      },

      setLeftPanelSize: (size) => {
        set((state) => ({
          layout: { ...state.layout, leftPanelSize: size },
        }));
      },

      setRightPanelSize: (size) => {
        set((state) => ({
          layout: { ...state.layout, rightPanelSize: size },
        }));
      },

      setStatWindow: (window) => {
        set({ statWindow: window });
      },

      addToCommandHistory: (command) => {
        const { commandHistory } = get();
        const updated = [command, ...commandHistory].slice(
          0,
          MAX_COMMAND_HISTORY
        );
        set({ commandHistory: updated });
      },

      addCenterPanel: (panel) => {
        set((state) => ({
          layout: {
            ...state.layout,
            centerPanels: [...state.layout.centerPanels, panel],
          },
        }));
      },

      removeCenterPanel: (panelId) => {
        set((state) => ({
          layout: {
            ...state.layout,
            centerPanels: state.layout.centerPanels.filter(
              (p) => p.id !== panelId
            ),
          },
        }));
      },
    }),
    {
      name: "terminal-store",
      partialize: (state) => ({
        watchlist: state.watchlist,
        recentlyViewed: state.recentlyViewed,
        layout: state.layout,
        statWindow: state.statWindow,
      }),
    }
  )
);
