// Backend API response envelope (backend/schemas/common.py)

export type ApiStatus =
  | "success"
  | "error"
  | "bad_request"
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
