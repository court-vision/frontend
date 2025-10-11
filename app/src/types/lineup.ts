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

export interface LineupGenerationRequest {
  selected_team: number;
  threshold: string;
  week: string;
}
