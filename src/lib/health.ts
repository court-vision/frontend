/**
 * Client-side view of the backend's `GET /health` contract (plan: "Health
 * endpoint contract"). Kept pure so the status bar's classification is
 * unit-testable; the hook in `hooks/useApiHealth.ts` does the fetching.
 */

export interface HealthCheck {
  ok: boolean;
  latency_ms?: number;
  error?: string;
}

/** Body of `GET /health` — 200 when `status` is "ok", 503 when "degraded". */
export interface HealthBody {
  status: string;
  service?: string;
  version?: string;
  environment?: string;
  uptime_s?: number;
  checks?: Record<string, HealthCheck | undefined>;
}

export type ApiHealthStatus = "ok" | "degraded" | "unknown";

export interface ApiHealth {
  status: ApiHealthStatus;
  /** Database round-trip reported by the backend, when it ran the check. */
  dbLatencyMs: number | null;
  version: string | null;
  environment: string | null;
}

const UNKNOWN: ApiHealth = { status: "unknown", dbLatencyMs: null, version: null, environment: null };

/** Degraded with no detail: what a 503 whose body we could not read collapses to. */
export const DEGRADED: ApiHealth = { ...UNKNOWN, status: "degraded" };

/**
 * Classifies a `/health` body. Anything that is not the documented shape
 * (an HTML error page, a proxy's JSON, a 404 body) is "unknown" — only a real
 * `status: "degraded"` (or a failing gating check) counts as degraded.
 */
export function classifyHealth(body: unknown): ApiHealth {
  if (typeof body !== "object" || body === null) return UNKNOWN;
  const b = body as Partial<HealthBody>;
  if (typeof b.status !== "string") return UNKNOWN;

  const database = b.checks?.database;
  const dbLatencyMs =
    database && typeof database.latency_ms === "number" ? database.latency_ms : null;
  const version = typeof b.version === "string" && b.version ? b.version : null;
  const environment = typeof b.environment === "string" && b.environment ? b.environment : null;

  let status: ApiHealthStatus;
  if (b.status === "ok") {
    // A gating check can only fail on a 503, but stay honest if the body disagrees.
    status = database && database.ok === false ? "degraded" : "ok";
  } else if (b.status === "degraded") {
    status = "degraded";
  } else {
    status = "unknown";
  }

  return { status, dbLatencyMs, version, environment };
}
