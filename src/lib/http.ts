/**
 * The one HTTP entry point for the Court Vision API.
 *
 * - Tags every request with an `X-Correlation-ID` so a failure can be joined
 *   to the backend's request log.
 * - Times out (15 s by default) and cooperates with TanStack Query's `signal`.
 * - Refuses to send an authenticated request without a Clerk token.
 * - Throws `ApiError` for non-2xx responses and, unless `raw`, for the
 *   transitional 200-with-error envelope the backend still returns.
 */
import { ApiError } from "./api-error";

/** Clerk's `useAuth().getToken`. */
export type GetTokenFn = () => Promise<string | null>;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export const DEFAULT_TIMEOUT_MS = 15_000;

/** Per-call options an API client method may forward from a query. */
export interface RequestOptions {
  /** TanStack Query's abort signal; cancels the request when the query is dropped. */
  signal?: AbortSignal;
}

export interface FetchJsonOptions extends RequestOptions {
  /** When set, a bearer token is required; a null token throws `ApiError.auth()` without a request. */
  getToken?: GetTokenFn;
  method?: HttpMethod;
  /** JSON-serialised request body. */
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Return the body as-is even when the envelope `status` is not `success` (mutations read it). */
  raw?: boolean;
}

/** Minimal shape of the backend envelope; the ad-hoc Yahoo/notification responses fit it too. */
export interface Envelope<T = unknown> {
  status: string;
  message?: string;
  data?: T | null;
}

function newCorrelationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

function isEnvelope(body: unknown): body is Envelope {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as { status?: unknown }).status === "string"
  );
}

/** JSON when the body parses, the raw text when it does not, null when empty. */
async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const {
    getToken,
    method = "GET",
    body,
    headers = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
    raw = false,
  } = options;

  const correlationId = newCorrelationId();
  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    "X-Correlation-ID": correlationId,
    ...headers,
  };
  if (body !== undefined) requestHeaders["Content-Type"] = "application/json";

  if (getToken) {
    const token = await getToken();
    if (!token) throw ApiError.auth();
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onOuterAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onOuterAbort, { once: true });
  }

  let res: Response;
  let parsed: unknown;
  try {
    res = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    parsed = await parseBody(res);
  } catch (err) {
    if (timedOut) throw ApiError.timeout(timeoutMs);
    // The caller cancelled (TanStack dropped the query): let its abort propagate untouched.
    if (signal?.aborted) throw err;
    throw ApiError.network(err);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onOuterAbort);
  }

  if (!res.ok) throw ApiError.fromResponse(res, parsed, correlationId);
  if (!raw && isEnvelope(parsed) && parsed.status !== "success") {
    throw ApiError.fromEnvelope(parsed, correlationId);
  }
  return parsed as T;
}

/**
 * Data of a success envelope. With a `fallback`, an empty `data` (the
 * backend's "nothing to show" state) returns it; without one it throws an
 * `EMPTY_RESULT` `ApiError` so callers typed to a required value stay honest.
 */
export function unwrap<T, F = never>(env: Envelope<T>, fallback?: F): T | F {
  if (env.data !== undefined && env.data !== null) return env.data;
  if (fallback !== undefined) return fallback;
  throw ApiError.empty(env);
}

/** Like `unwrap`, keeping the backend `message` so empty states can explain themselves. */
export function unwrapWithMessage<T, F = never>(
  env: Envelope<T>,
  fallback?: F
): { data: T | F; message: string } {
  return { data: unwrap(env, fallback), message: env.message ?? "" };
}

/** Resolves to null for a 404 (real or inferred from the envelope); every other error still throws. */
export async function nullOn404<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}
