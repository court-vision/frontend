"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { categories, API_BASE } from "./api-data";
import type { Endpoint, CodeExample } from "./api-data";
import { highlightJson, MethodBadge } from "./api-utils";

// ─── Syntax highlighting (code-specific, only used in docs) ──

function highlightCode(code: string, lang: "curl" | "python" | "typescript"): React.ReactNode[] {
  const lines = code.split("\n");
  return lines.map((line, i) => {
    const parts: React.ReactNode[] = [];
    let key = 0;
    let lastIndex = 0;

    // Comments
    if (line.trimStart().startsWith("#") || line.trimStart().startsWith("//")) {
      return (
        <div key={i} className="leading-relaxed text-muted-foreground/60">{line}</div>
      );
    }

    // Keywords pattern based on language
    let regex: RegExp;
    if (lang === "python") {
      regex = /("(?:\\"|[^"])*"|'(?:\\'|[^'])*')|\b(import|from|def|return|class|if|else|for|in|as|True|False|None)\b/g;
    } else if (lang === "typescript") {
      regex = /("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|`(?:\\`|[^`])*`)|\b(const|let|var|await|async|function|return|import|from|new|typeof)\b/g;
    } else {
      // curl
      regex = /("(?:\\"|[^"])*"|'(?:\\'|[^'])*')|\b(curl)\b|(-[XHGF]|--\w[\w-]*)/g;
    }

    let match: RegExpExecArray | null;
    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={key++}>{line.slice(lastIndex, match.index)}</span>);
      }

      if (match[1]) {
        // String
        parts.push(<span key={key++} className="text-emerald-400">{match[1]}</span>);
      } else if (match[2]) {
        // Keyword
        parts.push(<span key={key++} className="text-violet-400">{match[2]}</span>);
      } else if (match[3]) {
        // Flag (curl)
        parts.push(<span key={key++} className="text-sky-400">{match[3]}</span>);
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < line.length) {
      parts.push(<span key={key++}>{line.slice(lastIndex)}</span>);
    }

    return (
      <div key={i} className="leading-relaxed">
        {parts.length > 0 ? parts : line}
      </div>
    );
  });
}

// ─── Sub-components ────────────────────────────────────────

function CodeTabs({ code }: { code: CodeExample; id: string }) {
  const [tab, setTab] = useState<"curl" | "python" | "typescript">("curl");
  const tabs = [
    { key: "curl" as const, label: "cURL" },
    { key: "python" as const, label: "Python" },
    { key: "typescript" as const, label: "TypeScript" },
  ];

  return (
    <div className="rounded-md border border-border/60 overflow-hidden">
      <div className="flex items-center border-b border-border/60 bg-muted/30">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3 py-1.5 text-[10px] font-medium font-mono transition-colors",
              tab === t.key
                ? "text-primary bg-background border-b-2 border-primary -mb-px"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-3 bg-[hsl(var(--card)/0.3)] overflow-x-auto">
        <pre className="font-mono text-[11px] leading-relaxed">
          <code>{highlightCode(code[tab], tab)}</code>
        </pre>
      </div>
    </div>
  );
}

function CollapsibleResponse({ response }: { response: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md border border-border/60 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Response Example
      </button>
      {open && (
        <div className="p-3 bg-[hsl(var(--card)/0.3)] overflow-x-auto border-t border-border/60">
          <pre className="font-mono text-[11px]">
            <code>{highlightJson(response)}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

function EndpointCard({
  endpoint,
  onTryInPlayground,
}: {
  endpoint: Endpoint;
  onTryInPlayground?: (endpoint: Endpoint) => void;
}) {
  return (
    <div className="space-y-3 pb-5 border-b border-border/30 last:border-0 last:pb-0">
      {/* Method + path + description */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <MethodBadge method={endpoint.method} />
          <code className="font-mono text-sm text-foreground">{endpoint.path}</code>
          {onTryInPlayground && (
            <button
              onClick={() => onTryInPlayground(endpoint)}
              className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <Play className="h-2.5 w-2.5" />
              Try it
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{endpoint.description}</p>
      </div>

      {/* Parameters table */}
      {endpoint.params.length > 0 && (
        <div className="rounded-md border border-border/60 overflow-hidden">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-muted/30 border-b border-border/60">
                <th className="text-left px-3 py-1.5 font-medium text-muted-foreground uppercase tracking-wider text-[9px]">Parameter</th>
                <th className="text-left px-3 py-1.5 font-medium text-muted-foreground uppercase tracking-wider text-[9px]">Type</th>
                <th className="text-left px-3 py-1.5 font-medium text-muted-foreground uppercase tracking-wider text-[9px]">Required</th>
                <th className="text-left px-3 py-1.5 font-medium text-muted-foreground uppercase tracking-wider text-[9px]">Description</th>
              </tr>
            </thead>
            <tbody>
              {endpoint.params.map((p) => (
                <tr key={p.name} className="border-b border-border/30 last:border-0">
                  <td className="px-3 py-1.5 font-mono text-sky-400">{p.name}</td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">{p.type}</td>
                  <td className="px-3 py-1.5">
                    {p.required ? (
                      <span className="text-amber-400 font-medium">Yes</span>
                    ) : (
                      <span className="text-muted-foreground/50">No</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">{p.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Code examples */}
      <CodeTabs code={endpoint.code} id={endpoint.path} />

      {/* Response */}
      <CollapsibleResponse response={endpoint.response} />
    </div>
  );
}

function CategorySection({
  category,
  onTryInPlayground,
}: {
  category: (typeof categories)[number];
  onTryInPlayground?: (endpoint: Endpoint) => void;
}) {
  return (
    <section id={`section-${category.id}`} className="scroll-mt-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold tracking-tight">{category.label}</h3>
        <span className="text-[10px] text-muted-foreground/50 font-mono">
          {category.endpoints.length} endpoint{category.endpoints.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-5">
        {category.endpoints.map((ep) => (
          <EndpointCard
            key={`${ep.method}-${ep.path}`}
            endpoint={ep}
            onTryInPlayground={onTryInPlayground}
          />
        ))}
      </div>
    </section>
  );
}

// ─── Main Component ────────────────────────────────────────

const SCROLL_OFFSET = 56; // 44px header (h-11) + 12px breathing room

export function ApiDocs({
  onTryInPlayground,
}: {
  onTryInPlayground?: (endpoint: Endpoint) => void;
}) {
  const [activeSection, setActiveSection] = useState(categories[0].id);
  const contentRef = useRef<HTMLDivElement>(null);

  const getScrollContainer = () => {
    const container = contentRef.current?.closest("main");
    return container instanceof HTMLElement ? container : null;
  };

  const getSectionElement = (id: string) =>
    contentRef.current?.querySelector<HTMLElement>(`#section-${id}`) ?? null;

  const scrollToSection = (id: string) => {
    const el = getSectionElement(id);
    if (!el) return;

    const main = getScrollContainer();
    if (main) {
      const top =
        el.getBoundingClientRect().top -
        main.getBoundingClientRect().top +
        main.scrollTop -
        SCROLL_OFFSET;
      main.scrollTo({ top, behavior: "smooth" });
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (window.location.hash !== `#section-${id}`) {
      window.history.replaceState(null, "", `#section-${id}`);
    }
  };

  // Observe which section is currently in view
  useEffect(() => {
    const main = getScrollContainer();
    const sections = contentRef.current?.querySelectorAll("[id^='section-']");
    if (!sections?.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id.replace("section-", "");
            setActiveSection(id);
          }
        }
      },
      { root: main ?? null, rootMargin: "-20% 0px -70% 0px" }
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#section-")) return;
    const id = hash.replace("#section-", "");
    requestAnimationFrame(() => {
      const el = getSectionElement(id);
      if (!el) return;

      const main = getScrollContainer();
      if (main) {
        const top =
          el.getBoundingClientRect().top -
          main.getBoundingClientRect().top +
          main.scrollTop -
          SCROLL_OFFSET;
        main.scrollTo({ top, behavior: "smooth" });
      } else {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }, []);

  return (
    <div className="flex gap-6 items-start">
      {/* Sidebar nav - desktop only */}
      <nav className="hidden lg:block shrink-0 w-36 sticky top-4 space-y-3">
        <div className="space-y-0.5">
          <p className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest mb-2">Endpoints</p>
          {categories.map((cat) => (
            <a
              key={cat.id}
              href={`#section-${cat.id}`}
              onClick={(e) => {
                e.preventDefault();
                scrollToSection(cat.id);
              }}
              className={cn(
                "block px-2 py-1 rounded text-[11px] font-medium transition-colors",
                activeSection === cat.id
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {cat.label}
              <span className="ml-1 text-[9px] text-muted-foreground/40 font-mono">
                {cat.endpoints.length}
              </span>
            </a>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <div ref={contentRef} className="flex-1 min-w-0 space-y-8">
        {/* Overview */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight mb-1">API Reference</h2>
            <p className="text-xs text-muted-foreground">
              The Court Vision API provides programmatic access to fantasy basketball data including player stats, rankings, live scores, and lineup optimization.
            </p>
          </div>

          {/* Base URL */}
          <div className="rounded-md border border-border/60 p-3 bg-card/40 space-y-2.5">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider w-20 shrink-0">Base URL</span>
              <code className="font-mono text-xs text-primary">{API_BASE}</code>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider w-20 shrink-0">Auth</span>
              <code className="font-mono text-xs text-foreground">X-API-Key: cv_xxxxxx</code>
              <span className="text-[10px] text-muted-foreground">header (optional for public endpoints)</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider w-20 shrink-0">Rate Limits</span>
              <div className="text-xs space-y-0.5">
                <div className="flex items-center gap-2">
                  <Badge variant="neutral" className="text-[9px] px-1 py-0">No key</Badge>
                  <span className="font-mono text-muted-foreground">100 req/min</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="text-[9px] px-1 py-0">With key</Badge>
                  <span className="font-mono text-foreground">1,000 req/min</span>
                </div>
              </div>
            </div>
          </div>

          {/* Response format */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Response Format</p>
            <div className="rounded-md border border-border/60 p-3 bg-[hsl(var(--card)/0.3)] overflow-x-auto">
              <pre className="font-mono text-[11px]">
                <code>
                  {highlightJson(`{
  "status": "success",
  "message": "Description of the result",
  "data": { ... }
}`)}
                </code>
              </pre>
            </div>
            <p className="text-[10px] text-muted-foreground">
              All responses follow the <code className="font-mono text-[10px] text-foreground bg-muted/50 px-1 rounded">BaseApiResponse</code> schema. Errors return <code className="font-mono text-[10px] text-foreground bg-muted/50 px-1 rounded">status: &quot;error&quot;</code> with a descriptive message.
            </p>
          </div>
        </section>

        {/* Endpoint categories */}
        {categories.map((cat) => (
          <CategorySection
            key={cat.id}
            category={cat}
            onTryInPlayground={onTryInPlayground}
          />
        ))}
      </div>
    </div>
  );
}
