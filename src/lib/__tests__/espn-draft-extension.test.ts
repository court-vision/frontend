import { afterEach, describe, expect, test } from "bun:test";
import { backoffDelay, chromeRuntimeAvailable, connectToExtension } from "../espn-draft/extension";

// A minimal chrome.runtime stub with a controllable port.
function stubChrome() {
  const listeners = { message: [] as ((m: unknown) => void)[], disconnect: [] as (() => void)[] };
  let lastError: { message?: string } | undefined;
  let throwOnPost = false;
  const posted: unknown[] = [];
  const port = {
    name: "",
    postMessage(m: unknown) {
      if (throwOnPost) throw new Error("Attempting to use a disconnected port object");
      posted.push(m);
    },
    disconnect() {},
    onMessage: {
      addListener: (cb: (m: unknown) => void) => listeners.message.push(cb),
      removeListener: (cb: (m: unknown) => void) => {
        listeners.message = listeners.message.filter((l) => l !== cb);
      },
    },
    onDisconnect: {
      addListener: (cb: () => void) => listeners.disconnect.push(cb),
      removeListener: (cb: () => void) => {
        listeners.disconnect = listeners.disconnect.filter((l) => l !== cb);
      },
    },
  };
  const runtime = {
    connect: (_id: string, info?: { name?: string }) => {
      port.name = info?.name ?? "";
      return port;
    },
    get lastError() {
      return lastError;
    },
  };
  (globalThis as { chrome?: unknown }).chrome = { runtime };
  return {
    fireMessage: (m: unknown) => listeners.message.forEach((l) => l(m)),
    fireDisconnect: (err?: string) => {
      lastError = err ? { message: err } : undefined;
      listeners.disconnect.forEach((l) => l());
    },
    setError: (err: string) => {
      lastError = { message: err };
    },
    posted,
    setThrowOnPost: (v: boolean) => {
      throwOnPost = v;
    },
  };
}

afterEach(() => {
  delete (globalThis as { chrome?: unknown }).chrome;
});

describe("chromeRuntimeAvailable", () => {
  test("false with no chrome global", () => {
    expect(chromeRuntimeAvailable()).toBe(false);
  });
  test("true once a runtime with connect exists", () => {
    stubChrome();
    expect(chromeRuntimeAvailable()).toBe(true);
  });
});

describe("connectToExtension", () => {
  test("returns null when the runtime is unavailable", () => {
    expect(connectToExtension("abc", { onMessage() {}, onDisconnect() {} })).toBeNull();
  });

  test("routes messages to onMessage", () => {
    const chrome = stubChrome();
    const got: unknown[] = [];
    connectToExtension("abc", { onMessage: (m) => got.push(m), onDisconnect() {} });
    chrome.fireMessage({ type: "hello", version: "0.2.0" });
    expect(got).toEqual([{ type: "hello", version: "0.2.0" }]);
  });

  test("a disconnect with a 'receiving end' error reports not-installed", () => {
    const chrome = stubChrome();
    const reasons: string[] = [];
    connectToExtension("abc", { onMessage() {}, onDisconnect: (r) => reasons.push(r) });
    chrome.fireDisconnect("Could not establish connection. Receiving end does not exist.");
    expect(reasons).toEqual(["not-installed"]);
  });

  test("a plain disconnect reports closed", () => {
    const chrome = stubChrome();
    const reasons: string[] = [];
    connectToExtension("abc", { onMessage() {}, onDisconnect: (r) => reasons.push(r) });
    chrome.fireDisconnect();
    expect(reasons).toEqual(["closed"]);
  });
});

describe("backoffDelay", () => {
  test("1s,2s,4s,8s,16s then a 30s ceiling", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(backoffDelay)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  });
});

describe("PortHandle.send", () => {
  test("posts while connected; false after our disconnect", () => {
    const chrome = stubChrome();
    const h = connectToExtension("abc", { onMessage() {}, onDisconnect() {} })!;
    expect(h.send({ type: "select", playerId: 1, requestId: "r" })).toBe(true);
    expect(chrome.posted).toEqual([{ type: "select", playerId: 1, requestId: "r" }]);
    h.disconnect();
    expect(h.send({ type: "select", playerId: 2, requestId: "r2" })).toBe(false);
    expect(chrome.posted).toHaveLength(1);
  });

  test("false after the extension side dropped the port", () => {
    const chrome = stubChrome();
    const h = connectToExtension("abc", { onMessage() {}, onDisconnect() {} })!;
    chrome.fireDisconnect();
    expect(h.send({ type: "select", playerId: 1, requestId: "r" })).toBe(false);
    expect(chrome.posted).toHaveLength(0);
  });

  test("false when the port throws (service worker gone) — never 'maybe sent'", () => {
    const chrome = stubChrome();
    const h = connectToExtension("abc", { onMessage() {}, onDisconnect() {} })!;
    chrome.setThrowOnPost(true);
    expect(h.send({ type: "select", playerId: 1, requestId: "r" })).toBe(false);
  });
});
