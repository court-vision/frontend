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

// A runtime where each id is installed or not, with one port per connect.
function stubInstalled(installed: Set<string>) {
  const ports: { id: string; fireMessage: (m: unknown) => void; fireDisconnect: (err?: string) => void; posted: unknown[] }[] = [];
  let lastError: { message?: string } | undefined;
  const runtime = {
    connect: (id: string) => {
      const listeners = { message: [] as ((m: unknown) => void)[], disconnect: [] as (() => void)[] };
      const posted: unknown[] = [];
      const port = {
        postMessage: (m: unknown) => posted.push(m),
        disconnect() {},
        onMessage: {
          addListener: (cb: (m: unknown) => void) => listeners.message.push(cb),
          removeListener: (cb: (m: unknown) => void) => (listeners.message = listeners.message.filter((l) => l !== cb)),
        },
        onDisconnect: {
          addListener: (cb: () => void) => listeners.disconnect.push(cb),
          removeListener: (cb: () => void) => (listeners.disconnect = listeners.disconnect.filter((l) => l !== cb)),
        },
      };
      const entry = {
        id,
        posted,
        fireMessage: (m: unknown) => listeners.message.forEach((l) => l(m)),
        fireDisconnect: (err?: string) => {
          lastError = err ? { message: err } : undefined;
          listeners.disconnect.forEach((l) => l());
          lastError = undefined;
        },
      };
      ports.push(entry);
      return port;
    },
    get lastError() {
      return lastError;
    },
  };
  (globalThis as { chrome?: unknown }).chrome = { runtime };
  const missing = "Could not establish connection. Receiving end does not exist.";
  // Chrome reports a missing extension asynchronously, on the port.
  const settle = () => {
    for (const p of [...ports]) if (!installed.has(p.id) && !(p as { done?: boolean }).done) {
      (p as { done?: boolean }).done = true;
      p.fireDisconnect(missing);
    }
  };
  return { ports, settle };
}

describe("connectToAnyExtension", () => {
  test("falls through a missing id to the next, and sends on the one that answers", async () => {
    const { connectToAnyExtension } = await import("../espn-draft/extension");
    const rt = stubInstalled(new Set(["dev-id"]));
    const got: unknown[] = [];
    const drops: string[] = [];
    const handle = connectToAnyExtension(["store-id", "dev-id"], { onMessage: (m) => got.push(m), onDisconnect: (r) => drops.push(r) });
    rt.settle(); // store-id: not installed → tries dev-id
    expect(rt.ports.map((p) => p.id)).toEqual(["store-id", "dev-id"]);
    expect(drops).toEqual([]);
    rt.ports[1].fireMessage({ type: "hello", version: "1.0.0" });
    expect(got).toEqual([{ type: "hello", version: "1.0.0" }]);
    expect(handle!.send({ type: "select", playerId: 1, requestId: "r" })).toBe(true);
    expect(rt.ports[1].posted).toHaveLength(1);
  });

  test("not-installed only once every id is missing", async () => {
    const { connectToAnyExtension } = await import("../espn-draft/extension");
    const rt = stubInstalled(new Set());
    const drops: string[] = [];
    connectToAnyExtension(["a", "b"], { onMessage() {}, onDisconnect: (r) => drops.push(r) });
    rt.settle();
    rt.settle();
    expect(rt.ports.map((p) => p.id)).toEqual(["a", "b"]);
    expect(drops).toEqual(["not-installed"]);
  });

  test("a drop after an answer is a drop, not a reason to try the next id", async () => {
    const { connectToAnyExtension } = await import("../espn-draft/extension");
    const rt = stubInstalled(new Set(["a", "b"]));
    const drops: string[] = [];
    connectToAnyExtension(["a", "b"], { onMessage() {}, onDisconnect: (r) => drops.push(r) });
    rt.ports[0].fireMessage({ type: "hello", version: "1.0.0" });
    rt.ports[0].fireDisconnect();
    expect(rt.ports.map((p) => p.id)).toEqual(["a"]);
    expect(drops).toEqual(["closed"]);
  });

  test("the id that answered last time is tried first", async () => {
    const { connectToAnyExtension } = await import("../espn-draft/extension");
    let rt = stubInstalled(new Set(["dev-id"]));
    connectToAnyExtension(["store-id", "dev-id"], { onMessage() {}, onDisconnect() {} });
    rt.settle();
    rt.ports[1].fireMessage({ type: "hello", version: "1.0.0" });
    rt = stubInstalled(new Set(["dev-id"]));
    connectToAnyExtension(["store-id", "dev-id"], { onMessage() {}, onDisconnect() {} });
    expect(rt.ports.map((p) => p.id)).toEqual(["dev-id"]);
  });
});
