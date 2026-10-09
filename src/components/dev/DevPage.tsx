"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { LayoutList, Search } from "lucide-react";
import { DeskBar, DeskStatus } from "@/components/desk/DeskBar";
import { useDeskTheme } from "@/components/desk/useDeskTheme";
import { API_BASE } from "@/endpoints";
import { getTodayDate } from "@/hooks/useGames";
import { useOpenApiQuery, useRawHealthQuery } from "@/hooks/useDev";
import { userMessage } from "@/lib/api-error";
import { publicOps, type ApiOp } from "@/lib/openapi";
import { GUIDES } from "./Guides";
import { KeysSheet } from "./Keys";
import { Overview } from "./Overview";
import { PlaygroundLedger, PlaygroundSheet } from "./Playground";
import { QueryLedger, QuerySheet, useCanvas } from "./Query";
import { GuideSheet, OpFinder, OpSheet, ReferenceLedger, type RefSelection } from "./Reference";
import { Skeleton } from "./blocks";
import { useDemoKeys, useDemoQuery, useLiveKeys, useLiveQuery, type KeysModel, type QueryModel } from "./useDevModels";
import { useDevStore, useSessionKey, type HistoryEntry } from "./useDevStore";
import { VIEWS, isView, nextView, type DevInitial, type DevView } from "./views";
import dk from "@/components/desk/desk.module.css";
import s from "./dev.module.css";

const KEYS: Array<[string, string]> = [
  ["[ ]", "view"],
  ["⌘K", "route"],
  ["⌘⏎", "send / run"],
  ["T", "theme"],
];

export function DevPage({ demo, initial }: { demo: boolean; initial: DevInitial }) {
  return demo ? <DemoDev initial={initial} /> : <LiveDev initial={initial} />;
}

function LiveDev({ initial }: { initial: DevInitial }) {
  return <DevDesk demo={false} initial={initial} keys={useLiveKeys()} query={useLiveQuery()} />;
}

function DemoDev({ initial }: { initial: DevInitial }) {
  return <DevDesk demo initial={initial} keys={useDemoKeys()} query={useDemoQuery()} />;
}

function DevDesk({ demo, initial, keys, query }: { demo: boolean; initial: DevInitial; keys: KeysModel; query: QueryModel }) {
  const pathname = usePathname();
  const [view, setViewState] = useState<DevView>(initial.view);
  const [opId, setOpId] = useState<string | null>(initial.op);
  const [guideId, setGuideId] = useState<string | null>(initial.guide);
  const [replayed, setReplayed] = useState<HistoryEntry | null>(null);
  const [finderOpen, setFinderOpen] = useState(false);
  const [pane, setPane] = useState<"list" | "sheet">(initial.op || initial.guide ? "sheet" : "list");
  const [today] = useState(() => getTodayDate());
  const sheet = useRef<HTMLElement>(null);
  const toggleTheme = useDeskTheme((st) => st.toggle);
  const loadKey = useSessionKey((st) => st.load);
  useEffect(() => {
    void useDevStore.persist?.rehydrate();
    loadKey();
  }, [loadKey]);

  const spec = useOpenApiQuery();
  const ops = useMemo(() => (spec.data ? publicOps(spec.data) : []), [spec.data]);
  const health = useRawHealthQuery();
  const [canvas, setCanvas, addToCanvas] = useCanvas();

  // ---- URL

  const sync = useCallback(
    (next: { view: DevView; op: string | null; guide: string | null }, mode: "push" | "replace") => {
      const q = new URLSearchParams();
      if (next.view !== "overview") q.set("view", next.view);
      if (next.op && (next.view === "reference" || next.view === "playground")) q.set("op", next.op);
      if (next.guide && next.view === "reference") q.set("g", next.guide);
      if (demo) q.set("demo", "");
      const qs = q.toString().replace(/=(&|$)/g, "$1");
      const url = `${pathname}${qs ? `?${qs}` : ""}`;
      if (`${window.location.pathname}${window.location.search}` === url) return;
      if (mode === "push") window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [pathname, demo]
  );

  const go = useCallback(
    (next: DevView, extra?: { op?: string | null; guide?: string | null }) => {
      const op = extra?.op === undefined ? opId : extra.op;
      const guide = extra?.guide === undefined ? guideId : extra.guide;
      setViewState(next);
      if (extra?.op !== undefined) setOpId(extra.op);
      if (extra?.guide !== undefined) setGuideId(extra.guide);
      sync({ view: next, op, guide }, "push");
    },
    [opId, guideId, sync]
  );

  useEffect(() => {
    const onPop = () => {
      const p = new URLSearchParams(window.location.search);
      setViewState(isView(p.get("view")) ? (p.get("view") as DevView) : "overview");
      setOpId(p.get("op"));
      setGuideId(p.get("g"));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    sheet.current?.scrollTo({ top: 0 });
  }, [view, opId, guideId]);

  // ---- keys

  const latest = useRef({ view, finderOpen });
  latest.current = { view, finderOpen };
  useEffect(() => {
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
    };
    const onKey = (e: KeyboardEvent) => {
      const L = latest.current;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setFinderOpen(true);
        return;
      }
      if (L.finderOpen || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      if (e.key === "[") go(nextView(L.view, -1));
      else if (e.key === "]") go(nextView(L.view, 1));
      else if (e.key === "t" || e.key === "T") toggleTheme();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, toggleTheme]);

  // ---- selections

  const op = useMemo(() => ops.find((o) => o.id === opId) ?? null, [ops, opId]);
  const selection: RefSelection | null = guideId ? { kind: "guide", id: guideId } : opId ? { kind: "op", id: opId } : null;
  const selectRef = (sel: RefSelection) => {
    setPane("sheet");
    if (sel.kind === "guide") go("reference", { guide: sel.id, op: null });
    else go("reference", { op: sel.id, guide: null });
  };
  const pickOp = (o: ApiOp) => {
    setReplayed(null);
    setPane("sheet");
    go(view === "reference" ? "reference" : "playground", { op: o.id, guide: null });
  };
  const tryIt = (o: ApiOp) => {
    setReplayed(null);
    setPane("sheet");
    go("playground", { op: o.id, guide: null });
  };
  const replay = (h: HistoryEntry) => {
    setReplayed(h);
    setPane("sheet");
    if (h.opId) go("playground", { op: h.opId, guide: null });
  };

  const context =
    view === "overview" ? "Overview" : view === "reference" ? (selection?.kind === "guide" ? GUIDES.find((g) => g.id === selection.id)?.title ?? "Reference" : op ? `${op.method} ${op.path}` : "Reference") : view === "playground" ? (op ? `${op.method} ${op.path}` : "Playground") : view === "keys" ? "Keys" : "Query";
  const hasLedger = view === "reference" || view === "playground" || view === "query";
  const healthState = health.isError ? "down" : !health.data ? "unknown" : health.data.status === "ok" ? "ok" : "degraded";

  return (
    <>
      <DeskBar
        desk="developer"
        demo={demo}
        onRefresh={() => {
          void spec.refetch();
          void health.refetch();
          query.reloadSchema();
        }}
        right={
          <span className={s.baseChip} title={`${API_BASE} · ${healthState}`}>
            <span className={s.dot} data-state={healthState} />
            {API_BASE.replace(/^https?:\/\//, "")}
          </span>
        }
      >
        <span className={dk.label} style={{ color: "var(--text-2)", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis" }}>
          Developer · {context}
        </span>
      </DeskBar>

      <div className={s.toolbar}>
        <button type="button" className={`${dk.btn} ${dk.btnSmall} ${s.listToggle}`} onClick={() => setPane((p) => (p === "list" ? "sheet" : "list"))} disabled={!hasLedger}>
          <LayoutList size={13} />
          {pane === "list" ? "Sheet" : "List"}
        </button>
        <div className={dk.rail} role="radiogroup" aria-label="View">
          {VIEWS.map((v) => {
            const on = view === v.id;
            return (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={on}
                className={`${dk.seg} ${on ? dk.segOn : ""}`}
                onClick={() => {
                  setPane(v.id === "reference" || v.id === "playground" ? (opId || guideId ? "sheet" : "list") : v.id === "query" ? "list" : "sheet");
                  go(v.id);
                }}
                title={v.title}
              >
                {on ? <motion.span layoutId="dev-view-pill" className={dk.segPill} transition={{ type: "spring", stiffness: 600, damping: 45 }} /> : null}
                <span className={dk.segLabel}>{v.label}</span>
              </button>
            );
          })}
        </div>
        <span className={dk.kbd}>[ ]</span>
        <span className={dk.divider} />
        <button type="button" className={dk.btn} onClick={() => setFinderOpen(true)} disabled={ops.length === 0} title="Find a route (⌘K)">
          <Search size={13} />
          Find a route
          <span className={dk.kbd}>⌘K</span>
        </button>
        <span className={dk.spacer} />
        {spec.isError ? <span className={dk.error}>Couldn&apos;t read the API&apos;s OpenAPI document: {userMessage(spec.error, "unreachable")}</span> : null}
      </div>

      <div className={`${s.body} ${hasLedger ? "" : s.bodyWide} ${dk.desk}`} data-pane={pane}>
        {hasLedger ? (
          <aside className={s.ledger}>
            {view === "reference" ? (
              <ReferenceLedger ops={ops} selected={selection} select={selectRef} loading={spec.isLoading} />
            ) : view === "playground" ? (
              <PlaygroundLedger ops={ops} opId={opId} pick={pickOp} replay={replay} />
            ) : (
              <QueryLedger model={query} canvas={canvas} add={(t) => { addToCanvas(t); setPane("sheet"); }} />
            )}
          </aside>
        ) : null}
        <main ref={sheet} className={s.sheet} tabIndex={-1}>
          {view === "overview" ? (
            <Overview health={health.data} healthError={health.isError} opCount={ops.length || null} keyCount={keys.signedIn ? keys.keys.length : null} signedIn={keys.signedIn} demo={demo} go={(v) => go(v)} />
          ) : view === "reference" ? (
            selection?.kind === "guide" ? (
              <GuideSheet guide={GUIDES.find((g) => g.id === selection.id) ?? GUIDES[0]} openGuide={(id) => selectRef({ kind: "guide", id })} />
            ) : op && spec.data ? (
              <OpSheet doc={spec.data} op={op} base={API_BASE} today={today} tryIt={tryIt} />
            ) : spec.isLoading ? (
              <Skeleton rows={8} />
            ) : (
              <GuideSheet guide={GUIDES[0]} openGuide={(id) => selectRef({ kind: "guide", id })} />
            )
          ) : view === "playground" ? (
            spec.data ? (
              <PlaygroundSheet doc={spec.data} op={op} base={API_BASE} today={today} replayed={replayed} />
            ) : (
              <Skeleton rows={8} />
            )
          ) : view === "keys" ? (
            <KeysSheet model={keys} openPlayground={() => go("playground")} />
          ) : (
            <QuerySheet model={query} canvas={canvas} setCanvas={setCanvas} />
          )}
        </main>
      </div>

      <DeskStatus keys={KEYS}>
        {spec.data?.info ? (
          <span>
            {spec.data.info.title ?? "API"} {spec.data.info.version ?? ""} · {ops.length} public routes
          </span>
        ) : null}
        {health.data?.version ? <span>backend {health.data.version}</span> : null}
      </DeskStatus>

      <OpFinder open={finderOpen} onOpenChange={setFinderOpen} ops={ops} onPick={pickOp} />
    </>
  );
}
