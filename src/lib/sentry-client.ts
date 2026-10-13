/**
 * The browser's Sentry init. Never import this statically: report-error.ts
 * loads it with a dynamic import once the page is idle, which is what keeps
 * @sentry/nextjs (a 64 KB br chunk) out of every route's first load.
 */
import { addBreadcrumb, captureException, init } from "@sentry/nextjs";
import { keepIntegrations, makeBeforeSend, MAX_EVENTS_PER_PAGE, SENTRY_DSN, SENTRY_ENVIRONMENT } from "./sentry";
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
    // Capped per page load: the browser spends the server's quota (sentry.ts).
    beforeSend: makeBeforeSend({ dropApiErrors: true, maxEvents: MAX_EVENTS_PER_PAGE }),
  });
  return { captureException, addBreadcrumb };
}
