// API Response Types matching backend base models

export enum ApiStatus {
  SUCCESS = "success",
  ERROR = "error",
  VALIDATION_ERROR = "validation_error",
  AUTHENTICATION_ERROR = "authentication_error",
  AUTHORIZATION_ERROR = "authorization_error",
  NOT_FOUND = "not_found",
  CONFLICT = "conflict",
  RATE_LIMITED = "rate_limited",
  SERVER_ERROR = "server_error",
}

export interface BaseResponse<T = any> {
  status: ApiStatus;
  message: string;
  data?: T;
  error_code?: string;
  timestamp?: string;
}

// Authentication Types
export interface AuthResponse {
  access_token?: string;
  user_id?: number;
  email?: string;
  expires_at?: string;
}

export interface VerificationResponse {
  verification_sent: boolean;
  email: string;
  expires_in_seconds?: number;
  verification_id?: string;
}

export interface UserResponse {
  user_id: number;
  email: string;
  created_at?: string;
  last_login?: string;
}

// Team Types
export interface LeagueInfo {
  league_id: number;
  espn_s2?: string;
  swid?: string;
  team_name: string;
  league_name?: string;
  year: number;
}

export interface TeamResponse {
  team_id: number;
  team_name: string;
  league_id: number;
  league_name: string;
  year: number;
  created_at?: string;
}

// Lineup Types
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

export interface LineupInfo {
  Lineup: SlimGene[];
  Improvement: number;
  Timestamp: string;
  Week: string;
  Threshold: number;
  Id?: number;
}

export interface LineupResponse {
  lineup_id: number;
  lineup_data: any;
  created_at?: string;
  week?: string;
  threshold?: number;
}

// Request Types
export interface VerifyEmailRequest {
  email: string;
  password: string;
}

export interface CheckCodeRequest {
  email: string;
  code: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UserCreateRequest {
  email: string;
  password: string;
}

// Response Types
export interface VerifyEmailResponse
  extends BaseResponse<VerificationResponse> {}
export interface CheckCodeResponse extends BaseResponse<AuthResponse> {}
export interface LoginResponse extends BaseResponse<AuthResponse> {}
export interface UserCreateResponse extends BaseResponse<AuthResponse> {}

// Team Response Types
export interface TeamGetResponse extends BaseResponse<TeamResponse[]> {}
export interface TeamAddResponse extends BaseResponse<TeamResponse> {}
export interface TeamRemoveResponse
  extends BaseResponse<Record<string, never>> {}
export interface TeamUpdateResponse extends BaseResponse<TeamResponse> {}

// Lineup Response Types
export interface GenerateLineupResponse extends BaseResponse<LineupInfo> {}
export interface GetLineupsResponse extends BaseResponse<LineupInfo[]> {}
export interface SaveLineupResponse extends BaseResponse<LineupResponse> {}
export interface DeleteLineupResponse
  extends BaseResponse<Record<string, never>> {}
