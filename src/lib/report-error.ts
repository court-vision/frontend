/**
 * Client error reporting that keeps @sentry/nextjs off the critical path.
 *
 * Initialising the SDK in instrumentation-client.ts put about 68 KB br
 * (250 KB raw: the SDK with its tracing and web-vitals code, and the pages
 * router it imports) in the root chunks, parsed and run before hydration on
 * every route. Instead, instrumentation-client calls `installErrorReporting`,
 * which listens for uncaught errors and unhandled rejections from the first
 * script on and loads the SDK (sentry-client.ts) with a dynamic import once
 * the page has loaded and gone idle. What arrives before then waits in a small
 * buffer and is replayed, in order, as soon as the SDK is up.
 *
 * Code reports through `captureError` and `recordBreadcrumb`, never through
 * @sentry/nextjs itself: a single static import of the SDK in client code puts
 * all of it back in the first load. On the server both are no-ops; server
 * errors reach Sentry through instrumentation.ts's onRequestError.
 */
import type { Breadcrumb, EventHint } from "@sentry/nextjs";
import { CLIENT_REPORTING } from "./sentry";

/** The two SDK calls the reporter makes, so tests can stand in for Sentry. */
export interface ReporterSdk {
  captureException(exception: unknown, hint?: EventHint): string;
  addBreadcrumb(breadcrumb: Breadcrumb): void;
}

/**
 * The first errors are the ones worth having (later ones are usually their
 * fallout, or a render loop), so past the cap new errors are counted, not kept.
 */
export const MAX_BUFFERED_ERRORS = 20;
/** Breadcrumbs are context for the errors, so past the cap the oldest go. */
export const MAX_BUFFERED_BREADCRUMBS = 20;

/** Mechanisms for the uncaught errors the buffer caught before Sentry's own handlers were installed. */
export const EARLY_ERROR = { type: "cv.buffered.onerror", handled: false } as const;
export const EARLY_REJECTION = { type: "cv.buffered.onunhandledrejection", handled: false } as const;

type Pending =
  | { kind: "error"; error: unknown; hint?: EventHint }
  | { kind: "breadcrumb"; breadcrumb: Breadcrumb };

export interface ErrorReporter {
  captureError(error: unknown, hint?: EventHint): void;
  recordBreadcrumb(breadcrumb: Breadcrumb): void;
  /** Buffer the target's uncaught errors and unhandled rejections until the SDK's own handlers take over. */
  listen(target: EventTarget): void;
  /** Load the SDK and replay the buffer. Runs once; later calls return the same promise. */
  load(): Promise<void>;
}

export function createErrorReporter({
  enabled,
  loadSdk,
}: {
  enabled: boolean;
  loadSdk: () => Promise<ReporterSdk>;
}): ErrorReporter {
  let sdk: ReporterSdk | null = null;
  let gaveUp = false;
  let loading: Promise<void> | null = null;
  let pending: Pending[] = [];
  let bufferedErrors = 0;
  let bufferedBreadcrumbs = 0;
  let droppedErrors = 0;
  let stopListening: (() => void) | null = null;

  const buffering = () => enabled && !gaveUp;

  function captureError(error: unknown, hint?: EventHint) {
    if (sdk) {
      sdk.captureException(error, hint);
      return;
    }
    if (!buffering()) return;
    if (bufferedErrors >= MAX_BUFFERED_ERRORS) {
      droppedErrors += 1;
      return;
    }
    bufferedErrors += 1;
    pending.push({ kind: "error", error, hint });
  }

  function recordBreadcrumb(breadcrumb: Breadcrumb) {
    if (sdk) {
      sdk.addBreadcrumb(breadcrumb);
      return;
    }
    if (!buffering()) return;
    if (bufferedBreadcrumbs >= MAX_BUFFERED_BREADCRUMBS) {
      pending.splice(
        pending.findIndex((p) => p.kind === "breadcrumb"),
        1,
      );
    } else {
      bufferedBreadcrumbs += 1;
    }
    // Stamped now: replayed later, it would otherwise carry the replay's time.
    pending.push({ kind: "breadcrumb", breadcrumb: { timestamp: Date.now() / 1000, ...breadcrumb } });
  }

  function listen(target: EventTarget) {
    if (!buffering() || sdk || stopListening) return;
    const onError = (event: Event) => {
      const { error, message } = event as ErrorEvent;
      captureError(error ?? message, { mechanism: EARLY_ERROR });
    };
    const onRejection = (event: Event) => {
      captureError((event as PromiseRejectionEvent).reason, { mechanism: EARLY_REJECTION });
    };
    target.addEventListener("error", onError);
    target.addEventListener("unhandledrejection", onRejection);
    stopListening = () => {
      target.removeEventListener("error", onError);
      target.removeEventListener("unhandledrejection", onRejection);
    };
  }

  function replay(loaded: ReporterSdk) {
    const queue = pending;
    pending = [];
    for (const item of queue) {
      if (item.kind === "breadcrumb") loaded.addBreadcrumb(item.breadcrumb);
      else loaded.captureException(item.error, item.hint);
    }
    if (droppedErrors > 0) {
      loaded.addBreadcrumb({
        category: "report-error",
        level: "warning",
        message: `${droppedErrors} more error${droppedErrors === 1 ? "" : "s"} before Sentry loaded went unreported`,
      });
    }
  }

  function load(): Promise<void> {
    if (!enabled) return Promise.resolve();
    loading ??= loadSdk().then(
      (loaded) => {
        sdk = loaded;
        // Sentry's global handlers are installed now; two listeners would report every uncaught error twice.
        stopListening?.();
        replay(loaded);
      },
      () => {
        // The chunk didn't arrive (offline, or a deploy replaced it). Stop
        // buffering rather than hold errors for an SDK that isn't coming.
        gaveUp = true;
        stopListening?.();
        pending = [];
      },
    );
    return loading;
  }

  return { captureError, recordBreadcrumb, listen, load };
}

/** After `load`, the SDK waits for the browser to go idle, but no longer than this. */
export const IDLE_TIMEOUT_MS = 2_000;
/** Safari has no requestIdleCallback: a fixed beat after `load` instead. */
export const NO_IDLE_CALLBACK_DELAY_MS = 1_000;
/** A page whose `load` never comes (a hung subresource) still reports. */
export const LOAD_DEADLINE_MS = 10_000;

/** The slice of `window` the scheduler uses. */
export interface IdleHost {
  document: { readyState: DocumentReadyState };
  addEventListener(type: "load", listener: () => void, options: { once: true }): void;
  setTimeout(handler: () => void, timeout: number): unknown;
  requestIdleCallback?: (callback: () => void, options: { timeout: number }) => unknown;
}

/** Runs `run` once: when the browser is idle after `load`, or at the deadline, whichever comes first. */
export function whenIdleAfterLoad(host: IdleHost, run: () => void): void {
  let ran = false;
  const once = () => {
    if (ran) return;
    ran = true;
    run();
  };
  const afterLoad = () => {
    if (typeof host.requestIdleCallback === "function") host.requestIdleCallback(once, { timeout: IDLE_TIMEOUT_MS });
    else host.setTimeout(once, NO_IDLE_CALLBACK_DELAY_MS);
  };
  if (host.document.readyState === "complete") afterLoad();
  else host.addEventListener("load", afterLoad, { once: true });
  host.setTimeout(once, LOAD_DEADLINE_MS);
}

const reporter = createErrorReporter({
  enabled: CLIENT_REPORTING && typeof window !== "undefined",
  loadSdk: () => import("./sentry-client").then((m) => m.initSentry()),
});

/** Report an error to Sentry: right away once the SDK is up, from the buffer before then. */
export const captureError = reporter.captureError;
/** Leave a breadcrumb for the next reported error. */
export const recordBreadcrumb = reporter.recordBreadcrumb;

/** Called once, from instrumentation-client.ts, before hydration. */
export function installErrorReporting(): void {
  if (typeof window === "undefined" || !CLIENT_REPORTING) return;
  reporter.listen(window);
  whenIdleAfterLoad(window, () => void reporter.load());
}
