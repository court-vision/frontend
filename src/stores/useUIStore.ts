import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIStore {
  // Team selection
  selectedTeam: number | null;
  setSelectedTeam: (teamId: number | null) => void;

  // Provider theme tracking
  selectedProvider: "espn" | "yahoo" | null;
  setSelectedProvider: (provider: "espn" | "yahoo" | null) => void;

  // Rankings model selection
  selectedRankingModel: string;
  setSelectedRankingModel: (model: string) => void;

  // Lineup generation form
  selectedLineupWeek: string | null;
  /** Season key (e.g. "2026-27") the persisted week belongs to; a week saved for another season is ignored. */
  selectedLineupSeason: string | null;
  /** Set the week; pass `seasonKey` to record which season it belongs to in the same update. */
  setSelectedLineupWeek: (week: string | null, seasonKey?: string | null) => void;
  setSelectedLineupSeason: (seasonKey: string | null) => void;

  // Modal states
  isManageTeamsModalOpen: boolean;
  setManageTeamsModalOpen: (open: boolean) => void;

  isAddTeamModalOpen: boolean;
  setAddTeamModalOpen: (open: boolean) => void;

  isEditTeamModalOpen: boolean;
  setEditTeamModalOpen: (open: boolean) => void;

  // Sidebar states
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // First-run "connect a team" banner on the dashboard
  dismissedConnectPrompt: boolean;
  setDismissedConnectPrompt: (dismissed: boolean) => void;
}

// Only persist team selection, provider, ranking model, lineup week (+ its season), and dismissals
const partialize = (state: UIStore) => ({
  selectedTeam: state.selectedTeam,
  selectedProvider: state.selectedProvider,
  selectedRankingModel: state.selectedRankingModel,
  selectedLineupWeek: state.selectedLineupWeek,
  selectedLineupSeason: state.selectedLineupSeason,
  dismissedConnectPrompt: state.dismissedConnectPrompt,
});

type PersistedUIState = ReturnType<typeof partialize>;

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // Team selection
      selectedTeam: null,
      setSelectedTeam: (teamId) => set({ selectedTeam: teamId }),

      // Provider theme tracking
      selectedProvider: null,
      setSelectedProvider: (provider) => set({ selectedProvider: provider }),

      // Rankings model selection
      selectedRankingModel: "Handpicked",
      setSelectedRankingModel: (model) => set({ selectedRankingModel: model }),

      // Lineup generation form
      selectedLineupWeek: null,
      selectedLineupSeason: null,
      setSelectedLineupWeek: (week, seasonKey) =>
        set(
          seasonKey === undefined
            ? { selectedLineupWeek: week }
            : { selectedLineupWeek: week, selectedLineupSeason: seasonKey }
        ),
      setSelectedLineupSeason: (seasonKey) => set({ selectedLineupSeason: seasonKey }),

      // Modal states
      isManageTeamsModalOpen: false,
      setManageTeamsModalOpen: (open) => set({ isManageTeamsModalOpen: open }),

      isAddTeamModalOpen: false,
      setAddTeamModalOpen: (open) => set({ isAddTeamModalOpen: open }),

      isEditTeamModalOpen: false,
      setEditTeamModalOpen: (open) => set({ isEditTeamModalOpen: open }),

      // Sidebar states
      isSidebarOpen: false,
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),

      // First-run banner
      dismissedConnectPrompt: false,
      setDismissedConnectPrompt: (dismissed) =>
        set({ dismissedConnectPrompt: dismissed }),
    }),
    {
      name: "ui-store",
      // v2: the lineup week is scoped to a season. Anything persisted before
      // that can't be trusted after rollover, so drop it.
      version: 2,
      migrate: (persisted, version): PersistedUIState => {
        const state = (persisted ?? {}) as PersistedUIState;
        if (version < 2) {
          return { ...state, selectedLineupWeek: null, selectedLineupSeason: null };
        }
        return state;
      },
      partialize,
    }
  )
);
