import * as Sentry from "@sentry/nextjs";
import { makeBeforeSend, sentryBaseOptions } from "@/lib/sentry";

Sentry.init({
  ...sentryBaseOptions(),
  beforeSend: makeBeforeSend({ dropApiErrors: false }),
});
