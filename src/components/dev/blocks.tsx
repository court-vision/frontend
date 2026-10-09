"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy } from "lucide-react";
import type { Method, TreeNode } from "@/lib/openapi";
import dk from "@/components/desk/desk.module.css";
import s from "./dev.module.css";

/** A titled section of a sheet. */
export function Block({ title, note, right, children, className }: { title: string; note?: React.ReactNode; right?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <section className={`${s.block} ${className ?? ""}`}>
      <div className={s.blockHead}>
        <span className={s.blockTitle}>{title}</span>
        {note ? <span className={s.blockNote}>{note}</span> : null}
        {right ? <span className={s.blockRight}>{right}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function MethodBadge({ method, big }: { method: Method; big?: boolean }) {
  return (
    <span className={`${s.method} ${big ? s.methodBig : ""}`} data-m={method}>
      {method}
    </span>
  );
}

/** Copy text to the clipboard; `copied` stays true for a moment. */
export function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  const copy = useCallback((text: string) => {
    void navigator.clipboard?.writeText(text).then(() => setCopied(true));
  }, []);
  return [copied, copy];
}

export function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, copy] = useCopy();
  return (
    <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => copy(text)} title={label}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : label}
    </button>
  );
}

/** A code block with a copy button; JSON is tinted. */
export function Code({ text, lang, json = false, maxHeight }: { text: string; lang?: string; json?: boolean; maxHeight?: number }) {
  return (
    <div className={s.codeWrap}>
      {lang ? <span className={s.codeLang}>{lang}</span> : null}
      <div className={s.codeTools}>
        <CopyBtn text={text} label="Copy" />
      </div>
      <pre className={s.code} style={maxHeight ? { maxHeight, overflow: "auto" } : undefined}>
        {json ? tintJson(text) : text}
      </pre>
    </div>
  );
}

/** JSON text as tinted spans: keys, strings, numbers, literals. */
export function tintJson(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(<span key={k++}>{text.slice(last, m.index)}</span>);
    if (m[1] && m[2]) {
      out.push(
        <span key={k++} className={s.tokKey}>
          {m[1]}
        </span>,
        <span key={k++} className={s.tokDim}>
          {m[2]}
        </span>
      );
    } else if (m[1]) {
      out.push(
        <span key={k++} className={s.tokStr}>
          {m[1]}
        </span>
      );
    } else if (m[3]) {
      out.push(
        <span key={k++} className={s.tokLit}>
          {m[3]}
        </span>
      );
    } else {
      out.push(
        <span key={k++} className={s.tokNum}>
          {m[4]}
        </span>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(<span key={k++}>{text.slice(last)}</span>);
  return out;
}

export function Skeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={className ?? s.sheetSkel} aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className={dk.skel} style={{ width: `${92 - (i % 4) * 14}%`, opacity: 1 - i * 0.07 }} />
      ))}
    </div>
  );
}

export interface KVItem {
  k: string;
  v: string;
  tone?: "ok" | "warn" | "bad";
  title?: string;
}

export function KV({ items }: { items: KVItem[] }) {
  return (
    <div className={s.kv}>
      {items.map((it) => (
        <div key={it.k} className={s.kvItem} title={it.title}>
          <span className={s.kvKey}>{it.k}</span>
          <span className={s.kvVal} data-tone={it.tone}>
            {it.v}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A labelled input, select or textarea. */
export function Field({ label, hint, required, children }: { label: React.ReactNode; hint?: React.ReactNode; required?: boolean; children: React.ReactNode }) {
  return (
    <label className={s.field}>
      <span className={s.fieldLabel}>
        {label}
        {required ? <span className={s.req}>REQUIRED</span> : null}
      </span>
      {children}
      {hint ? <span className={s.fieldHint}>{hint}</span> : null}
    </label>
  );
}

/** A schema as nested fields; named schemas fold. */
export function SchemaTreeView({ nodes, depth = 0 }: { nodes: TreeNode[]; depth?: number }) {
  if (nodes.length === 0) return <div className={s.blockEmpty}>No fields.</div>;
  return (
    <div className={s.tree}>
      {nodes.map((n) => (
        <TreeRow key={n.name} node={n} depth={depth} />
      ))}
    </div>
  );
}

function TreeRow({ node, depth }: { node: TreeNode; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  const has = node.children.length > 0;
  return (
    <div className={s.node}>
      <span className={s.nodeName}>
        {has ? (
          <button type="button" className={s.nodeToggle} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span style={{ width: 12 }} />
        )}
        {node.name}
        {node.required ? <span className={s.req}>•</span> : null}
        <span className={s.nodeType}>{node.type}</span>
      </span>
      <span className={s.nodeDesc}>
        {node.description ?? ""}
        {node.constraints ? <span className={s.muted}> · {node.constraints}</span> : null}
      </span>
      {has && open ? (
        <div className={s.nodeChildren}>
          <SchemaTreeView nodes={node.children} depth={depth + 1} />
        </div>
      ) : null}
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-07T23:41:09Z" → "Oct 7, 2026 23:41 UTC". Spelled out by hand so the server and the browser agree. */
export function stamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} ${hh}:${mm} UTC`;
}

export function ago(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

/** "3h 12m" from seconds. */
export function uptime(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
