import * as Sentry from "@sentry/nextjs";
import { makeBeforeSend, sentryBaseOptions } from "@/lib/sentry";

Sentry.init({
  ...sentryBaseOptions(),
  // Server-side ApiErrors (the rankings prefetch) mean Vercel could not reach the API: keep them.
  beforeSend: makeBeforeSend({ dropApiErrors: false }),
});
