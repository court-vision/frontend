import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { BrowserOptions, ErrorEvent, EventHint } from "@sentry/nextjs";

// sentry-client.ts is the one module that imports the SDK's values; a stand-in
// SDK records what it is handed, so nothing here initialises the real one.
const inits: BrowserOptions[] = [];
mock.module("@sentry/nextjs", () => ({
  init: (options: BrowserOptions) => {
    inits.push(options);
    return undefined;
  },
  captureException: () => "event-id",
  addBreadcrumb: () => {},
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
});

describe("initSentry", () => {
  test("errors only: no tracing, no PII", () => {
    initSentry();
    const options = lastInit();
    expect(options.tracesSampleRate).toBe(0);
    expect(options.sendDefaultPii).toBe(false);
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
