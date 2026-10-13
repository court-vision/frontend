import { describe, expect, test } from "bun:test";
import type { ErrorEvent } from "@sentry/nextjs";
import { ApiError } from "../api-error";
import {
  clientReportingEnabled,
  isNoise,
  keepIntegrations,
  makeBeforeSend,
  MAX_EVENTS_PER_PAGE,
  SENTRY_DSN,
  sentryEnvironment,
} from "../sentry";
import { MAX_BUFFERED_ERRORS } from "../report-error";

describe("sentry config", () => {
  test("the DSN defaults to the project's, the one the server has always used", () => {
    expect(process.env.NEXT_PUBLIC_SENTRY_DSN).toBeUndefined();
    expect(SENTRY_DSN).toBe(
      "https://113f1fb150c5bff0e89966c7d9adea21@o4511164601139200.ingest.us.sentry.io/4511979052728320",
    );
  });

  test("environments use the server SDK's names, so both halves file together", () => {
    expect(sentryEnvironment("production", "production")).toBe("vercel-production");
    expect(sentryEnvironment("preview", "production")).toBe("vercel-preview");
    expect(sentryEnvironment(undefined, "production")).toBe("production");
    expect(sentryEnvironment(undefined, "development")).toBe("development");
    expect(sentryEnvironment(undefined, undefined)).toBe("development");
  });

  test("the browser reports from production only, unless a DSN is set explicitly", () => {
    expect(clientReportingEnabled(undefined, "production")).toBe(true);
    expect(clientReportingEnabled(undefined, "preview")).toBe(false);
    expect(clientReportingEnabled(undefined, "development")).toBe(false);
    expect(clientReportingEnabled(undefined, undefined)).toBe(false);
    expect(clientReportingEnabled("", undefined)).toBe(false);
    expect(clientReportingEnabled("https://key@o1.ingest.sentry.io/2", "preview")).toBe(true);
    expect(clientReportingEnabled("https://key@o1.ingest.sentry.io/2", undefined)).toBe(true);
  });

  test("the browser goes without tracing and per-view sessions, and keeps the rest", () => {
    const defaults = [
      "InboundFilters",
      "FunctionToString",
      "BrowserApiErrors",
      "Breadcrumbs",
      "GlobalHandlers",
      "LinkedErrors",
      "Dedupe",
      "HttpContext",
      "BrowserSession",
      "BrowserTracing",
      "NextjsClientStackFrameNormalization",
    ].map((name) => ({ name }));
    expect(keepIntegrations(defaults).map((i) => i.name)).toEqual([
      "InboundFilters",
      "FunctionToString",
      "BrowserApiErrors",
      "Breadcrumbs",
      "GlobalHandlers",
      "LinkedErrors",
      "Dedupe",
      "HttpContext",
      "NextjsClientStackFrameNormalization",
    ]);
  });
});

describe("isNoise", () => {
  const browser = { dropApiErrors: true };
  const server = { dropApiErrors: false };

  test("API failures are the backend's to report, in the browser", () => {
    const err = new ApiError({ message: "boom", status: 500, kind: "server" });
    expect(isNoise({ originalException: err }, browser)).toBe(true);
    expect(isNoise({ originalException: err }, server)).toBe(false);
  });

  test("aborts and dropped connections are noise; bugs are not", () => {
    const abort = new Error("The operation was aborted.");
    abort.name = "AbortError";
    expect(isNoise({ originalException: abort }, browser)).toBe(true);
    expect(isNoise({ originalException: new TypeError("Failed to fetch") }, browser)).toBe(true);
    expect(isNoise({ originalException: new TypeError("Load failed") }, browser)).toBe(true);
    expect(isNoise({ originalException: new TypeError("x.map is not a function") }, browser)).toBe(false);
    expect(isNoise({ originalException: "a string" }, browser)).toBe(false);
  });

  test("Clerk's network failures are noise, its other errors are not", () => {
    const network = Object.assign(new Error("ClerkJS: Network error"), { name: "ClerkRuntimeError", code: "network_error" });
    const other = Object.assign(new Error("ClerkJS: something else"), { name: "ClerkRuntimeError", code: "cannot_render" });
    expect(isNoise({ originalException: network }, browser)).toBe(true);
    expect(isNoise({ originalException: other }, browser)).toBe(false);
  });
});

describe("makeBeforeSend", () => {
  const event = (n: number): ErrorEvent => ({ type: undefined, event_id: `e${n}` });
  const bug = (n: number) => ({ originalException: new TypeError(`bug ${n}`) });

  test("sends events up to the cap, then drops the rest", () => {
    const beforeSend = makeBeforeSend({ dropApiErrors: true, maxEvents: 3 });
    const sent = [1, 2, 3, 4, 5].map((n) => beforeSend(event(n), bug(n)));
    expect(sent.map((e) => e?.event_id ?? null)).toEqual(["e1", "e2", "e3", null, null]);
  });

  test("noise doesn't use up the cap", () => {
    const beforeSend = makeBeforeSend({ dropApiErrors: true, maxEvents: 2 });
    const api = { originalException: new ApiError({ message: "boom", status: 500, kind: "server" }) };
    expect(beforeSend(event(1), api)).toBeNull();
    expect(beforeSend(event(2), { originalException: new TypeError("Failed to fetch") })).toBeNull();
    expect(beforeSend(event(3), bug(3))?.event_id).toBe("e3");
    expect(beforeSend(event(4), bug(4))?.event_id).toBe("e4");
    expect(beforeSend(event(5), bug(5))).toBeNull();
  });

  test("each init counts from zero, and without a cap nothing is dropped", () => {
    const first = makeBeforeSend({ dropApiErrors: true, maxEvents: 1 });
    first(event(1), bug(1));
    expect(first(event(2), bug(2))).toBeNull();
    expect(makeBeforeSend({ dropApiErrors: true, maxEvents: 1 })(event(3), bug(3))?.event_id).toBe("e3");

    const uncapped = makeBeforeSend({ dropApiErrors: false });
    const sent = Array.from({ length: 100 }, (_, n) => uncapped(event(n), bug(n)));
    expect(sent.every((e) => e !== null)).toBe(true);
  });

  test("the browser's cap still sends a full pre-load buffer", () => {
    expect(MAX_EVENTS_PER_PAGE).toBeGreaterThan(MAX_BUFFERED_ERRORS);
  });
});
