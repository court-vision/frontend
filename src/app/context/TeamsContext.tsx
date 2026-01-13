"use client";
import React, {
  createContext,
  useContext,
  Dispatch,
  SetStateAction,
} from "react";
import { useUIStore } from "@/stores/useUIStore";
import {
  useTeamsQuery,
  useAddTeamMutation,
  useUpdateTeamMutation,
  useDeleteTeamMutation,
  useTeamRosterQuery,
} from "@/hooks/useTeams";
import type { RosterPlayer } from "@/types/team";

interface TeamsContextType {
  selectedTeam: number | null;
  setSelectedTeam: (team_id: number) => void;
  teams: any[]; // using any[] for now since we are moving away from this
  setTeams: Dispatch<SetStateAction<any[]>>;
  rosterInfo: RosterPlayer[];
  handleManageTeamsClick: () => void;
  fetchTeams: () => void;
  addTeam: (
    league_id: string,
    team_name: string,
    year: string,
    league_name?: string,
    espn_s2?: string,
    swid?: string
  ) => void;
  editTeam: (
    team_id: number,
    league_id: string,
    team_name: string,
    year: string,
    league_name?: string,
    espn_s2?: string,
    swid?: string
  ) => void;
  deleteTeam: (team_id: number) => void;
  getLineupInfo: (team_id?: number) => void;
}

const TeamsContext = createContext<TeamsContextType>({
  selectedTeam: 0,
  setSelectedTeam: () => {},
  teams: [],
  setTeams: () => {},
  rosterInfo: [],
  handleManageTeamsClick: () => {},
  fetchTeams: () => {},
  addTeam: () => {},
  editTeam: () => {},
  deleteTeam: () => {},
  getLineupInfo: () => {},
});

export const TeamsProvider = ({ children }: { children: React.ReactNode }) => {
  const { selectedTeam, setSelectedTeam } = useUIStore();

  // React Query Hooks - now use Clerk auth internally
  const { data: teams = [], refetch: refetchTeams } = useTeamsQuery();
  const { data: rosterInfo = [], refetch: refetchRoster } =
    useTeamRosterQuery(selectedTeam);

  const { mutate: addTeamMutation } = useAddTeamMutation();
  const { mutate: updateTeamMutation } = useUpdateTeamMutation();
  const { mutate: deleteTeamMutation } = useDeleteTeamMutation();

  const handleManageTeamsClick = () => {
    // Navigation is now handled by Next.js routing
    // Use <Link href="/manage-teams"> in components instead
  };

  // Adapter functions to maintain backward compatibility with components still using context
  const fetchTeams = () => {
    refetchTeams();
  };

  const addTeam = (
    league_id: string,
    team_name: string,
    year: string,
    league_name?: string,
    espn_s2?: string,
    swid?: string
  ) => {
    addTeamMutation({
      league_id: parseInt(league_id),
      team_name,
      year: parseInt(year),
      league_name,
      espn_s2,
      swid,
    });
  };

  const editTeam = (
    team_id: number,
    league_id: string,
    team_name: string,
    year: string,
    league_name?: string,
    espn_s2?: string,
    swid?: string
  ) => {
    updateTeamMutation({
      teamId: team_id,
      teamData: {
        league_id: parseInt(league_id),
        team_name,
        year: parseInt(year),
        league_name,
        espn_s2,
        swid,
      },
    });
  };

  const deleteTeam = (team_id: number) => {
    deleteTeamMutation(team_id);
  };

  const getLineupInfo = (team_id?: number) => {
    // This is largely handled by the useTeamRosterQuery hook now
    // But if a specific team_id is passed that isn't selectedTeam, we can't easily adapt it
    // without changing the hook usage. For now, this is a no-op or triggers a refetch
    // if team_id matches selectedTeam.
    if (team_id === selectedTeam || !team_id) {
      refetchRoster();
    }
  };

  return (
    <TeamsContext.Provider
      value={{
        selectedTeam,
        setSelectedTeam,
        teams,
        setTeams: () => {}, // No-op since we use RQ
        rosterInfo,
        handleManageTeamsClick,
        fetchTeams,
        addTeam,
        editTeam,
        deleteTeam,
        getLineupInfo,
      }}
    >
      {children}
    </TeamsContext.Provider>
  );
};

export const useTeams = () => useContext(TeamsContext);
