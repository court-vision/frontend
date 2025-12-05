"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { useRef } from "react";

const StandingsContext = createContext({
  standings: [] as StandingsPlayer[],
  playerStats: {} as Record<string, StandingsPlayerStats>,
  setStandings: (standings: StandingsPlayer[]) => {},
  fetchPlayerStats: (player_name: string) => {},
});

export interface StandingsPlayer {
  rank: number;
  player_name: string;
  total_fpts: number;
  avg_fpts: number;
  rank_change: number;
}

export interface StandingsPlayerStats {
  avg_stats: {
    avg_points: number;
    avg_rebounds: number;
    avg_assists: number;
  },
  game_logs: {
    date: string;
    fpts: number;
  }[]
}

export const StandingsProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [standings, setStandings] = useState<StandingsPlayer[]>([]);
  const [playerStats, setPlayerStats] = useState<Record<string, StandingsPlayerStats>>({});
	const { setLoading } = useAuth();

  const pathname = usePathname();
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (
      pathname === "/standings" &&
      standings.length === 0 &&
      !fetchedRef.current
    ) {
      setLoading(true);
      fetchStandings();
      fetchedRef.current = true;
    }
  }, [pathname, standings.length]);

  // ----------------------------------- Fetch the player fantasy points standings -----------------------------------
  const fetchStandings = async () => {
    // setLoading(true);
    try {
      const response = await fetch("/api/data/etl/fpts-standings", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.log("Error getting player fantasy points standings.");
        toast.error("Error getting player fantasy points standings.");
        return;
      }

      const data = await response.json();
      setStandings(data.data);
    } catch (error) {
      console.log("Internal server error. Please try again later.");
      toast.error("Internal server error. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------- Fetch the stats for a certain player in standings -----------------------------------
  const fetchPlayerStats = async (player_name: string) => {

    if (playerStats[player_name]) {
      return;
    }

    try {
      const response = await fetch(
        `/api/data/etl/fpts-standings/player-stats?player_name=${player_name}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        console.log("Error getting player stats.");
        toast.error("Error getting player stats.");
        return;
      }

      const data = await response.json();
      setPlayerStats((prev) => ({
        ...prev,
        [player_name]: data,
      }));

      toast.success("Player stats fetched successfully.");

    } catch (error) {
      console.log("Internal server error. Please try again later.");
      toast.error("Internal server error. Please try again later.");
    }
  }

  return (
    <StandingsContext.Provider value={{ standings, playerStats, setStandings, fetchPlayerStats }}>
      {children}
    </StandingsContext.Provider>
  );
};

export const useStandings = () => useContext(StandingsContext);
