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
}

export interface ScheduleWeek {
  week: number;
  start_date: string;
  end_date: string;
}

export interface ScheduleWeeksData {
  weeks: ScheduleWeek[];
  current_week: number | null;
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
