/**
 * Sentry options shared by the client, server and edge inits.
 *
 * The DSN only lets a client send events, so it is public: it ships in every
 * browser bundle that reports. `NEXT_PUBLIC_SENTRY_DSN` overrides the
 * project's DSN (it is unset in every Vercel environment), so a build can
 * point all three runtimes at another project, or at a local fake ingest.
 */
import type { ErrorEvent, EventHint } from "@sentry/nextjs";
import { ApiError } from "./api-error";

const PROJECT_DSN =
  "https://113f1fb150c5bff0e89966c7d9adea21@o4511164601139200.ingest.us.sentry.io/4511979052728320";

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || PROJECT_DSN;

// Vercel exposes the deployment kind to the browser bundle as
// NEXT_PUBLIC_VERCEL_ENV; the server also has plain VERCEL_ENV.
const VERCEL_ENV = process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV;

/**
 * The names the server SDK already gives its events ("vercel-production",
 * "vercel-preview", NODE_ENV off Vercel), so one environment filter in Sentry
 * covers both halves of the app.
 */
export function sentryEnvironment(vercelEnv: string | undefined, nodeEnv: string | undefined): string {
  return vercelEnv ? `vercel-${vercelEnv}` : (nodeEnv ?? "development");
}

export const SENTRY_ENVIRONMENT = sentryEnvironment(VERCEL_ENV, process.env.NODE_ENV);

/**
 * Browser reporting runs on the production deployment only: previews and
 * local builds would file their errors next to production's. Setting
 * `NEXT_PUBLIC_SENTRY_DSN` turns it on anywhere (tagged with that build's
 * environment), e.g. to check reporting on a preview.
 */
export function clientReportingEnabled(explicitDsn: string | undefined, vercelEnv: string | undefined): boolean {
  return Boolean(explicitDsn) || vercelEnv === "production";
}

export const CLIENT_REPORTING = clientReportingEnabled(process.env.NEXT_PUBLIC_SENTRY_DSN, VERCEL_ENV);

/**
 * Default integrations the browser goes without (sentry-client.ts).
 * BrowserTracing is the tracing itself (pageload and navigation spans, web
 * vitals, fetch instrumentation), and tracing is off. BrowserSession sends a
 * session envelope on every page view and desk switch: a request per view to
 * Sentry, when the privacy page says Sentry hears from us only when something
 * breaks, and a session count that would miss every view closed before the
 * SDK loaded anyway.
 */
export const DROPPED_INTEGRATIONS: ReadonlySet<string> = new Set(["BrowserTracing", "BrowserSession"]);

export function keepIntegrations<T extends { name: string }>(defaults: T[]): T[] {
  return defaults.filter((integration) => !DROPPED_INTEGRATIONS.has(integration.name));
}

const NETWORK_NOISE = /failed to fetch|load failed|networkerror when attempting to fetch/i;

interface NoiseOptions {
  /** Drop `ApiError`s: the backend's own Sentry owns API failures. Off on the server so a failed SSR prefetch is reported. */
  dropApiErrors: boolean;
}

export function isNoise(hint: EventHint, { dropApiErrors }: NoiseOptions): boolean {
  const ex = hint.originalException;
  if (dropApiErrors && ex instanceof ApiError) return true;
  if (ex instanceof Error) {
    if (ex.name === "AbortError") return true;
    if (NETWORK_NOISE.test(ex.message)) return true;
    if (ex.name === "ClerkRuntimeError") {
      const code = (ex as { code?: string }).code ?? "";
      if (/network/i.test(`${code} ${ex.message}`)) return true;
    }
  }
  return false;
}

export function makeBeforeSend(options: NoiseOptions) {
  return (event: ErrorEvent, hint: EventHint): ErrorEvent | null =>
    isNoise(hint, options) ? null : event;
}
