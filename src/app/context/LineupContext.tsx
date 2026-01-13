"use client";
import React, { createContext, useContext, useState } from "react";
import { useTeams } from "@/app/context/TeamsContext";
import {
  useGenerateLineupMutation,
  useSaveLineupMutation,
  useDeleteLineupMutation,
  useLineupsQuery,
} from "@/hooks/useLineups";
import type { Lineup } from "@/types/lineup";

interface LineupContextType {
  lineup: Lineup;
  setLineup: (lineup: Lineup) => void;
  savedLineups: Lineup[];
  setSavedLineups: (lineups: Lineup[]) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  generateLineup: (threshold: string, week: string) => void;
  saveLineup: (lineupToSave: Lineup) => void;
  deleteLineup: (lineupId: number) => void;
}

const initialLineup: Lineup = {
  Id: 0,
  Lineup: [],
  Improvement: 0,
  Timestamp: "",
  Week: 0,
  Threshold: 0,
};

const LineupContext = createContext<LineupContextType>({
  lineup: initialLineup,
  setLineup: () => {},
  savedLineups: [],
  setSavedLineups: () => {},
  isLoading: false,
  setIsLoading: () => {},
  generateLineup: () => {},
  saveLineup: (_lineupToSave: Lineup) => {},
  deleteLineup: () => {},
});

export const LineupProvider = ({ children }: { children: React.ReactNode }) => {
  const [lineup, setLineup] = useState<Lineup>(initialLineup);

  // We keep this local state because the generated lineup isn't saved yet
  // so it doesn't come from the server cache
  const [isLoading, setIsLoading] = useState(false);

  const { selectedTeam } = useTeams();

  // React Query Hooks - now uses Clerk auth internally
  const { data: savedLineups = [] } = useLineupsQuery(selectedTeam);

  const { mutate: generateLineupMutation } = useGenerateLineupMutation();
  const { mutate: saveLineupMutation } = useSaveLineupMutation();
  const { mutate: deleteLineupMutation } = useDeleteLineupMutation();

  const generateLineup = (threshold: string, week: string) => {
    if (!selectedTeam) return;

    setIsLoading(true);
    generateLineupMutation(
      {
        team_id: selectedTeam,
        threshold: parseFloat(threshold),
        week: parseInt(week),
      },
      {
        onSuccess: (data) => {
          if (data.status === "success" && data.data) {
            setLineup(data.data);
          }
          setIsLoading(false);
        },
        onError: () => {
          setIsLoading(false);
        },
      }
    );
  };

  const saveLineup = (lineupToSave: Lineup) => {
    if (!selectedTeam) return;

    saveLineupMutation({
      teamId: selectedTeam,
      lineup: lineupToSave,
    });
  };

  const deleteLineup = (lineupId: number) => {
    deleteLineupMutation(lineupId);
  };

  return (
    <LineupContext.Provider
      value={{
        lineup,
        setLineup,
        savedLineups,
        setSavedLineups: () => {}, // Read-only from RQ
        isLoading,
        setIsLoading,
        generateLineup,
        saveLineup,
        deleteLineup,
      }}
    >
      {children}
    </LineupContext.Provider>
  );
};

export const useLineup = () => useContext(LineupContext);
