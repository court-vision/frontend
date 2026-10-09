"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, History, Send, Trash2 } from "lucide-react";
import { buildUrl, curlFor, fmtBytes, groupByTag, matchOps, paramDefaults, prettyJson, sampleValue, typeLabel, type ApiOp, type OpenApiDoc } from "@/lib/openapi";
import { Block, Code, Field, MethodBadge } from "./blocks";
import { pathNodes } from "./Reference";
import { useDevStore, useSessionKey, type HistoryEntry } from "./useDevStore";
import dk from "@/components/desk/desk.module.css";
import s from "./dev.module.css";

// ---------------------------------------------------------------------------
// Ledger: routes, then what you sent lately
// ---------------------------------------------------------------------------

export function PlaygroundLedger({ ops, opId, pick, replay }: { ops: ApiOp[]; opId: string | null; pick: (op: ApiOp) => void; replay: (entry: HistoryEntry) => void }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => matchOps(q, ops), [q, ops]);
  const groups = useMemo(() => groupByTag(shown), [shown]);
  const history = useDevStore((st) => st.history);
  const clear = useDevStore((st) => st.clearHistory);
  return (
    <>
      <div className={s.ledgerHead}>
        <input className={s.filter} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter routes" aria-label="Filter routes" />
        <span className={s.ledgerNote}>Pick a route, fill it in, send it. Public routes go straight to the API from your browser.</span>
      </div>
      <div className={s.rows}>
        {history.length && !q ? (
          <>
            <div className={s.group}>
              <History size={11} className={dk.chev} />
              <span className={dk.label}>Recent</span>
              <span className={dk.spacer} />
              <button type="button" className={s.nodeToggle} onClick={clear} title="Forget these">
                <Trash2 size={11} />
              </button>
            </div>
            {history.slice(0, 8).map((h) => (
              <button key={h.id} type="button" className={`${s.row} ${s.hist}`} onClick={() => replay(h)} title={h.url}>
                <MethodBadge method={h.method as ApiOp["method"]} />
                <span className={s.rowPath}>
                  <b>{h.url.replace(/^https?:\/\/[^/]+/, "").replace(/^\/v1/, "")}</b>
                </span>
                <span className={s.histStatus} style={{ color: h.status == null ? "var(--down)" : h.status < 300 ? "var(--up)" : h.status < 500 ? "var(--warn)" : "var(--down)" }}>
                  {h.status ?? "—"}
                </span>
              </button>
            ))}
          </>
        ) : null}
        {groups.map((g) => (
          <div key={g.tag}>
            <div className={s.group}>
              <span className={dk.label}>{g.tag}</span>
            </div>
            {g.ops.map((op) => (
              <button key={op.id} type="button" className={`${s.row} ${op.id === opId ? s.rowOn : ""}`} onClick={() => pick(op)} title={op.summary}>
                <MethodBadge method={op.method} />
                <span>
                  <span className={s.rowPath}>{pathNodes(op.path)}</span>
                  <span className={s.rowSub}>{op.summary}</span>
                </span>
              </button>
            ))}
          </div>
        ))}
        {q && shown.length === 0 ? <div className={s.ledgerEmpty}>Nothing matches “{q}”.</div> : null}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sheet: build and send
// ---------------------------------------------------------------------------

interface Result {
  status: number | null;
  statusText: string;
  ms: number;
  bytes: number;
  headers: Array<[string, string]>;
  text: string;
  error: string | null;
}

const KEEP_HEADERS = ["content-type", "x-correlation-id", "retry-after", "x-ratelimit-limit", "x-ratelimit-remaining", "cache-control", "content-length"];

/** One request from the browser to the API, timed; null when it was aborted. */
async function sendRequest(url: string, method: string, headers: Record<string, string>, body: string | null, signal: AbortSignal): Promise<Result | null> {
  const t0 = performance.now();
  try {
    const r = await fetch(url, { method, headers, body: body ?? undefined, signal });
    const text = await r.text();
    const hs: Array<[string, string]> = [];
    r.headers.forEach((v, k) => {
      if (KEEP_HEADERS.includes(k.toLowerCase())) hs.push([k, v]);
    });
    return { status: r.status, statusText: r.statusText, ms: Math.round(performance.now() - t0), bytes: new Blob([text]).size, headers: hs, text, error: null };
  } catch (e) {
    if (signal.aborted) return null;
    return { status: null, statusText: "", ms: Math.round(performance.now() - t0), bytes: 0, headers: [], text: "", error: e instanceof Error ? e.message : "The request failed before an answer came back" };
  }
}

export function PlaygroundSheet({ doc, op, base, today, replayed }: { doc: OpenApiDoc; op: ApiOp | null; base: string; today: string; replayed: HistoryEntry | null }) {
  const key = useSessionKey((st) => st.key);
  const setKey = useSessionKey((st) => st.setKey);
  const remember = useDevStore((st) => st.remember);
  const [values, setValues] = useState<Record<string, string>>({});
  const [body, setBody] = useState<string>("");
  const [showKey, setShowKey] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [sending, setSending] = useState(false);
  const abort = useRef<AbortController | null>(null);

  // A new route resets the form to its defaults; a replayed request restores what was sent.
  useEffect(() => {
    if (!op) return;
    if (replayed && replayed.opId === op.id) {
      setValues(replayed.values);
      setBody(replayed.body ?? "");
    } else {
      setValues(paramDefaults(op, today));
      setBody(op.body ? JSON.stringify(sampleValue(doc, op.body), null, 2) : "");
    }
    setResult(null);
  }, [op, replayed, doc, today]);

  if (!op) {
    return (
      <div className={s.sheetInner}>
        <div className={s.hero}>
          <span className={s.heroTitle}>Playground</span>
          <span className={s.heroSub}>Pick a route on the left. Public routes need nothing; the Analytics routes take the key you paste here, which stays in this tab only.</span>
        </div>
      </div>
    );
  }

  const url = buildUrl(base, op, values);
  const needsKey = op.auth === "api-key";
  const sentKey = needsKey && key ? key : null;
  const bodyText = op.body && body.trim() ? body : null;
  const curl = curlFor(url, op.method, sentKey, bodyText);
  const missing = op.params.filter((p) => p.required && !(values[p.name] ?? "").trim()).map((p) => p.name);
  let bodyError: string | null = null;
  if (bodyText) {
    try {
      JSON.parse(bodyText);
    } catch (e) {
      bodyError = e instanceof Error ? e.message : "Not JSON";
    }
  }
  const blocked = missing.length ? `Fill in ${missing.join(", ")}` : bodyError ? `Body is not JSON: ${bodyError}` : needsKey && !key ? "This route needs an API key" : null;

  const send = async () => {
    if (blocked || sending) return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setSending(true);
    const headers: Record<string, string> = { Accept: "application/json" };
    if (sentKey) headers["X-API-Key"] = sentKey;
    if (bodyText && op.method !== "GET") headers["Content-Type"] = "application/json";
    const res = await sendRequest(url, op.method, headers, bodyText && op.method !== "GET" ? bodyText : null, ctrl.signal);
    if (!res) return;
    setResult(res);
    setSending(false);
    remember({ opId: op.id, method: op.method, url, status: res.status, ms: res.ms, values, body: bodyText });
  };

  const tone = result?.status == null ? "bad" : result.status < 300 ? "ok" : result.status < 500 ? "warn" : "bad";

  return (
    <div
      className={s.sheetInner}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          void send();
        }
      }}
    >
      <header className={s.head}>
        <div className={s.headBody}>
          <span className={s.headTitle}>{op.summary}</span>
          <span className={s.headPath}>
            <MethodBadge method={op.method} big />
            <span style={{ wordBreak: "break-all" }}>{url.replace(/^https?:\/\/[^/]+/, "")}</span>
          </span>
          <span className={s.headChips}>
            <span className={`${dk.chip} ${needsKey ? dk.pv : dk.flat}`}>{needsKey ? `needs a key · ${op.scope ?? "any"} scope` : "no key"}</span>
            <span className={`${dk.chip} ${dk.flat}`}>{op.rateLimit}</span>
          </span>
        </div>
        <div className={s.headActions}>
          <button type="button" className={`${dk.btn} ${dk.btnPrimary}`} onClick={() => void send()} disabled={!!blocked || sending} title={blocked ?? "Send (⌘⏎)"}>
            <Send size={13} />
            {sending ? "Sending…" : "Send"}
            <span className={dk.kbd}>⌘⏎</span>
          </button>
        </div>
      </header>

      {op.params.length ? (
        <Block title="Parameters" note={blocked && missing.length ? blocked : undefined}>
          <div className={s.form}>
            {op.params.map((p) => (
              <Field key={`${p.in}-${p.name}`} label={<span>{p.name} <span className={s.muted}>· {p.in} · {typeLabel(doc, p.schema)}</span></span>} hint={p.description} required={p.required}>
                {p.schema.enum ? (
                  <select className={s.select} value={values[p.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}>
                    {!p.required ? <option value="">(omit)</option> : null}
                    {p.schema.enum.map((e) => (
                      <option key={String(e)} value={String(e)}>
                        {String(e)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input className={s.input} value={values[p.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))} placeholder={p.schema.default != null ? String(p.schema.default) : p.in === "path" ? "required" : "omit"} />
                )}
              </Field>
            ))}
          </div>
        </Block>
      ) : null}

      {op.body ? (
        <Block title="Body" note={typeLabel(doc, op.body)} right={bodyError ? <span className={dk.error}>{bodyError}</span> : null}>
          <textarea className={s.textarea} value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} rows={8} />
        </Block>
      ) : null}

      <Block title="Key" note={needsKey ? "sent as X-API-Key" : "not needed for this route"}>
        <div className={s.row2}>
          <input className={s.input} style={{ flex: "1 1 280px" }} type={showKey ? "text" : "password"} value={key} onChange={(e) => setKey(e.target.value.trim())} placeholder="cv_…  (kept in this tab only)" autoComplete="off" spellCheck={false} />
          <button type="button" className={dk.iconBtn} onClick={() => setShowKey((v) => !v)} aria-label={showKey ? "Hide the key" : "Show the key"}>
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          {key ? (
            <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => setKey("")}>
              Forget
            </button>
          ) : null}
        </div>
      </Block>

      <Block title="As cURL">
        <Code text={curl} lang="bash" />
      </Block>

      <Block
        title="Response"
        note={result ? `${result.ms} ms · ${fmtBytes(result.bytes)}` : sending ? "waiting…" : "nothing sent yet"}
        right={
          result ? (
            <span className={s.status} data-tone={tone}>
              {result.status ?? "no answer"}
              {result.statusText ? ` ${result.statusText}` : ""}
            </span>
          ) : null
        }
      >
        {result ? (
          <>
            {result.headers.length ? (
              <div className={s.respBar}>
                {result.headers.map(([k, v]) => (
                  <span key={k}>
                    <span className={s.muted}>{k}:</span> {v}
                  </span>
                ))}
              </div>
            ) : null}
            {result.error ? <div className={dk.error}>{result.error}. If this is a browser, the API may be refusing this origin: the same request works from a terminal.</div> : <Code text={prettyJson(result.text)} lang="json" json maxHeight={560} />}
          </>
        ) : (
          <div className={s.blockEmpty}>Send the request to see its status, headers and body here. It goes from your browser to the API, nothing in between.</div>
        )}
      </Block>
    </div>
  );
}
