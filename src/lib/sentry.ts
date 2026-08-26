/**
 * Sentry options shared by the client, server and edge inits.
 * Without `NEXT_PUBLIC_SENTRY_DSN` the SDK stays disabled (dev, tests).
 */
import type { ErrorEvent, EventHint } from "@sentry/nextjs";
import { ApiError } from "./api-error";

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export function sentryBaseOptions() {
  return {
    dsn: DSN,
    enabled: Boolean(DSN),
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? "development",
    release:
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  };
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
