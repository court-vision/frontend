"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  Dispatch,
  SetStateAction,
  useCallback,
} from "react";
import { toast } from "sonner";
import { useAuth } from "@/app/context/AuthContext";
import { TEAMS_API } from "@/endpoints";
import type {
  TeamGetResponse,
  TeamAddResponse,
  TeamUpdateResponse,
  TeamRemoveResponse,
} from "@/types/team";

interface TeamsContextType {
  selectedTeam: number | null;
  setSelectedTeam: (team_id: number) => void;
  teams: Team[];
  setTeams: Dispatch<SetStateAction<Team[]>>;
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

interface TeamInfo {
  team_name: string;
  league_name: string;
  league_id: number;
  year: number;
  espn_s2?: string;
  swid?: string;
}

interface Team {
  team_id: number;
  team_info: TeamInfo;
}

export interface RosterPlayer {
  name: string;
  avg_points: number;
  team: string;
  valid_positions: string[];
  injured: boolean;
}

const TeamsContext = createContext<TeamsContextType>({
  selectedTeam: 0,
  setSelectedTeam: (team_id: number) => {},
  teams: [],
  setTeams: () => {},
  rosterInfo: [],
  handleManageTeamsClick: () => {},
  fetchTeams: () => {},
  addTeam: (
    league_id: string,
    team_name: string,
    year: string,
    espn_s2?: string,
    swid?: string
  ) => {},
  editTeam: (
    team_id: number,
    league_id: string,
    team_name: string,
    year: string,
    espn_s2?: string,
    swid?: string
  ) => {},
  deleteTeam: (team_id: number) => {},
  getLineupInfo: (team_id?: number) => {},
});

interface leagueInfoRequest {
  league_id: number;
  espn_s2?: string;
  swid?: string;
  team_name: string;
  league_name?: string;
  year: number;
}

export const TeamsProvider = ({ children }: { children: React.ReactNode }) => {
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [rosterInfo, setRosterInfo] = useState<RosterPlayer[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  const { isLoggedIn, logout, setPage } = useAuth();

  const handleManageTeamsClick = () => {
    setPage("manage-teams");
  };

  // ---------------------------------- Fetch Teams ----------------------------------
  const fetchTeams = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await fetch(`${TEAMS_API}/`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 401) {
        toast.error("Invalid or expired token. Please log in again.");
        logout();
        return;
      }

      const data: TeamGetResponse = await response.json();

      if (data.status === "success" && data.data) {
        // Transform league_info to team_info for backwards compatibility
        const transformedTeams: Team[] = data.data.map((team) => ({
          team_id: team.team_id,
          team_info: {
            team_name: team.league_info.team_name,
            league_name: team.league_info.league_name ?? "N/A",
            league_id: team.league_info.league_id,
            year: team.league_info.year,
            espn_s2: team.league_info.espn_s2 ?? undefined,
            swid: team.league_info.swid ?? undefined,
          },
        }));
        setTeams(transformedTeams);
      } else {
        toast.error(data.message || "Failed to fetch teams.");
      }
    } catch (error) {
      console.error("Fetch teams error:", error);
      toast.error("Internal server error. Please try again later.");
    }
  };

  // ---------------------------------- Add Team --------------------------------
  const addTeam = async (
    league_id: string,
    team_name: string,
    year: string,
    league_name?: string,
    espn_s2?: string,
    swid?: string
  ) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const leagueInfo: leagueInfoRequest = {
      league_id: parseInt(league_id),
      espn_s2: espn_s2,
      swid: swid,
      team_name: team_name,
      league_name: league_name,
      year: parseInt(year),
    };

    try {
      const response = await fetch(`${TEAMS_API}/add`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ league_info: leagueInfo }),
      });

      const data: TeamAddResponse = await response.json();

      if (data.status === "success") {
        if (data.already_exists) {
          toast.error("You have already added this team to your account.");
        } else {
          toast.success("Team added successfully.");
          fetchTeams();
        }
      } else {
        toast.error(data.message || "Invalid league information.");
      }
    } catch (error) {
      console.error("Add team error:", error);
      toast.error("Internal server error. Please try again later.");
    }
  };

  // ---------------------------------- Edit Team --------------------------------
  const editTeam = async (
    team_id: number,
    league_id: string,
    team_name: string,
    year: string,
    league_name?: string,
    espn_s2?: string,
    swid?: string
  ) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const leagueInfo: leagueInfoRequest = {
      league_id: parseInt(league_id),
      espn_s2: espn_s2,
      swid: swid,
      league_name: league_name,
      team_name: team_name,
      year: parseInt(year),
    };

    try {
      const response = await fetch(`${TEAMS_API}/update`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ team_id: team_id, league_info: leagueInfo }),
      });

      const data: TeamUpdateResponse = await response.json();
      console.log("DATA", data);

      if (data.status === "success") {
        toast.success("Team edited successfully.");
        fetchTeams();
      } else {
        toast.error(data.message || "Edited team information invalid.");
      }
    } catch (error) {
      console.error("Edit team error:", error);
      toast.error("Internal server error. Please try again later.");
    }
  };

  // ---------------------------------- Delete Team --------------------------------
  const deleteTeam = async (team_id: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await fetch(`${TEAMS_API}/remove?team_id=${team_id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data: TeamRemoveResponse = await response.json();

      if (data.status === "success") {
        toast.success("Team deleted successfully.");
        fetchTeams();
      } else {
        toast.error(data.message || "Failed to delete team.");
      }
    } catch (error) {
      console.error("Delete team error:", error);
      toast.error("Internal server error. Please try again later.");
    }
  };

  // -------------------------------- Get Lineup Info ------------------------------
  const getLineupInfo = useCallback(
    async (team_id?: number) => {
      setRosterLoading(true);

      const token = localStorage.getItem("token");
      if (!token) {
        setRosterLoading(false);
        return;
      }

      if (!isLoggedIn) {
        setRosterLoading(false);
        return;
      }

      if (!team_id && !selectedTeam) {
        setRosterLoading(false);
        return;
      }

      // Make sure the team belongs to the user if team_id is provided
      if (team_id) {
        if (!teams.some((team) => team.team_id === team_id)) {
          setRosterLoading(false);
          return;
        }
      }

      try {
        const targetTeamId = team_id ?? selectedTeam!;

        const response = await fetch(
          `${TEAMS_API}/view?team_id=${targetTeamId}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        const data = await response.json();

        if (data.status === "success" && data.data) {
          setRosterInfo(data.data);
        } else {
          toast.error(data.message || "Failed to fetch roster info.");
        }
        setRosterLoading(false);
      } catch (error) {
        console.error("Get lineup info error:", error);
        toast.error("Internal server error. Please try again later.");
        setRosterLoading(false);
      }
    },
    [isLoggedIn, teams, selectedTeam]
  );

  // ---------------------------------- Use Effects --------------------------------

  // Fetch teams on login
  useEffect(() => {
    // Only fetch teams when logged in - don't manipulate loading state here
    // (AuthContext manages loading state)
    if (isLoggedIn) {
      fetchTeams();
    }
  }, [isLoggedIn]);

  // Set selected team to first team in list
  useEffect(() => {
    // Only set if we have teams and no team is currently selected
    // or if the currently selected team is no longer in the list
    if (teams && teams.length > 0) {
      const isSelectedTeamInList = selectedTeam
        ? teams.some((t) => t.team_id === selectedTeam)
        : false;

      if (!selectedTeam || !isSelectedTeamInList) {
        setSelectedTeam(teams[0].team_id);
      }
    } else if (teams && teams.length === 0) {
      setSelectedTeam(null);
    }
  }, [teams, selectedTeam]);

  return (
    <TeamsContext.Provider
      value={{
        selectedTeam,
        setSelectedTeam,
        teams,
        setTeams,
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
