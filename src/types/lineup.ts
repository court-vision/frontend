import type { BaseApiResponse } from "./auth";

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
  Id: number | null;
  Lineup: SlimGene[];
  Improvement: number;
  Timestamp: string;
  Week: number;
  StreamingSlots: number;
}

export interface LineupGenerationRequest {
  team_id: number;
  streaming_slots: number;
  week: number;
  avg_mode?: "season" | "recent";
}

export interface ScheduleWeek {
  week: number;
  start_date: string;
  end_date: string;
  /** Number of calendar days in the week (7, or 14 for the All-Star week). Absent from older API builds. */
  game_span?: number;
}

/** The active season as the server calendar sees it (`GET /schedule/weeks` → `season`). */
export interface SeasonInfo {
  key: string; // "2026-27"
  label: string; // "2026–27"
  espn_year: number; // 2027
  preseason_start: string | null; // ISO date, null until the NBA publishes it
  regular_season_start: string; // ISO date (opening night)
  regular_season_end: string; // ISO date (last fantasy day)
  phase: "preseason" | "regular" | "offseason";
  season_day: number | null; // 1-based day of the regular season, null outside it
  week_count: number;
}

export interface ScheduleWeeksData {
  weeks: ScheduleWeek[];
  current_week: number | null;
  /** Absent until the backend that publishes it is deployed. */
  season?: SeasonInfo;
}

export interface LineupSaveRequest {
  team_id: number;
  lineup_info: Lineup;
}

// Backend API Response Types
export type ScheduleWeeksResponse = BaseApiResponse<ScheduleWeeksData>;
export type GenerateLineupResponse = BaseApiResponse<Lineup>;
export type GetLineupsResponse = BaseApiResponse<Lineup[]>;
export type SaveLineupResponse = BaseApiResponse<{ lineup_id: number }> & {
  already_exists?: boolean;
};
export type DeleteLineupResponse = BaseApiResponse<{ deleted: boolean }>;
