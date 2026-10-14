import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { BrowserOptions, ErrorEvent, Event, EventHint } from "@sentry/nextjs";

type EventProcessor = (event: Event, hint: EventHint) => Event | null | PromiseLike<Event | null>;

// sentry-client.ts is the one module that imports the SDK's values; a stand-in
// SDK records what it is handed, so nothing here initialises the real one.
const inits: BrowserOptions[] = [];
/** Each capture, with the processors of the scope it was made in. */
const captures: Array<{ exception: unknown; hint?: EventHint; processors: EventProcessor[] }> = [];
let scopeProcessors: EventProcessor[] = [];
mock.module("@sentry/nextjs", () => ({
  init: (options: BrowserOptions) => {
    inits.push(options);
    return undefined;
  },
  captureException: (exception: unknown, hint?: EventHint) => {
    captures.push({ exception, hint, processors: scopeProcessors });
    return "event-id";
  },
  addBreadcrumb: () => {},
  withScope: (callback: (scope: { addEventProcessor(p: EventProcessor): void }) => void) => {
    const outer = scopeProcessors;
    scopeProcessors = [...outer];
    try {
      callback({ addEventProcessor: (p) => scopeProcessors.push(p) });
    } finally {
      scopeProcessors = outer;
    }
  },
}));

const { initSentry } = await import("../sentry-client");
const { MAX_EVENTS_PER_PAGE } = await import("../sentry");

function lastInit(): BrowserOptions {
  const options = inits.at(-1);
  if (!options) throw new Error("init was not called");
  return options;
}

beforeEach(() => {
  inits.length = 0;
  captures.length = 0;
});

describe("initSentry", () => {
  test("errors only: no tracing, no PII", () => {
    initSentry();
    const options = lastInit();
    expect(options.tracesSampleRate).toBe(0);
    expect(options.sendDefaultPii).toBe(false);
  });

  test("a failed fetch's message reaches its caller unchanged", () => {
    initSentry();
    expect(lastInit().enhanceFetchErrorMessages).toBe("report-only");
  });

  test("a page load sends at most MAX_EVENTS_PER_PAGE events, noise not counted", () => {
    initSentry();
    const beforeSend = lastInit().beforeSend as (event: ErrorEvent, hint: EventHint) => ErrorEvent | null;
    const event = (n: number): ErrorEvent => ({ type: undefined, event_id: `e${n}` });

    expect(beforeSend(event(0), { originalException: new TypeError("Failed to fetch") })).toBeNull();
    const sent = Array.from({ length: MAX_EVENTS_PER_PAGE + 5 }, (_, n) =>
      beforeSend(event(n), { originalException: new TypeError(`bug ${n}`) }),
    );
    expect(sent.filter((e) => e !== null)).toHaveLength(MAX_EVENTS_PER_PAGE);
    expect(sent.slice(MAX_EVENTS_PER_PAGE)).toEqual([null, null, null, null, null]);
  });
});

describe("captureBufferedException", () => {
  test("reports as of the error's time and page, in a scope of its own", async () => {
    const sdk = initSentry();
    const error = new Error("render blew up");
    const hint = { mechanism: { type: "cv.buffered.onerror", handled: false } };
    sdk.captureBufferedException(error, hint, { timestamp: 1_800_000_001, url: "https://www.courtvision.dev/scout" });

    expect(captures).toHaveLength(1);
    const [capture] = captures;
    expect(capture.exception).toBe(error);
    expect(capture.hint).toBe(hint);
    // What Sentry stamped while processing the replay...
    let event: Event | null = {
      timestamp: 1_800_000_009,
      request: { url: "https://www.courtvision.dev/week", headers: { "User-Agent": "UA" } },
    };
    for (const processor of capture.processors) event = event && (await processor(event, {}));
    // ...gives way to when and where the error happened.
    expect(event).toEqual({
      timestamp: 1_800_000_001,
      request: { url: "https://www.courtvision.dev/scout", headers: { "User-Agent": "UA" } },
    });

    // Later captures are left alone.
    sdk.captureException(new Error("live"));
    expect(captures[1].processors).toEqual([]);
  });
});
