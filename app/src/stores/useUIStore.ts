import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIStore {
  // Team selection
  selectedTeam: number | null;
  setSelectedTeam: (teamId: number | null) => void;

  // Rankings model selection
  selectedRankingModel: string;
  setSelectedRankingModel: (model: string) => void;

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
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // Team selection
      selectedTeam: null,
      setSelectedTeam: (teamId) => set({ selectedTeam: teamId }),

      // Rankings model selection
      selectedRankingModel: "Handpicked",
      setSelectedRankingModel: (model) => set({ selectedRankingModel: model }),

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
    }),
    {
      name: "ui-store",
      // Only persist team selection and ranking model
      partialize: (state) => ({
        selectedTeam: state.selectedTeam,
        selectedRankingModel: state.selectedRankingModel,
      }),
    }
  )
);
