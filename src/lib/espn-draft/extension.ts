/**
 * The thin wrapper around `chrome.runtime` used to talk to the Draft Tap
 * extension. Pure apart from the injected `chrome` global, so the reconnect
 * math is testable with a stub.
 *
 * The page never opens a socket of its own; it only receives the frames the
 * extension already read off ESPN's connection. Chrome exposes `chrome.runtime`
 * on a page only when an installed extension's `externally_connectable` matches
 * it, so the availability guard is also the "is the tap even installable here"
 * check.
 */
export const PORT_NAME = "cv-draft-sync";

/** True on a Chromium browser where an externally-connectable extension exists. */
export function chromeRuntimeAvailable(): boolean {
  return typeof chrome !== "undefined" && typeof chrome?.runtime?.connect === "function";
}

export interface PortHandle {
  disconnect(): void;
}

export interface ConnectHandlers {
  onMessage(message: unknown): void;
  /**
   * `not-installed`: the extension id resolves to nothing on this browser
   * (a bad/missing id, or the extension is disabled). `closed`: an established
   * connection dropped (the service worker went idle, or the extension
   * reloaded).
   */
  onDisconnect(reason: "not-installed" | "closed", detail?: string): void;
}

/**
 * Open a port to the extension. Returns a handle, or null when the runtime is
 * unavailable (non-Chromium, or no matching extension) — the caller shows
 * "Chrome only" in that case rather than treating it as an error.
 */
export function connectToExtension(extensionId: string, handlers: ConnectHandlers): PortHandle | null {
  if (!chromeRuntimeAvailable() || !extensionId) return null;

  let port: CvChromePort;
  try {
    port = chrome!.runtime!.connect(extensionId, { name: PORT_NAME });
  } catch {
    // Synchronous throw means the id is malformed or unknown.
    handlers.onDisconnect("not-installed");
    return null;
  }

  let settled = false;
  const message = (msg: unknown) => handlers.onMessage(msg);
  const disconnect = () => {
    if (settled) return;
    settled = true;
    // `lastError` distinguishes "no such extension" from a normal drop; it is
    // only readable synchronously inside the onDisconnect callback.
    const err = chrome?.runtime?.lastError?.message ?? "";
    const reason = /Receiving end does not exist|Could not establish connection|No matching/i.test(err)
      ? "not-installed"
      : "closed";
    port.onMessage.removeListener(message);
    port.onDisconnect.removeListener(disconnect);
    handlers.onDisconnect(reason, err || undefined);
  };

  port.onMessage.addListener(message);
  port.onDisconnect.addListener(disconnect);

  return {
    disconnect() {
      if (settled) return;
      settled = true;
      port.onMessage.removeListener(message);
      port.onDisconnect.removeListener(disconnect);
      try {
        port.disconnect();
      } catch {
        // already gone
      }
    },
  };
}

/** Reconnect backoff: 1s, 2s, 4s, 8s, 16s, then a 30s ceiling. No jitter (testable). */
export function backoffDelay(attempt: number): number {
  return Math.min(1000 * 2 ** Math.max(0, attempt - 1), 30_000);
}
