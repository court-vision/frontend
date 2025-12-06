export interface AuthUser {
  id: string;
  email: string;
  accessToken?: string;
  type?: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  type?: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
  typeSubmit: "LOGIN" | "CREATE";
}

// Backend API Response Types
export type ApiStatus = 
  | "success" 
  | "error" 
  | "validation_error" 
  | "authentication_error" 
  | "authorization_error" 
  | "not_found" 
  | "conflict" 
  | "rate_limited" 
  | "server_error";

export interface BaseApiResponse<T = unknown> {
  status: ApiStatus;
  message: string;
  data?: T;
  error_code?: string;
  timestamp?: string;
}

export interface AuthResponseData {
  access_token: string | null;
  user_id: number | null;
  email: string | null;
  expires_at: string | null;
}

export interface VerificationResponseData {
  verification_sent: boolean;
  email: string;
  expires_in_seconds?: number;
  verification_id?: string;
}

// Specific API responses
export type VerifyEmailResponse = BaseApiResponse<VerificationResponseData>;
export type CheckCodeResponse = BaseApiResponse<AuthResponseData>;
export type LoginResponse = BaseApiResponse<AuthResponseData>;
export type AuthCheckResponse = BaseApiResponse<AuthResponseData> & {
  expired?: boolean;
};
