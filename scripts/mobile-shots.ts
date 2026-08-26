/**
 * Screenshots through the Chrome DevTools Protocol with device-metrics
 * emulation (what DevTools "device mode" does). Driven by mobile-shots.sh.
 *
 * Why not `chrome --headless --screenshot --window-size=390,844`? Chrome
 * clamps the window to its ~500 px minimum width, so phone layouts came out
 * laid out at 500 px and cropped to 390. CDP emulation has no such floor and
 * also lets phone sizes emulate touch (`pointer: coarse`).
 *
 * Console errors/warnings and uncaught exceptions (hydration mismatches!) are
 * printed under each shot. EVAL="<js expression>" prints its value per shot,
 * e.g. EVAL='document.documentElement.scrollWidth' to catch horizontal overflow.
 * PRE_EVAL="<js expression>" runs before each shot to put the page in a state
 * worth capturing, e.g. scrolling a sticky-column table sideways.
 *
 * Env (all optional): CHROME, BASE_URL, OUT, SIZES, ROUTES, SETTLE_MS, PRE_EVAL, EVAL.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME =
  process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.OUT ?? ".mobile-shots";
const SIZES = (process.env.SIZES ?? "390x844 768x1024").split(/\s+/).filter(Boolean);
const ROUTES = (process.env.ROUTES ?? "/ /rankings /sign-in /terminal /query-builder")
  .split(/\s+/)
  .filter(Boolean);
/** Time after `load` for hydration, Clerk and data fetches to settle. */
const SETTLE_MS = Number(process.env.SETTLE_MS ?? 5000);
/** Optional JS expression evaluated in the page before each shot (scroll/click into a state). */
const PRE_EVAL = process.env.PRE_EVAL;
/** Optional JS expression evaluated in the page after each shot; its value is printed (DOM probes). */
const EVAL = process.env.EVAL;
const LOAD_TIMEOUT_MS = 30_000;

type Json = Record<string, unknown>;
interface CdpMessage {
  id?: number;
  method?: string;
  params?: Json;
  sessionId?: string;
  result?: Json;
  error?: { message: string };
}

class Cdp {
  private nextId = 0;
  private pending = new Map<number, { resolve: (r: Json) => void; reject: (e: Error) => void }>();
  private listeners = new Set<(m: CdpMessage) => void>();

  private constructor(private ws: WebSocket) {
    ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data)) as CdpMessage;
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message));
        else p.resolve(msg.result ?? {});
      } else if (msg.method) {
        for (const l of this.listeners) l(msg);
      }
    };
  }

  static connect(url: string): Promise<Cdp> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.onopen = () => resolve(new Cdp(ws));
      ws.onerror = () => reject(new Error(`could not connect to ${url}`));
    });
  }

  send(method: string, params: Json = {}, sessionId?: string): Promise<Json> {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }

  waitFor(method: string, sessionId: string, timeoutMs: number): Promise<Json> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(listener);
        reject(new Error(`timed out waiting for ${method}`));
      }, timeoutMs);
      const listener = (m: CdpMessage) => {
        if (m.method === method && m.sessionId === sessionId) {
          clearTimeout(timer);
          this.listeners.delete(listener);
          resolve(m.params ?? {});
        }
      };
      this.listeners.add(listener);
    });
  }

  on(listener: (m: CdpMessage) => void) {
    this.listeners.add(listener);
  }

  close() {
    this.ws.close();
  }
}

function slugFor(route: string): string {
  return route === "/" ? "home" : route.replace(/^\//, "").replace(/\//g, "-");
}

async function main() {
  const profile = mkdtempSync(join(tmpdir(), "cv-shots-"));
  const chrome = Bun.spawn(
    [
      CHROME,
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "--disable-gpu",
      "about:blank",
    ],
    { stdout: "ignore", stderr: "pipe" }
  );

  // Chrome announces its DevTools endpoint on stderr; keep draining afterwards
  // so the pipe never fills up.
  const reader = chrome.stderr.getReader();
  const decoder = new TextDecoder();
  let wsUrl: string | undefined;
  let buffered = "";
  while (!wsUrl) {
    const { value, done } = await reader.read();
    if (done) throw new Error(`Chrome exited before DevTools was ready:\n${buffered}`);
    buffered += decoder.decode(value, { stream: true });
    wsUrl = buffered.match(/DevTools listening on (ws:\/\/\S+)/)?.[1];
  }
  void (async () => {
    while (!(await reader.read()).done) {
      /* drain */
    }
  })();

  const cdp = await Cdp.connect(wsUrl);
  try {
    const { targetId } = (await cdp.send("Target.createTarget", { url: "about:blank" })) as {
      targetId: string;
    };
    const { sessionId } = (await cdp.send("Target.attachToTarget", {
      targetId,
      flatten: true,
    })) as { sessionId: string };
    await cdp.send("Page.enable", {}, sessionId);
    // Surface console errors/warnings and uncaught exceptions per route.
    await cdp.send("Runtime.enable", {}, sessionId);
    const consoleLines: string[] = [];
    cdp.on((m) => {
      if (m.sessionId !== sessionId) return;
      if (m.method === "Runtime.consoleAPICalled") {
        const { type, args } = m.params as {
          type: string;
          args: Array<{ value?: unknown; description?: string }>;
        };
        if (type !== "error" && type !== "warning") return;
        const text = args
          .map((a) => (typeof a.value === "string" ? a.value : (a.description ?? JSON.stringify(a.value))))
          .join(" ");
        consoleLines.push(`console.${type}: ${text.slice(0, 400)}`);
      } else if (m.method === "Runtime.exceptionThrown") {
        const { exceptionDetails } = m.params as {
          exceptionDetails: { text: string; exception?: { description?: string } };
        };
        consoleLines.push(
          `exception: ${(exceptionDetails.exception?.description ?? exceptionDetails.text).slice(0, 6000)}`
        );
      }
    });

    mkdirSync(OUT, { recursive: true });
    for (const route of ROUTES) {
      for (const size of SIZES) {
        const [width, height] = size.split("x").map(Number);
        if (!width || !height) throw new Error(`bad size ${size} (want WxH)`);
        const mobile = width < 768;
        await cdp.send(
          "Emulation.setDeviceMetricsOverride",
          { width, height, deviceScaleFactor: 2, mobile },
          sessionId
        );
        await cdp.send(
          "Emulation.setTouchEmulationEnabled",
          { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 },
          sessionId
        );
        const loaded = cdp.waitFor("Page.loadEventFired", sessionId, LOAD_TIMEOUT_MS);
        await cdp.send("Page.navigate", { url: `${BASE_URL}${route}` }, sessionId);
        await loaded;
        await Bun.sleep(SETTLE_MS);
        if (PRE_EVAL) {
          await cdp.send(
            "Runtime.evaluate",
            { expression: PRE_EVAL, awaitPromise: true },
            sessionId
          );
          await Bun.sleep(300);
        }
        const { data } = (await cdp.send(
          "Page.captureScreenshot",
          { format: "png" },
          sessionId
        )) as { data: string };
        const file = join(OUT, `${slugFor(route)}-${width}x${height}.png`);
        writeFileSync(file, Buffer.from(data, "base64"));
        console.log(`wrote ${file}`);
        for (const line of consoleLines) console.log(`  ${line}`);
        consoleLines.length = 0;
        if (EVAL) {
          const { result } = (await cdp.send(
            "Runtime.evaluate",
            { expression: EVAL, returnByValue: true },
            sessionId
          )) as { result: { value?: unknown; description?: string } };
          console.log(`  eval: ${JSON.stringify(result.value ?? result.description)}`);
        }
      }
    }
    await cdp.send("Target.closeTarget", { targetId });
  } finally {
    cdp.close();
    chrome.kill();
    await chrome.exited;
    rmSync(profile, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(`mobile-shots: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
