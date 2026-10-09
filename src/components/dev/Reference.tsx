"use client";

import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { BookOpen, Play } from "lucide-react";
import { useDeskPortal } from "@/components/desk/DeskFrame";
import { buildUrl, curlFor, fetchSnippet, groupByTag, matchOps, paramDefaults, pythonSnippet, sampleValue, schemaTree, typeLabel, type ApiOp, type OpenApiDoc } from "@/lib/openapi";
import { GUIDES, type Guide } from "./Guides";
import { Block, Code, MethodBadge, SchemaTreeView, tintJson } from "./blocks";
import dk from "@/components/desk/desk.module.css";
import s from "./dev.module.css";

export type RefSelection = { kind: "op"; id: string } | { kind: "guide"; id: string };

// ---------------------------------------------------------------------------
// Ledger: guides, then every public operation by tag
// ---------------------------------------------------------------------------

export function ReferenceLedger({ ops, selected, select, loading }: { ops: ApiOp[]; selected: RefSelection | null; select: (sel: RefSelection) => void; loading: boolean }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => matchOps(q, ops), [q, ops]);
  const groups = useMemo(() => groupByTag(shown), [shown]);
  const guides = q.trim() ? GUIDES.filter((g) => `${g.title} ${g.summary}`.toLowerCase().includes(q.trim().toLowerCase())) : GUIDES;
  return (
    <>
      <div className={s.ledgerHead}>
        <input className={s.filter} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter routes — path, words, tag" aria-label="Filter the reference" />
        <span className={s.ledgerNote}>{ops.length ? `${ops.length} public routes, read live from the API's own OpenAPI document.` : "Reading the API's OpenAPI document…"}</span>
      </div>
      <div className={s.rows} role="list">
        {guides.length ? (
          <>
            <div className={s.group}>
              <span className={dk.label}>Guides</span>
            </div>
            {guides.map((g) => {
              const on = selected?.kind === "guide" && selected.id === g.id;
              return (
                <button key={g.id} type="button" className={`${s.row} ${s.rowPlain} ${on ? s.rowOn : ""}`} onClick={() => select({ kind: "guide", id: g.id })}>
                  <span>
                    <span style={{ fontWeight: 500 }}>{g.title}</span>
                    <span className={s.rowSub}>{g.summary}</span>
                  </span>
                  <BookOpen size={12} className={dk.chev} />
                </button>
              );
            })}
          </>
        ) : null}
        {loading && ops.length === 0 ? (
          <div className={s.ledgerEmpty}>Loading routes…</div>
        ) : (
          groups.map((g) => (
            <div key={g.tag}>
              <div className={s.group}>
                <span className={dk.label}>{g.tag}</span>
                <span className={dk.sub}>{g.ops.length}</span>
              </div>
              {g.ops.map((op) => {
                const on = selected?.kind === "op" && selected.id === op.id;
                return (
                  <button key={op.id} type="button" className={`${s.row} ${on ? s.rowOn : ""}`} onClick={() => select({ kind: "op", id: op.id })} title={op.summary}>
                    <MethodBadge method={op.method} />
                    <span>
                      <span className={s.rowPath}>{pathNodes(op.path)}</span>
                      <span className={s.rowSub}>{op.summary}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))
        )}
        {!loading && q && shown.length === 0 && guides.length === 0 ? <div className={s.ledgerEmpty}>Nothing matches “{q}”.</div> : null}
      </div>
    </>
  );
}

/** "/v1/players/{player_id}/stats" with the parameters emphasised. */
export function pathNodes(path: string): React.ReactNode[] {
  return path.split(/(\{[^}]+\})/).map((part, i) => (part.startsWith("{") ? <em key={i}>{part}</em> : <b key={i}>{part.replace(/^\/v1/, "")}</b>));
}

// ---------------------------------------------------------------------------
// Sheet: one operation
// ---------------------------------------------------------------------------

export function OpSheet({ doc, op, base, today, tryIt }: { doc: OpenApiDoc; op: ApiOp; base: string; today: string; tryIt: (op: ApiOp) => void }) {
  const [lang, setLang] = useState<"curl" | "js" | "python">("curl");
  const values = useMemo(() => paramDefaults(op, today), [op, today]);
  const url = buildUrl(base, op, values);
  const body = op.body ? JSON.stringify(sampleValue(doc, op.body), null, 2) : null;
  const key = op.auth === "api-key" ? "cv_your_key" : null;
  const snippet = lang === "curl" ? curlFor(url, op.method, key, body) : lang === "js" ? fetchSnippet(url, op.method, key, body) : pythonSnippet(url, op.method, key, body);
  const ok = op.responses.find((r) => r.status === "200");
  const others = op.responses.filter((r) => r.status !== "200");
  return (
    <div className={s.sheetInner}>
      <header className={s.head}>
        <div className={s.headBody}>
          <span className={s.headTitle}>{op.summary}</span>
          <span className={s.headPath}>
            <MethodBadge method={op.method} big />
            <span>{op.path.split(/(\{[^}]+\})/).map((part, i) => (part.startsWith("{") ? <em key={i}>{part}</em> : <span key={i}>{part}</span>))}</span>
          </span>
          <span className={s.headChips}>
            <span className={`${dk.chip} ${op.auth === "api-key" ? dk.pv : dk.flat}`}>{op.auth === "api-key" ? `API key · ${op.scope ?? "any"} scope` : "no key"}</span>
            <span className={`${dk.chip} ${dk.flat}`}>{op.rateLimit}</span>
            <span className={`${dk.chip} ${dk.flat}`}>{op.tag}</span>
          </span>
          {op.description ? <span className={s.headSub}>{op.description}</span> : null}
        </div>
        <div className={s.headActions}>
          <button type="button" className={`${dk.btn} ${dk.btnPrimary} ${dk.btnSmall}`} onClick={() => tryIt(op)}>
            <Play size={12} /> Try it
          </button>
        </div>
      </header>

      {op.params.length ? (
        <Block title="Parameters" note={`${op.params.filter((p) => p.in === "path").length} in the path · ${op.params.filter((p) => p.in === "query").length} in the query`}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>In</th>
                <th>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {op.params.map((p) => (
                <tr key={`${p.in}-${p.name}`}>
                  <td className={s.mono}>
                    {p.name}
                    {p.required ? <span className={s.req}> •</span> : null}
                  </td>
                  <td className={s.mono}>{p.in}</td>
                  <td className={s.mono}>{typeLabel(doc, p.schema)}</td>
                  <td className={s.desc}>
                    {p.description ?? ""}
                    {p.schema.default !== undefined && p.schema.default !== null ? <span className={s.muted}> · default {JSON.stringify(p.schema.default)}</span> : null}
                    {p.schema.enum ? <span className={s.muted}> · one of {p.schema.enum.map((e) => JSON.stringify(e)).join(", ")}</span> : null}
                    {p.schema.minimum !== undefined || p.schema.maximum !== undefined ? (
                      <span className={s.muted}>
                        {" "}
                        · {p.schema.minimum !== undefined ? `≥ ${p.schema.minimum}` : ""}
                        {p.schema.minimum !== undefined && p.schema.maximum !== undefined ? " " : ""}
                        {p.schema.maximum !== undefined ? `≤ ${p.schema.maximum}` : ""}
                      </span>
                    ) : null}
                    {p.schema.pattern ? <span className={s.muted}> · /{p.schema.pattern}/</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>
      ) : null}

      {op.body ? (
        <Block title="Request body" note={typeLabel(doc, op.body)}>
          <SchemaTreeView nodes={schemaTree(doc, op.body)} />
          <div style={{ marginTop: 12 }}>
            <Code text={body ?? ""} lang="json" json />
          </div>
        </Block>
      ) : null}

      <Block title="Response" note={ok ? `200 · ${typeLabel(doc, ok.schema)}` : undefined}>
        {ok?.schema ? <SchemaTreeView nodes={schemaTree(doc, ok.schema)} /> : <div className={s.blockEmpty}>{ok?.description || "A JSON envelope."}</div>}
        {others.length ? (
          <table className={s.table} style={{ marginTop: 14 }}>
            <tbody>
              {others.map((r) => (
                <tr key={r.status}>
                  <td className={s.mono} style={{ width: 60, color: r.status.startsWith("4") || r.status.startsWith("5") ? "var(--down)" : undefined }}>
                    {r.status}
                  </td>
                  <td className={s.desc}>{r.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </Block>

      <Block
        title="Call it"
        note={key ? "with your key in X-API-Key" : "no key needed"}
        right={
          <div className={dk.rail} role="radiogroup" aria-label="Language" style={{ padding: 1 }}>
            {(["curl", "js", "python"] as const).map((l) => (
              <button key={l} type="button" role="radio" aria-checked={lang === l} className={`${dk.seg} ${lang === l ? dk.segOn : ""}`} style={{ height: 22, padding: "0 8px", fontSize: 10.5 }} onClick={() => setLang(l)}>
                {lang === l ? <span className={dk.segPill} /> : null}
                <span className={dk.segLabel}>{l === "js" ? "JS" : l === "curl" ? "cURL" : "Python"}</span>
              </button>
            ))}
          </div>
        }
      >
        <Code text={snippet} lang={lang} />
      </Block>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sheet: a guide
// ---------------------------------------------------------------------------

export function GuideSheet({ guide, openGuide }: { guide: Guide; openGuide: (id: string) => void }) {
  const i = GUIDES.findIndex((g) => g.id === guide.id);
  const next = GUIDES[i + 1];
  return (
    <div className={s.sheetInner}>
      <header className={s.head}>
        <div className={s.headBody}>
          <span className={s.headTitle}>{guide.title}</span>
          <span className={s.headSub}>{guide.summary}</span>
        </div>
      </header>
      <section className={s.block}>
        <div className={s.prose}>{renderGuide(guide.body)}</div>
        {next ? (
          <div style={{ marginTop: 18 }}>
            <button type="button" className={dk.btn} onClick={() => openGuide(next.id)}>
              Next: {next.title} →
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

/** The guides' little markdown: headings, paragraphs, bullets, inline code, fenced blocks, bold. */
export function renderGuide(body: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const lines = body.split("\n");
  let i = 0;
  let k = 0;
  let para: string[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (para.length) {
      out.push(<p key={k++}>{inline(para.join(" "))}</p>);
      para = [];
    }
    if (bullets.length) {
      out.push(
        <ul key={k++}>
          {bullets.map((b, j) => (
            <li key={j}>{inline(b)}</li>
          ))}
        </ul>
      );
      bullets = [];
    }
  };
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      flush();
      const lang = line.slice(3).trim();
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i += 1;
      out.push(
        <div key={k++} style={{ margin: "8px 0 12px" }}>
          <Code text={buf.join("\n")} lang={lang || undefined} json={lang === "json"} />
        </div>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      flush();
      out.push(<h3 key={k++}>{line.slice(3)}</h3>);
    } else if (line.startsWith("- ")) {
      if (para.length) flush();
      bullets.push(line.slice(2));
    } else if (line.trim() === "") {
      flush();
    } else {
      if (bullets.length) flush();
      para.push(line);
    }
    i += 1;
  }
  flush();
  return out;
}

function inline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /`([^`]+)`|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(<span key={k++}>{text.slice(last, m.index)}</span>);
    if (m[1]) out.push(<code key={k++}>{m[1]}</code>);
    else out.push(<strong key={k++}>{m[2]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(<span key={k++}>{text.slice(last)}</span>);
  return out;
}

// ---------------------------------------------------------------------------
// The route finder (⌘K)
// ---------------------------------------------------------------------------

export function OpFinder({ open, onOpenChange, ops, onPick }: { open: boolean; onOpenChange: (open: boolean) => void; ops: ApiOp[]; onPick: (op: ApiOp) => void }) {
  const container = useDeskPortal();
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!open) setQ("");
  }, [open]);
  const hits = useMemo(() => matchOps(q, ops).slice(0, 14), [q, ops]);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className={dk.overlay} />
        <Dialog.Content className={dk.dialog} style={{ top: "14vh", transform: "translate(-50%, 0)", animation: "none", width: "min(600px, calc(100vw - 32px))" }} aria-describedby={undefined}>
          <Dialog.Title style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>Find a route</Dialog.Title>
          <Command label="Find a route" shouldFilter={false} loop>
            <Command.Input className={dk.menuInput} style={{ height: 48, fontSize: 14 }} value={q} onValueChange={setQ} placeholder="A route — players, trending, lineup…" autoFocus />
            <Command.List className={dk.menuList} style={{ maxHeight: "50vh" }}>
              {hits.map((op) => (
                <Command.Item key={op.id} value={op.id} className={dk.menuItem} onSelect={() => { onPick(op); onOpenChange(false); }}>
                  <MethodBadge method={op.method} />
                  <span className={dk.grow} style={{ minWidth: 0 }}>
                    <span className={s.rowPath}>{pathNodes(op.path)}</span>
                    <span className={s.rowSub}>{op.summary}</span>
                  </span>
                  <span className={dk.sub}>{op.tag}</span>
                </Command.Item>
              ))}
              {hits.length === 0 ? <div className={dk.menuEmpty}>No route matches “{q}”.</div> : null}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export { tintJson };
