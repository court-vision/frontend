import { describe, expect, test } from "bun:test";
import { ApiError } from "../api-error";
import { clientReportingEnabled, isNoise, keepIntegrations, SENTRY_DSN, sentryEnvironment } from "../sentry";

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
