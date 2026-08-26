import * as Sentry from "@sentry/nextjs";
import { makeBeforeSend, sentryBaseOptions } from "@/lib/sentry";

Sentry.init({
  ...sentryBaseOptions(),
  // No replay, no tracing: errors only.
  integrations: [],
  beforeSend: makeBeforeSend({ dropApiErrors: true }),
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
