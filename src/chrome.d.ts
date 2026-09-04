/**
 * Minimal ambient declaration for the sliver of `chrome.runtime` the draft-sync
 * code uses to talk to the Draft Tap extension over `externally_connectable`.
 *
 * We deliberately do NOT depend on `@types/chrome` (a couple of megabytes of
 * surface we would never touch). Chrome only defines `chrome.runtime` on a page
 * when some installed extension's `externally_connectable` matches it, so every
 * use is guarded with `chromeRuntimeAvailable()` — these types just describe the
 * shape once that guard passes. `chrome` is optional on `window`, so `typeof
 * chrome` is safe on every other browser.
 */
interface CvChromePort {
  name: string;
  postMessage(message: unknown): void;
  disconnect(): void;
  onMessage: {
    addListener(cb: (message: unknown, port: CvChromePort) => void): void;
    removeListener(cb: (message: unknown, port: CvChromePort) => void): void;
  };
  onDisconnect: {
    addListener(cb: (port: CvChromePort) => void): void;
    removeListener(cb: (port: CvChromePort) => void): void;
  };
}

interface CvChromeRuntime {
  connect(extensionId: string, connectInfo?: { name?: string }): CvChromePort;
  readonly lastError?: { message?: string };
}

declare const chrome: { runtime?: CvChromeRuntime } | undefined;
