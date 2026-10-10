// Regenerates the landing page's desk screenshots (public/landing/<desk>-<theme>.png):
// every desk, in every desk theme, at 1440×900 with sample data.
//
//   bun run dev -p 3000          (prod API is fine: Scout and Developer read public routes)
//   node scripts/landing-shots.mjs [baseUrl]
//
// Needs Google Chrome installed. Drives it headless over the DevTools protocol,
// signed out, so the desks open their demos.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const out = join(process.cwd(), "public", "landing");
const THEMES = ["paper", "ember", "noon", "midnight"];
const DESKS = [
  ["week", "/week?demo", 2500],
  ["draft", "/draft/demo-1", 3000],
  ["scout", "/scout", 5000],
  ["dev", "/developer", 4000],
];
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9399;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), "cv-shots-"))}`,
    "--no-first-run",
    "--hide-scrollbars",
    // cdn.nba.com refuses headshots to a headless user agent.
    "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
    "about:blank",
  ],
  { stdio: "ignore" }
);

try {
  let targets;
  for (let i = 0; i < 50 && !targets; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    } catch {
      await sleep(200);
    }
  }
  const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((r) => {
      const i = ++id;
      pending.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const value = async (expression) =>
    (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;

  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `${base}/week?demo` });
  await sleep(4000);

  for (const theme of THEMES) {
    for (const [desk, path, settle] of DESKS) {
      await value(`localStorage.setItem("cv.desk.theme", ${JSON.stringify(JSON.stringify({ state: { theme }, version: 1 }))})`);
      await send("Page.navigate", { url: base + path });
      // The server renders the default theme: wait for the stored one, which means the page has hydrated.
      for (let k = 0; k < 60; k++) {
        if ((await value(`document.querySelector("[data-theme]")?.dataset.theme`)) === theme) break;
        await sleep(500);
      }
      // Dev-only overlays (Next's indicator, TanStack Query's devtools button).
      await value(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal,.tsqd-parent-container{display:none!important}"; document.head.appendChild(s); })()`);
      await sleep(settle);
      const shot = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(out, `${desk}-${theme}.png`), Buffer.from(shot.result.data, "base64"));
      console.log(`${desk}-${theme}.png`);
    }
  }
  ws.close();
} finally {
  chrome.kill();
}
