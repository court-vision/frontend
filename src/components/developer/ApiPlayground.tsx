"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Eye,
  EyeOff,
  Send,
  Loader2,
  Copy,
  Check,
  ChevronDown,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE, allEndpoints } from "./api-data";
import type { Endpoint, Param } from "./api-data";
import { highlightJson, MethodBadge } from "./api-utils";

// ─── Helpers ──────────────────────────────────────────────

function getPathParams(endpoint: Endpoint): Param[] {
  return endpoint.params.filter((p) => endpoint.path.includes(`{${p.name}}`));
}

function getQueryParams(endpoint: Endpoint): Param[] {
  return endpoint.params.filter((p) => !endpoint.path.includes(`{${p.name}}`));
}

function coerceValue(value: string, type: string): unknown {
  if (type === "integer" || type === "number") {
    const n = Number(value);
    return isNaN(n) ? value : n;
  }
  if (type === "boolean") {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  }
  return value;
}

function buildDefaultBody(params: Param[]): string {
  const obj: Record<string, unknown> = {};
  for (const p of params) {
    if (p.type === "integer" || p.type === "number") {
      obj[p.name] = p.required ? 0 : undefined;
    } else if (p.type === "boolean") {
      obj[p.name] = false;
    } else {
      obj[p.name] = p.required ? "" : undefined;
    }
  }
  // Remove undefined
  const clean = Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  );
  return JSON.stringify(clean, null, 2);
}

// ─── Endpoint Selector ────────────────────────────────────

function EndpointSelector({
  selected,
  onSelect,
}: {
  selected: Endpoint | null;
  onSelect: (ep: Endpoint) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = allEndpoints.filter((ep) => {
    const q = query.toLowerCase();
    return (
      ep.path.toLowerCase().includes(q) ||
      ep.description.toLowerCase().includes(q)
    );
  });

  const handleSelect = (ep: Endpoint) => {
    onSelect(ep);
    setQuery("");
    setOpen(false);
  };

  const handleClear = () => {
    setQuery("");
    onSelect(null as unknown as Endpoint);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative">
      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">
        Endpoint
      </p>
      <div className="flex items-center rounded-md border border-border/60 bg-card/40 overflow-hidden focus-within:ring-1 focus-within:ring-ring">
        {/* Method badge */}
        {selected && (
          <div className="pl-2.5 shrink-0">
            <MethodBadge method={selected.method} />
          </div>
        )}

        {/* Non-editable prefix */}
        <span className="pl-2.5 text-[11px] font-mono text-muted-foreground/50 shrink-0 select-none">
          {API_BASE}
        </span>

        {/* Input */}
        <input
          ref={inputRef}
          value={selected && !open ? selected.path : query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (selected) setQuery("");
            setOpen(true);
          }}
          placeholder="/players/"
          className="flex-1 min-w-0 bg-transparent text-[11px] font-mono text-foreground px-1 py-2 outline-none placeholder:text-muted-foreground/30"
        />

        {/* Clear / chevron */}
        {selected ? (
          <button
            onClick={handleClear}
            className="px-2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        ) : (
          <div className="px-2 text-muted-foreground/30">
            <ChevronDown className="h-3 w-3" />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-md border border-border/60 bg-card shadow-xl">
          <div className="max-h-64 overflow-y-auto overscroll-contain">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-[11px] text-muted-foreground/50 font-mono">
                No matching endpoints
              </div>
            ) : (
              <div className="py-1">
                {filtered.map((ep) => (
                  <button
                    key={`${ep.method}-${ep.path}`}
                    onClick={() => handleSelect(ep)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors",
                      "hover:bg-muted/50",
                      selected?.path === ep.path &&
                        selected?.method === ep.method &&
                        "bg-primary/5"
                    )}
                  >
                    <MethodBadge method={ep.method} />
                    <code className="font-mono text-[11px] text-foreground shrink-0">
                      {ep.path}
                    </code>
                    <span className="text-[10px] text-muted-foreground/50 truncate ml-auto">
                      {ep.description.length > 50
                        ? ep.description.slice(0, 50) + "..."
                        : ep.description}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Auth Input ───────────────────────────────────────────

function AuthInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">
        Authentication
      </p>
      <div className="flex items-center gap-2 rounded-md border border-border/60 bg-card/40 px-2.5 focus-within:ring-1 focus-within:ring-ring">
        <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0 select-none">
          X-API-Key
        </span>
        <div className="w-px h-4 bg-border/40" />
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="cv_your_key_here"
          className="flex-1 min-w-0 bg-transparent text-[11px] font-mono text-foreground py-2 outline-none placeholder:text-muted-foreground/30"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        >
          {visible ? (
            <EyeOff className="h-3 w-3" />
          ) : (
            <Eye className="h-3 w-3" />
          )}
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground/40 mt-1">
        Optional for public endpoints. Required for analytics endpoints.
      </p>
    </div>
  );
}

// ─── Parameter Editor ─────────────────────────────────────

function ParameterEditor({
  endpoint,
  values,
  onChange,
  body,
  onBodyChange,
}: {
  endpoint: Endpoint;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  body: string;
  onBodyChange: (v: string) => void;
}) {
  const pathParams = getPathParams(endpoint);
  const queryParams = getQueryParams(endpoint);
  const isPost = endpoint.method === "POST";

  if (endpoint.params.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
        Parameters
      </p>

      {/* Path parameters */}
      {pathParams.length > 0 && (
        <div className="rounded-md border border-border/60 overflow-hidden">
          <div className="px-3 py-1.5 bg-muted/30 border-b border-border/60">
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
              Path Parameters
            </span>
          </div>
          <div className="divide-y divide-border/30">
            {pathParams.map((p) => (
              <ParamRow
                key={p.name}
                param={p}
                value={values[p.name] ?? ""}
                onChange={(v) => onChange(p.name, v)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Query parameters (GET) or JSON body (POST) */}
      {isPost ? (
        <div className="rounded-md border border-border/60 overflow-hidden">
          <div className="px-3 py-1.5 bg-muted/30 border-b border-border/60 flex items-center justify-between">
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
              Request Body
            </span>
            <span className="text-[9px] font-mono text-muted-foreground/40">
              application/json
            </span>
          </div>
          <div className="relative">
            <textarea
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              rows={Math.min(Math.max(body.split("\n").length, 4), 16)}
              className="w-full bg-[hsl(var(--card)/0.3)] text-[11px] font-mono text-foreground p-3 outline-none resize-y min-h-[100px] placeholder:text-muted-foreground/30"
              spellCheck={false}
            />
          </div>
        </div>
      ) : (
        queryParams.length > 0 && (
          <div className="rounded-md border border-border/60 overflow-hidden">
            <div className="px-3 py-1.5 bg-muted/30 border-b border-border/60">
              <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
                Query Parameters
              </span>
            </div>
            <div className="divide-y divide-border/30">
              {queryParams.map((p) => (
                <ParamRow
                  key={p.name}
                  param={p}
                  value={values[p.name] ?? ""}
                  onChange={(v) => onChange(p.name, v)}
                />
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}

function ParamRow({
  param,
  value,
  onChange,
}: {
  param: Param;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="flex items-center gap-1.5 shrink-0 w-32">
        <code className="font-mono text-[11px] text-sky-400">{param.name}</code>
        {param.required && (
          <span className="text-[8px] text-amber-400 font-bold">*</span>
        )}
      </div>
      <span className="text-[9px] font-mono text-muted-foreground/40 shrink-0 w-14">
        {param.type}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={param.description.length > 40 ? param.description.slice(0, 40) + "..." : param.description}
        className="flex-1 min-w-0 bg-muted/20 border border-border/40 rounded px-2 py-1 text-[11px] font-mono text-foreground outline-none focus:border-primary/40 focus:bg-muted/30 transition-colors placeholder:text-muted-foreground/25"
        spellCheck={false}
      />
    </div>
  );
}

// ─── Response Viewer ──────────────────────────────────────

interface ApiResponse {
  status: number;
  statusText: string;
  body: string;
  duration: number;
}

function ResponseViewer({
  response,
  error,
  isLoading,
}: {
  response: ApiResponse | null;
  error: string | null;
  isLoading: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!response) return;
    await navigator.clipboard.writeText(response.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (isLoading) {
    return (
      <div className="rounded-md border border-border/60 overflow-hidden">
        <div className="px-3 py-1.5 bg-muted/30 border-b border-border/60">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            Response
          </span>
        </div>
        <div className="flex items-center justify-center gap-2 py-12 bg-[hsl(var(--card)/0.3)]">
          <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
          <span className="text-[11px] font-mono text-muted-foreground">
            Sending request...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-500/30 overflow-hidden">
        <div className="px-3 py-1.5 bg-red-500/10 border-b border-red-500/20">
          <span className="text-[10px] font-mono text-red-400 uppercase tracking-wider">
            Error
          </span>
        </div>
        <div className="p-3 bg-[hsl(var(--card)/0.3)]">
          <p className="text-[11px] font-mono text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!response) return null;

  const statusColor =
    response.status >= 200 && response.status < 300
      ? "text-emerald-400"
      : response.status >= 400 && response.status < 500
        ? "text-amber-400"
        : "text-red-400";

  const statusBg =
    response.status >= 200 && response.status < 300
      ? "bg-emerald-500/10 border-emerald-500/20"
      : response.status >= 400 && response.status < 500
        ? "bg-amber-500/10 border-amber-500/20"
        : "bg-red-500/10 border-red-500/20";

  return (
    <div className="rounded-md border border-border/60 overflow-hidden">
      {/* Status bar */}
      <div className="px-3 py-1.5 bg-muted/30 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            Response
          </span>
          <span
            className={cn(
              "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono border",
              statusBg,
              statusColor
            )}
          >
            {response.status} {response.statusText}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground/50">
            {response.duration}ms
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-400" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {/* Body */}
      <div className="max-h-[500px] overflow-y-auto overscroll-contain">
        <div className="p-3 bg-[hsl(var(--card)/0.3)] overflow-x-auto">
          <pre className="font-mono text-[11px]">
            <code>{highlightJson(response.body)}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────

export function ApiPlayground({
  initialEndpoint,
}: {
  initialEndpoint?: Endpoint;
}) {
  const [selected, setSelected] = useState<Endpoint | null>(
    initialEndpoint ?? null
  );
  const [apiKey, setApiKey] = useState("");
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [body, setBody] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync initialEndpoint changes (from "Try it" button)
  useEffect(() => {
    if (initialEndpoint) {
      setSelected(initialEndpoint);
      setParamValues({});
      setBody(
        initialEndpoint.method === "POST"
          ? buildDefaultBody(
              getQueryParams(initialEndpoint)
            )
          : ""
      );
      setResponse(null);
      setError(null);
    }
  }, [initialEndpoint]);

  const handleSelectEndpoint = useCallback((ep: Endpoint) => {
    setSelected(ep);
    setParamValues({});
    setBody(
      ep?.method === "POST"
        ? buildDefaultBody(getQueryParams(ep))
        : ""
    );
    setResponse(null);
    setError(null);
  }, []);

  const handleParamChange = useCallback((key: string, value: string) => {
    setParamValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSend = async () => {
    if (!selected) return;

    setIsLoading(true);
    setResponse(null);
    setError(null);

    try {
      // Build URL with path params
      let path = selected.path;
      for (const p of getPathParams(selected)) {
        const val = paramValues[p.name];
        if (!val && p.required) {
          setError(`Missing required path parameter: ${p.name}`);
          setIsLoading(false);
          return;
        }
        path = path.replace(`{${p.name}}`, encodeURIComponent(val || ""));
      }

      let url = `${API_BASE}${path}`;

      // Build query string for GET
      if (selected.method === "GET") {
        const queryParams = getQueryParams(selected);
        const searchParams = new URLSearchParams();
        for (const p of queryParams) {
          const val = paramValues[p.name];
          if (val) {
            searchParams.set(p.name, val);
          }
        }
        const qs = searchParams.toString();
        if (qs) url += (url.includes("?") ? "&" : "?") + qs;
      }

      // Build headers
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers["X-API-Key"] = apiKey;
      }

      // Build request options
      const options: RequestInit = {
        method: selected.method,
        headers,
      };

      // POST body
      if (selected.method === "POST") {
        headers["Content-Type"] = "application/json";
        try {
          // Parse and re-serialize to validate JSON
          const parsed = JSON.parse(body);
          options.body = JSON.stringify(parsed);
        } catch {
          setError("Invalid JSON in request body");
          setIsLoading(false);
          return;
        }
      }

      const start = performance.now();
      const res = await fetch(url, options);
      const duration = Math.round(performance.now() - start);

      const text = await res.text();
      let formatted: string;
      try {
        formatted = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        formatted = text;
      }

      setResponse({
        status: res.status,
        statusText: res.statusText,
        body: formatted,
        duration,
      });
    } catch (err) {
      if (err instanceof TypeError && (err.message.includes("fetch") || err.message.includes("network") || err.message.includes("CORS"))) {
        setError(
          "Network error — the API may be unreachable or blocked by CORS. Try using an API key for higher rate limits."
        );
      } else {
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred"
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Constructed URL preview
  const previewUrl = (() => {
    if (!selected) return null;
    let path = selected.path;
    for (const p of getPathParams(selected)) {
      const val = paramValues[p.name];
      path = path.replace(
        `{${p.name}}`,
        val ? encodeURIComponent(val) : `{${p.name}}`
      );
    }
    let url = `${API_BASE}${path}`;
    if (selected.method === "GET") {
      const parts: string[] = [];
      for (const p of getQueryParams(selected)) {
        const val = paramValues[p.name];
        if (val) parts.push(`${p.name}=${encodeURIComponent(val)}`);
      }
      if (parts.length) url += "?" + parts.join("&");
    }
    return url;
  })();

  const hasResponse = response !== null || error !== null || isLoading;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Zap className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-sm font-semibold tracking-tight">API Playground</h2>
        <span className="text-[10px] text-muted-foreground/50 font-mono">
          {allEndpoints.length} endpoints
        </span>
      </div>

      {/* Two-column layout on xl, stacked on smaller */}
      <div className={cn(
        "gap-5",
        hasResponse ? "xl:flex xl:items-start" : "",
      )}>
        {/* Left: request builder */}
        <div className={cn(
          "space-y-4",
          hasResponse ? "xl:flex-1 xl:min-w-0" : "max-w-3xl",
        )}>
          {/* Endpoint selector */}
          <EndpointSelector selected={selected} onSelect={handleSelectEndpoint} />

          {/* Auth */}
          <AuthInput value={apiKey} onChange={setApiKey} />

          {/* Parameters */}
          {selected && (
            <ParameterEditor
              endpoint={selected}
              values={paramValues}
              onChange={handleParamChange}
              body={body}
              onBodyChange={setBody}
            />
          )}

          {/* URL preview + Send */}
          {selected && (
            <div className="space-y-2">
              {/* URL preview */}
              {previewUrl && (
                <div className="rounded-md border border-border/40 bg-muted/10 px-3 py-1.5 overflow-x-auto">
                  <code className="text-[10px] font-mono text-muted-foreground/60 break-all">
                    <span className="text-muted-foreground/40">
                      {selected.method}{" "}
                    </span>
                    {previewUrl}
                  </code>
                </div>
              )}

              {/* Send button */}
              <Button
                onClick={handleSend}
                disabled={isLoading || !selected}
                className="w-full"
                variant="glow"
                size="default"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {isLoading ? "Sending..." : "Send Request"}
              </Button>
            </div>
          )}
        </div>

        {/* Right: response (side-by-side on xl, below on smaller) */}
        {hasResponse && (
          <div className="xl:flex-1 xl:min-w-0 xl:sticky xl:top-4 mt-4 xl:mt-0">
            <ResponseViewer
              response={response}
              error={error}
              isLoading={isLoading}
            />
          </div>
        )}
      </div>
    </div>
  );
}
