/**
 * The browser's Sentry init. Never import this statically: report-error.ts
 * loads it with a dynamic import once the page is idle, which is what keeps
 * @sentry/nextjs (a 64 KB br chunk) out of every route's first load.
 */
import { addBreadcrumb, captureException, init, withScope } from "@sentry/nextjs";
import {
  backdate,
  keepIntegrations,
  makeBeforeSend,
  MAX_EVENTS_PER_PAGE,
  SENTRY_DSN,
  SENTRY_ENVIRONMENT,
} from "./sentry";
import type { ReporterSdk } from "./report-error";

export function initSentry(): ReporterSdk {
  init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    // `release` stays the SDK's default: withSentryConfig's build-time
    // `_sentryRelease` (the commit SHA on Vercel), which the source maps are
    // uploaded under.

    // Errors only: no tracing, no replay.
    tracesSampleRate: 0,
    sendDefaultPii: false,
    integrations: keepIntegrations,
    // Sentry wraps fetch for its breadcrumbs and by default rewrites a failed
    // request's "Failed to fetch" to "Failed to fetch (host)" on the error
    // itself, which every caller of fetch then sees. api-error.ts matches a
    // substring and would cope, but a library matching the browser's exact
    // words would not, and until now the SDK never touched fetch at all.
    // report-only puts the host in the report and leaves the error alone.
    enhanceFetchErrorMessages: "report-only",
    // Capped per page load: the browser spends the server's quota (sentry.ts).
    beforeSend: makeBeforeSend({ dropApiErrors: true, maxEvents: MAX_EVENTS_PER_PAGE }),
  });
  return {
    captureException,
    addBreadcrumb,
    captureBufferedException(exception, hint, origin) {
      withScope((scope) => {
        // A scope's processors run after every integration's, so this
        // overrides the time and URL HttpContext and Sentry just stamped.
        scope.addEventProcessor((event) => backdate(event, origin));
        captureException(exception, hint);
      });
    },
  };
}
