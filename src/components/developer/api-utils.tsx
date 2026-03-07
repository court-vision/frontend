import React from "react";
import { cn } from "@/lib/utils";

// ─── JSON Syntax Highlighting ─────────────────────────────

export function highlightJson(json: string): React.ReactNode[] {
  const lines = json.split("\n");
  return lines.map((line, i) => {
    const parts: React.ReactNode[] = [];
    let key = 0;

    const regex = /("(?:\\"|[^"])*")\s*(:?)|\b(true|false|null)\b|(-?\d+\.?\d*)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={key++}>{line.slice(lastIndex, match.index)}</span>);
      }

      if (match[1] && match[2]) {
        parts.push(<span key={key++} className="text-sky-400">{match[1]}</span>);
        parts.push(<span key={key++}>{match[2]}</span>);
      } else if (match[1]) {
        parts.push(<span key={key++} className="text-emerald-400">{match[1]}</span>);
      } else if (match[3]) {
        parts.push(<span key={key++} className="text-amber-400">{match[3]}</span>);
      } else if (match[4]) {
        parts.push(<span key={key++} className="text-violet-400">{match[4]}</span>);
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

// ─── Method Badge ─────────────────────────────────────────

export function MethodBadge({ method }: { method: "GET" | "POST" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider uppercase",
        method === "GET"
          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
          : "bg-amber-500/15 text-amber-400 border border-amber-500/25"
      )}
    >
      {method}
    </span>
  );
}
