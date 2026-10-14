import { describe, expect, test } from "bun:test";
import type { Breadcrumb, EventHint } from "@sentry/nextjs";
import {
  createErrorReporter,
  EARLY_ERROR,
  EARLY_REJECTION,
  IDLE_TIMEOUT_MS,
  LOAD_DEADLINE_MS,
  MAX_BUFFERED_BREADCRUMBS,
  MAX_BUFFERED_ERRORS,
  NO_IDLE_CALLBACK_DELAY_MS,
  whenIdleAfterLoad,
  type IdleHost,
  type ReporterSdk,
} from "../report-error";
import type { ErrorOrigin } from "../sentry";

type Call = { kind: "error"; error: unknown; hint?: EventHint } | { kind: "breadcrumb"; breadcrumb: Breadcrumb };

function fakeSdk() {
  const calls: Call[] = [];
  /** Errors replayed from the buffer, with the time and page they were recorded with. */
  const replayed: Array<{ error: unknown; origin: ErrorOrigin }> = [];
  const sdk: ReporterSdk = {
    captureException(error, hint) {
      calls.push({ kind: "error", error, hint });
      return "event-id";
    },
    captureBufferedException(error, hint, origin) {
      calls.push({ kind: "error", error, hint });
      replayed.push({ error, origin });
    },
    addBreadcrumb(breadcrumb) {
      calls.push({ kind: "breadcrumb", breadcrumb });
    },
  };
  return { sdk, calls, replayed };
}

function reporterWith(sdk: ReporterSdk, enabled = true, pageUrl?: () => string | undefined) {
  let loads = 0;
  const reporter = createErrorReporter({
    enabled,
    loadSdk: async () => {
      loads += 1;
      return sdk;
    },
    pageUrl,
  });
  return { reporter, loads: () => loads };
}

function errorEvent(props: { error?: unknown; message?: string }): Event {
  return Object.assign(new Event("error"), props);
}

function rejectionEvent(reason: unknown): Event {
  return Object.assign(new Event("unhandledrejection"), { reason });
}

describe("createErrorReporter", () => {
  test("holds errors and breadcrumbs until the SDK loads, then replays them in order", async () => {
    const { sdk, calls } = fakeSdk();
    const { reporter } = reporterWith(sdk);
    const first = new Error("first");
    const second = new TypeError("second");

    reporter.recordBreadcrumb({ category: "query", message: "network 0" });
    reporter.captureError(first);
    reporter.recordBreadcrumb({ category: "mutation", message: "server 500" });
    reporter.captureError(second, { mechanism: { type: "test", handled: true } });
    expect(calls).toEqual([]);

    await reporter.load();

    expect(calls.map((c) => (c.kind === "error" ? c.error : c.breadcrumb.message))).toEqual([
      "network 0",
      first,
      "server 500",
      second,
    ]);
    expect(calls[3]).toEqual({ kind: "error", error: second, hint: { mechanism: { type: "test", handled: true } } });
  });

  test("a buffered error keeps the time and page it happened on, not the replay's", async () => {
    const { sdk, replayed } = fakeSdk();
    let url = "https://www.courtvision.dev/scout?player=1";
    const { reporter } = reporterWith(sdk, true, () => url);
    const target = new EventTarget();
    reporter.listen(target);
    const boundary = new Error("caught by error.tsx");
    const uncaught = new Error("uncaught");

    const before = Date.now() / 1000;
    reporter.captureError(boundary);
    target.dispatchEvent(errorEvent({ error: uncaught }));
    const after = Date.now() / 1000;
    // The visitor moves to another desk before the SDK loads.
    url = "https://www.courtvision.dev/week";
    await new Promise((r) => setTimeout(r, 20));
    await reporter.load();

    expect(replayed.map((r) => r.error)).toEqual([boundary, uncaught]);
    for (const { origin } of replayed) {
      expect(origin.url).toBe("https://www.courtvision.dev/scout?player=1");
      expect(origin.timestamp).toBeGreaterThanOrEqual(before);
      expect(origin.timestamp).toBeLessThanOrEqual(after);
    }
  });

  test("outside a browser a buffered error has no page to record", async () => {
    const { sdk, replayed } = fakeSdk();
    const { reporter } = reporterWith(sdk);
    reporter.captureError(new Error("no location"));
    await reporter.load();
    expect(replayed).toHaveLength(1);
    expect(replayed[0].origin.url).toBeUndefined();
  });

  test("once the SDK is up, reports go straight to it", async () => {
    const { sdk, calls, replayed } = fakeSdk();
    const { reporter } = reporterWith(sdk);
    await reporter.load();

    const err = new Error("late");
    reporter.captureError(err);
    reporter.recordBreadcrumb({ category: "query", message: "auth 401", timestamp: 5 });

    expect(calls).toEqual([
      { kind: "error", error: err, hint: undefined },
      { kind: "breadcrumb", breadcrumb: { category: "query", message: "auth 401", timestamp: 5 } },
    ]);
    // Live, Sentry's own time and URL are the right ones.
    expect(replayed).toEqual([]);
  });

  test("a buffered breadcrumb keeps the time it was recorded, not the replay's", async () => {
    const { sdk, calls } = fakeSdk();
    const { reporter } = reporterWith(sdk);
    const before = Date.now() / 1000;
    reporter.recordBreadcrumb({ category: "query", message: "network 0" });
    const after = Date.now() / 1000;
    await new Promise((r) => setTimeout(r, 20));
    await reporter.load();

    const crumb = (calls[0] as Extract<Call, { kind: "breadcrumb" }>).breadcrumb;
    expect(crumb.timestamp).toBeGreaterThanOrEqual(before);
    expect(crumb.timestamp).toBeLessThanOrEqual(after);
  });

  test("keeps the first errors past the cap and says how many it dropped", async () => {
    const { sdk, calls } = fakeSdk();
    const { reporter } = reporterWith(sdk);
    const errors = Array.from({ length: MAX_BUFFERED_ERRORS + 3 }, (_, i) => new Error(`e${i}`));
    for (const e of errors) reporter.captureError(e);

    await reporter.load();

    const reported = calls.filter((c) => c.kind === "error").map((c) => (c as { error: Error }).error);
    expect(reported).toEqual(errors.slice(0, MAX_BUFFERED_ERRORS));
    expect(calls.at(-1)).toEqual({
      kind: "breadcrumb",
      breadcrumb: {
        category: "report-error",
        level: "warning",
        message: "3 more errors before Sentry loaded went unreported",
      },
    });
  });

  test("keeps the latest breadcrumbs past the cap, in place among the errors", async () => {
    const { sdk, calls } = fakeSdk();
    const { reporter } = reporterWith(sdk);
    const boom = new Error("boom");
    reporter.recordBreadcrumb({ message: "b0" });
    reporter.captureError(boom);
    for (let i = 1; i <= MAX_BUFFERED_BREADCRUMBS; i++) reporter.recordBreadcrumb({ message: `b${i}` });

    await reporter.load();

    const crumbs = calls.filter((c) => c.kind === "breadcrumb").map((c) => (c as { breadcrumb: Breadcrumb }).breadcrumb.message);
    expect(crumbs).toEqual(Array.from({ length: MAX_BUFFERED_BREADCRUMBS }, (_, i) => `b${i + 1}`));
    // b0 went; the error it preceded is still first.
    expect(calls[0]).toEqual({ kind: "error", error: boom, hint: undefined });
    // No drop notice: no error was dropped.
    expect(calls.some((c) => c.kind === "breadcrumb" && c.breadcrumb.category === "report-error")).toBe(false);
  });

  test("loads the SDK once, however often it is asked", async () => {
    const { sdk, calls } = fakeSdk();
    const { reporter, loads } = reporterWith(sdk);
    reporter.captureError(new Error("once"));
    await Promise.all([reporter.load(), reporter.load()]);
    await reporter.load();
    expect(loads()).toBe(1);
    expect(calls).toHaveLength(1);
  });

  test("disabled, it neither buffers nor loads", async () => {
    const { sdk, calls } = fakeSdk();
    const { reporter, loads } = reporterWith(sdk, false);
    const target = new EventTarget();
    reporter.listen(target);
    reporter.captureError(new Error("dev"));
    reporter.recordBreadcrumb({ message: "dev" });
    target.dispatchEvent(errorEvent({ error: new Error("dev uncaught") }));

    await reporter.load();

    expect(loads()).toBe(0);
    expect(calls).toEqual([]);
  });

  test("a failed SDK load stops listening and never retries", async () => {
    const removed: string[] = [];
    class SpyTarget extends EventTarget {
      removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
        removed.push(type);
        super.removeEventListener(type, listener);
      }
    }
    let attempts = 0;
    const reporter = createErrorReporter({
      enabled: true,
      loadSdk: () => {
        attempts += 1;
        return Promise.reject(new Error("ChunkLoadError"));
      },
    });
    reporter.listen(new SpyTarget());
    reporter.captureError(new Error("before"));

    await reporter.load();
    await reporter.load();
    reporter.captureError(new Error("after"));

    expect(attempts).toBe(1);
    expect(removed.sort()).toEqual(["error", "unhandledrejection"]);
  });
});

describe("listen", () => {
  test("buffers uncaught errors and unhandled rejections as unhandled", async () => {
    const { sdk, calls } = fakeSdk();
    const { reporter } = reporterWith(sdk);
    const target = new EventTarget();
    reporter.listen(target);

    const thrown = new Error("render blew up");
    const rejected = new Error("fetch chain");
    target.dispatchEvent(errorEvent({ error: thrown, message: "Uncaught Error: render blew up" }));
    target.dispatchEvent(rejectionEvent(rejected));
    target.dispatchEvent(rejectionEvent("plain string"));
    // A cross-origin script error carries only a message.
    target.dispatchEvent(errorEvent({ error: null, message: "Script error." }));

    await reporter.load();

    expect(calls).toEqual([
      { kind: "error", error: thrown, hint: { mechanism: EARLY_ERROR } },
      { kind: "error", error: rejected, hint: { mechanism: EARLY_REJECTION } },
      { kind: "error", error: "plain string", hint: { mechanism: EARLY_REJECTION } },
      { kind: "error", error: "Script error.", hint: { mechanism: EARLY_ERROR } },
    ]);
    expect(EARLY_ERROR.handled).toBe(false);
    expect(EARLY_REJECTION.handled).toBe(false);
  });

  test("hands over to the SDK's own handlers once it loads", async () => {
    const { sdk, calls } = fakeSdk();
    const { reporter } = reporterWith(sdk);
    const target = new EventTarget();
    reporter.listen(target);
    await reporter.load();

    target.dispatchEvent(errorEvent({ error: new Error("Sentry's to report") }));
    target.dispatchEvent(rejectionEvent(new Error("Sentry's too")));

    expect(calls).toEqual([]);
  });

  test("listens once", async () => {
    const { sdk, calls } = fakeSdk();
    const { reporter } = reporterWith(sdk);
    const target = new EventTarget();
    reporter.listen(target);
    reporter.listen(target);
    target.dispatchEvent(errorEvent({ error: new Error("one") }));

    await reporter.load();

    expect(calls).toHaveLength(1);
  });
});

describe("whenIdleAfterLoad", () => {
  function fakeHost(readyState: DocumentReadyState, withIdleCallback = true) {
    const timers: Array<{ ms: number; fn: () => void }> = [];
    const idle: Array<{ timeout: number; fn: () => void }> = [];
    let onLoad: (() => void) | null = null;
    const host: IdleHost = {
      document: { readyState },
      addEventListener: (type, listener, options) => {
        expect(type).toBe("load");
        expect(options).toEqual({ once: true });
        onLoad = listener;
      },
      setTimeout: (fn, ms) => timers.push({ ms, fn }),
    };
    if (withIdleCallback) host.requestIdleCallback = (fn, { timeout }) => idle.push({ timeout, fn });
    return { host, timers, idle, fireLoad: () => onLoad?.() };
  }

  test("waits for load, then for an idle moment", () => {
    const { host, timers, idle, fireLoad } = fakeHost("interactive");
    let runs = 0;
    whenIdleAfterLoad(host, () => runs++);

    expect(idle).toEqual([]);
    expect(timers.map((t) => t.ms)).toEqual([LOAD_DEADLINE_MS]);
    fireLoad();
    expect(idle.map((i) => i.timeout)).toEqual([IDLE_TIMEOUT_MS]);
    expect(runs).toBe(0);
    idle[0].fn();
    expect(runs).toBe(1);
  });

  test("an already loaded page goes straight to the idle wait", () => {
    const { host, idle } = fakeHost("complete");
    let runs = 0;
    whenIdleAfterLoad(host, () => runs++);
    expect(idle).toHaveLength(1);
    idle[0].fn();
    expect(runs).toBe(1);
  });

  test("without requestIdleCallback (Safari) it waits a fixed beat after load", () => {
    const { host, timers, fireLoad } = fakeHost("loading", false);
    let runs = 0;
    whenIdleAfterLoad(host, () => runs++);
    fireLoad();
    const beat = timers.find((t) => t.ms === NO_IDLE_CALLBACK_DELAY_MS);
    expect(beat).toBeDefined();
    beat!.fn();
    expect(runs).toBe(1);
  });

  test("a page whose load never comes still reports at the deadline, and only once", () => {
    const { host, timers, idle, fireLoad } = fakeHost("interactive");
    let runs = 0;
    whenIdleAfterLoad(host, () => runs++);
    timers.find((t) => t.ms === LOAD_DEADLINE_MS)!.fn();
    expect(runs).toBe(1);
    fireLoad();
    idle[0].fn();
    expect(runs).toBe(1);
  });
});
