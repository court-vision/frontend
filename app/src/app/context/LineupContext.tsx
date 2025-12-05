"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useTeams } from "@/app/context/TeamsContext";
import { toast } from "sonner";
import { LINEUPS_API } from "@/endpoints";
import type {
  GenerateLineupResponse,
  GetLineupsResponse,
  SaveLineupResponse,
  DeleteLineupResponse,
} from "@/types/lineup";

interface LineupContextType {
  lineup: Lineup;
  setLineup: (lineup: Lineup) => void;
  savedLineups: Lineup[];
  setSavedLineups: (lineups: Lineup[]) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  generateLineup: (threshold: string, week: string) => void;
  saveLineup: () => void;
  deleteLineup: (lineupId: number) => void;
}

const LineupContext = createContext<LineupContextType>({
  lineup: {
    Id: 0,
    Lineup: [],
    Improvement: 0,
    Timestamp: "",
    Week: "",
    Threshold: 0,
  },
  setLineup: (lineup: Lineup) => {},
  savedLineups: [],
  setSavedLineups: (lineups: Lineup[]) => {},
  isLoading: false,
  setIsLoading: (isLoading: boolean) => {},
  generateLineup: (threshold: string, week: string) => {},
  saveLineup: () => {},
  deleteLineup: (lineupId: number) => {},
});

export interface SlimPlayer {
  Name: string;
  AvgPoints: number;
  Team: string;
}

export interface SlimGene {
  Day: number;
  Additions: SlimPlayer[];
  Removals: SlimPlayer[];
  Roster: Record<string, SlimPlayer>;
}

export interface Lineup {
  Id: number;
  Lineup: SlimGene[];
  Improvement: number;
  Timestamp: string;
  Week: string;
  Threshold: number;
}

export const LineupProvider = ({ children }: { children: React.ReactNode }) => {
  const [lineup, setLineup] = useState<Lineup>({Id: 0, Lineup: [], Improvement: 0, Timestamp: "", Week: "", Threshold: 0});
  const [savedLineups, setSavedLineups] = useState<Lineup[]>([{Id: 0, Lineup: [], Improvement: 0, Timestamp: "", Week: "", Threshold: 0}]);
  const [isLoading, setIsLoading] = useState(false);

  const { selectedTeam } = useTeams();

  // ---------------------------------- Generate Lineup ----------------------------------
  const generateLineup = async (threshold: string, week: string) => {
    setIsLoading(true);

    const token = localStorage.getItem("token");
    if (!token || !selectedTeam) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${LINEUPS_API}/generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          team_id: selectedTeam,
          threshold: parseFloat(threshold),
          week: parseInt(week),
        }),
      });

      const data: GenerateLineupResponse = await response.json();

      if (data.status === "success" && data.data) {
        setLineup(data.data);
        toast.success("Lineup generated successfully!");
      } else {
        toast.error(data.message || "Failed to generate lineup.");
      }
    } catch (error) {
      console.error("Generate lineup error:", error);
      toast.error("Internal server error. Please try again later.");
    }

    setIsLoading(false);
  };

  // ---------------------------------- Save Lineup ----------------------------------
  const saveLineup = async () => {
    const token = localStorage.getItem("token");
    if (!token || !selectedTeam) {
      toast.error("Not authenticated or no team selected.");
      return;
    }

    try {
      const response = await fetch(`${LINEUPS_API}/save`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ team_id: selectedTeam, lineup_info: lineup }),
      });

      const data: SaveLineupResponse = await response.json();

      if (data.status === "success") {
        toast.success("Lineup saved successfully!");
        fetchSavedLineups();
      } else if (data.already_exists) {
        toast.error("This lineup has already been saved.");
      } else {
        toast.error(data.message || "Failed to save lineup.");
      }
    } catch (error) {
      console.error("Save lineup error:", error);
      toast.error("Internal server error. Please try again later.");
    }
  };

  // ---------------------------------- Fetch Saved Lineups ----------------------------------
  const fetchSavedLineups = async () => {
    const token = localStorage.getItem("token");
    if (!token || !selectedTeam) return;

    try {
      const response = await fetch(`${LINEUPS_API}?team_id=${selectedTeam}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data: GetLineupsResponse = await response.json();

      if (data.status === "success") {
        setSavedLineups(data.data || []);
      } else {
        // Don't show error for empty lineups
        setSavedLineups([]);
      }
    } catch (error) {
      console.error("Fetch saved lineups error:", error);
      toast.error("Internal server error. Please try again later.");
    }
  };

  // ---------------------------------- Delete a Saved Lineup ----------------------------------
  const deleteLineup = async (lineupId: number) => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Not authenticated.");
      return;
    }

    try {
      const response = await fetch(`${LINEUPS_API}/remove?lineup_id=${lineupId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data: DeleteLineupResponse = await response.json();

      if (data.status === "success") {
        toast.success("Lineup deleted successfully!");
        fetchSavedLineups();
      } else {
        toast.error(data.message || "Failed to delete lineup.");
      }
    } catch (error) {
      console.error("Delete lineup error:", error);
      toast.error("Internal server error. Please try again.");
    }
  };

  // When the selected team changes, re-fetch the saved lineups under that team
  useEffect(() => {
    if (selectedTeam) {
      fetchSavedLineups();
    }
  }, [selectedTeam]);

  return <LineupContext.Provider value={{ lineup, setLineup, savedLineups, setSavedLineups, isLoading, setIsLoading, generateLineup, saveLineup, deleteLineup }}>{children}</LineupContext.Provider>;
};

export const useLineup = () => useContext(LineupContext);
