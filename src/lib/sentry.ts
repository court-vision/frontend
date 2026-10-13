/**
 * Sentry options shared by the client, server and edge inits.
 *
 * The DSN only lets a client send events, so it is public: it ships in every
 * browser bundle that reports. `NEXT_PUBLIC_SENTRY_DSN` overrides the
 * project's DSN (it is unset in every Vercel environment), so a build can
 * point all three runtimes at another project, or at a local fake ingest.
 */
import type { ErrorEvent, Event, EventHint } from "@sentry/nextjs";
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

/**
 * The most events one page load sends (sentry-client.ts). The browser reports
 * to the server's project, so it spends the server's quota, and opening night
 * takes the browser from no reports to every visitor's errors at once.
 * Dedupe only drops back-to-back repeats: errors that take turns (two queries
 * failing on every refetch, a loop that throws two ways) would keep sending
 * until the tab closes, and a burst across many tabs could use up the quota
 * just when the server's errors matter most. 25 is past the 20 errors the
 * pre-load buffer keeps, so a full buffer still goes out.
 */
export const MAX_EVENTS_PER_PAGE = 25;

interface BeforeSendOptions extends NoiseOptions {
  /** Drop every event past this many. The count lives in the returned function: one per init, so per page load in the browser. */
  maxEvents?: number;
}

export function makeBeforeSend({ maxEvents = Infinity, ...noise }: BeforeSendOptions) {
  let sent = 0;
  return (event: ErrorEvent, hint: EventHint): ErrorEvent | null => {
    // Noise doesn't count against the cap: it never leaves the page.
    if (isNoise(hint, noise)) return null;
    if (sent >= maxEvents) return null;
    sent += 1;
    return event;
  };
}

/** When and where a buffered error happened (report-error.ts). */
export interface ErrorOrigin {
  /** Unix seconds, as Sentry stamps events. */
  timestamp: number;
  /** The page's URL then; absent outside a browser. */
  url?: string;
}

/**
 * Give a replayed event the time and page of its error, not of the replay.
 * Sentry stamps an event, and HttpContext reads `location`, while the event
 * is processed: for an error that waited in the buffer that is seconds later
 * (up to the 10 s load deadline, plus the SDK chunk's download), possibly
 * after the visitor moved to another desk.
 */
export function backdate<T extends Event>(event: T, { timestamp, url }: ErrorOrigin): T {
  event.timestamp = timestamp;
  if (url) event.request = { ...event.request, url };
  return event;
}
