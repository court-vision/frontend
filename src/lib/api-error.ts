/**
 * Typed errors for the Court Vision API client.
 *
 * Every failure surfaced by `fetchJson` is an `ApiError`: a real HTTP error
 * status, a transitional 200-with-error envelope, a network failure, a
 * timeout, or a missing Clerk session. `kind` drives the retry/toast policy
 * in QueryProvider and `userMessage` turns it into copy the UI can show.
 */
import type { ApiStatus } from "@/types/auth";

export type ApiErrorKind =
  | "network"
  | "timeout"
  | "auth"
  | "forbidden"
  | "not_found"
  | "validation"
  | "rate_limited"
  | "provider"
  | "server"
  | "unknown";

/** Backend error codes with client-side meaning (backend/core/errors.py). */
export const PROVIDER_AUTH_EXPIRED = "PROVIDER_AUTH_EXPIRED";
export const LINEUP_SERVICE_UNAVAILABLE = "LINEUP_SERVICE_UNAVAILABLE";
/** Client-side code for a success envelope with no `data` where one was required. */
export const EMPTY_RESULT = "EMPTY_RESULT";

const RETRYABLE_KINDS: ReadonlySet<ApiErrorKind> = new Set<ApiErrorKind>([
  "network",
  "timeout",
  "provider",
  "rate_limited",
]);

export interface ApiErrorInit {
  message: string;
  /** HTTP status of the response; 0 when no response was received. */
  status: number;
  kind?: ApiErrorKind;
  /** Backend `error_code`, when the body carried one. */
  code?: string | null;
  /** Backend envelope `status`, when the body was an envelope. */
  apiStatus?: ApiStatus | null;
  correlationId?: string | null;
  /** Backend envelope `data` (e.g. `{ errors }` for 422, `{ provider }` for provider errors). */
  data?: unknown;
  cause?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly kind: ApiErrorKind;
  readonly code: string | null;
  readonly apiStatus: ApiStatus | null;
  readonly correlationId: string | null;
  readonly data: unknown;
  readonly retryable: boolean;

  constructor(init: ApiErrorInit) {
    super(init.message, init.cause === undefined ? undefined : { cause: init.cause });
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code ?? null;
    this.kind = init.kind ?? kindFor(init.status, this.code);
    this.apiStatus = init.apiStatus ?? null;
    this.correlationId = init.correlationId ?? null;
    this.data = init.data ?? null;
    this.retryable = RETRYABLE_KINDS.has(this.kind) || this.status === 503;
  }

  /** A non-2xx response. Reads the envelope (or FastAPI's `detail`) and the correlation id. */
  static fromResponse(res: Response, body: unknown, requestCorrelationId?: string): ApiError {
    const parsed = readBody(body);
    return new ApiError({
      message: parsed.message ?? `Request failed (HTTP ${res.status})`,
      status: res.status,
      code: parsed.code,
      apiStatus: parsed.apiStatus,
      correlationId:
        parsed.correlationId ??
        res.headers.get("x-correlation-id") ??
        requestCorrelationId ??
        null,
      data: parsed.data,
    });
  }

  /** Transitional path: HTTP 200 whose envelope `status` is not `success`. */
  static fromEnvelope(body: unknown, requestCorrelationId?: string): ApiError {
    const parsed = readBody(body);
    return new ApiError({
      message: parsed.message ?? `Request failed (${parsed.apiStatus ?? "error"})`,
      status: inferStatus(parsed.apiStatus, parsed.code),
      code: parsed.code,
      apiStatus: parsed.apiStatus,
      correlationId: parsed.correlationId ?? requestCorrelationId ?? null,
      data: parsed.data,
    });
  }

  static network(cause: unknown): ApiError {
    return new ApiError({
      message:
        cause instanceof Error && cause.message ? cause.message : "Network request failed",
      status: 0,
      kind: "network",
      cause,
    });
  }

  static timeout(timeoutMs?: number): ApiError {
    return new ApiError({
      message: timeoutMs ? `Request timed out after ${timeoutMs} ms` : "Request timed out",
      status: 0,
      kind: "timeout",
    });
  }

  /** Clerk had no session token; the request was never sent. */
  static auth(): ApiError {
    return new ApiError({
      message: "Not signed in",
      status: 401,
      kind: "auth",
      code: "AUTH_REQUIRED",
    });
  }

  /** A success envelope whose `data` was empty where the caller required a value. */
  static empty(env: { message?: string }): ApiError {
    return new ApiError({
      message: env.message || "No data available",
      status: 200,
      kind: "not_found",
      code: EMPTY_RESULT,
      apiStatus: "success",
    });
  }
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

function kindFor(status: number, code: string | null): ApiErrorKind {
  if (code === PROVIDER_AUTH_EXPIRED) return "forbidden";
  if (code?.startsWith("PROVIDER_")) return "provider";
  if (status === 401) return "auth";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 400 || status === 422) return "validation";
  if (status === 429) return "rate_limited";
  if (status === 502 || status === 504) return "provider";
  if (status >= 500) return "server";
  return "unknown";
}

const STATUS_BY_API_STATUS: Partial<Record<ApiStatus, number>> = {
  not_found: 404,
  authentication_error: 401,
  authorization_error: 403,
  bad_request: 400,
  validation_error: 422,
  rate_limited: 429,
  conflict: 409,
};

/** HTTP status a 200-with-error envelope would have carried. */
function inferStatus(apiStatus: ApiStatus | null, code: string | null): number {
  const mapped = apiStatus ? STATUS_BY_API_STATUS[apiStatus] : undefined;
  if (mapped) return mapped;
  if (code === PROVIDER_AUTH_EXPIRED) return 403;
  if (code === LINEUP_SERVICE_UNAVAILABLE) return 503;
  if (code?.startsWith("PROVIDER_")) return 502;
  return 500;
}

interface ParsedBody {
  message: string | null;
  code: string | null;
  apiStatus: ApiStatus | null;
  data: unknown;
  correlationId: string | null;
}

/** Pulls the envelope fields out of a JSON body; tolerates FastAPI's `{detail}` and non-JSON bodies. */
function readBody(body: unknown): ParsedBody {
  if (typeof body !== "object" || body === null) {
    return { message: null, code: null, apiStatus: null, data: null, correlationId: null };
  }
  const b = body as Record<string, unknown>;
  const message =
    typeof b.message === "string" && b.message
      ? b.message
      : typeof b.detail === "string" && b.detail
        ? b.detail
        : null;
  const data =
    b.data !== undefined ? b.data : Array.isArray(b.detail) ? { errors: b.detail } : null;
  const correlationId =
    typeof data === "object" &&
    data !== null &&
    typeof (data as Record<string, unknown>).correlation_id === "string"
      ? ((data as Record<string, unknown>).correlation_id as string)
      : null;
  return {
    message,
    code: typeof b.error_code === "string" ? b.error_code : null,
    apiStatus: typeof b.status === "string" ? (b.status as ApiStatus) : null,
    data,
    correlationId,
  };
}

// ---------------------------------------------------------------------------
// Helpers for consumers
// ---------------------------------------------------------------------------

const NETWORK_MESSAGE = /failed to fetch|load failed|networkerror|network request failed/i;

/** Normalises anything thrown by a query/mutation into an `ApiError`. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof Error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      return new ApiError({ message: error.message, status: 0, kind: "timeout", cause: error });
    }
    if (error.name === "TypeError" && NETWORK_MESSAGE.test(error.message)) {
      return ApiError.network(error);
    }
    // Keep the message as-is (even empty) so `userMessage` can fall back to its own copy.
    return new ApiError({ message: error.message, status: 0, kind: "unknown", cause: error });
  }
  return new ApiError({
    message: typeof error === "string" ? error : "",
    status: 0,
    kind: "unknown",
    cause: error,
  });
}

/** ESPN cookies / Yahoo refresh token rejected by the provider (not a dead Clerk session). */
export function isProviderAuthError(error: unknown): boolean {
  return toApiError(error).code === PROVIDER_AUTH_EXPIRED;
}

/** A success envelope with no data — an empty state, never a failure to alert on. */
export function isEmptyResult(error: unknown): boolean {
  return toApiError(error).code === EMPTY_RESULT;
}

/** Display name of the league provider named in the error's `data.provider`, if any. */
export function providerName(error: unknown): string | null {
  const data = toApiError(error).data;
  const provider =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>).provider
      : undefined;
  if (provider === "espn") return "ESPN";
  if (provider === "yahoo") return "Yahoo";
  return null;
}

/** Copy safe to show a user for any error a query or mutation can throw. */
export function userMessage(error: unknown, fallback = "Something went wrong"): string {
  const err = toApiError(error);
  if (isProviderAuthError(err)) {
    return `Your ${providerName(err) ?? "league"} connection expired — reconnect it in Manage Teams`;
  }
  switch (err.kind) {
    case "network":
      return "Can't reach the Court Vision API — check your connection and retry";
    case "timeout":
      return "The Court Vision API took too long to respond — retry in a moment";
    case "auth":
      return "Your session expired — sign in again";
    case "provider":
      return `${providerName(err) ?? "Your league provider"} isn't responding — retry in a minute`;
    case "rate_limited":
      return "Too many requests — wait a minute and retry";
    case "server": {
      // Only trust a message the backend deliberately put in its envelope.
      if (err.apiStatus && err.message) return err.message;
      const ref = err.correlationId ? ` (ref ${err.correlationId.slice(0, 8)})` : "";
      return `Something went wrong on our side${ref}`;
    }
    default:
      return err.message || fallback;
  }
}
