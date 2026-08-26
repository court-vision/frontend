"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  isEmptyResult,
  isProviderAuthError,
  providerName,
  toApiError,
  userMessage,
} from "@/lib/api-error";
import { formatRelativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

interface QueryErrorStateProps {
  error: unknown;
  /** Usually the query's `refetch`. */
  onRetry?: () => void;
  /** True while the retry is in flight; disables the button and spins its icon. */
  isRetrying?: boolean;
  /** Dense variant for terminal panels, cards and dropdowns. */
  compact?: boolean;
  /** Copy when the error carries no usable message of its own. */
  fallback?: string;
  className?: string;
}

/**
 * The one way to render a failed query.
 *
 * Copy comes from `userMessage`; the correlation id is surfaced as `ref …` so
 * a user report can be joined to the backend request log; expired ESPN/Yahoo
 * credentials link to Manage Teams; and an `EMPTY_RESULT` (a success envelope
 * with no data) renders as a quiet empty state, never as an error.
 */
export function QueryErrorState({
  error,
  onRetry,
  isRetrying = false,
  compact = false,
  fallback,
  className,
}: QueryErrorStateProps) {
  const err = toApiError(error);

  if (isEmptyResult(err)) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center text-center",
          compact ? "gap-1 p-3" : "gap-2 p-8",
          className
        )}
      >
        <p className={cn("text-muted-foreground", compact ? "text-[10px]" : "text-sm")}>
          {err.message}
        </p>
      </div>
    );
  }

  const providerAuth = isProviderAuthError(err);
  const provider = providerName(err) ?? "league";
  const ref = err.correlationId ? err.correlationId.slice(0, 8) : null;
  const buttonClass = compact ? "h-6 px-2 text-[11px]" : undefined;

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-1.5 p-3" : "gap-3 p-6",
        className
      )}
    >
      <AlertCircle
        className={cn("shrink-0 text-destructive/60", compact ? "h-4 w-4" : "h-5 w-5")}
        aria-hidden="true"
      />
      <p className={cn("text-destructive", compact ? "text-[11px] leading-snug" : "text-sm")}>
        {userMessage(err, fallback)}
      </p>
      {(onRetry || providerAuth) && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {providerAuth && (
            <Button asChild variant="outline" size="sm" className={buttonClass}>
              <Link href="/manage-teams">Reconnect {provider}</Link>
            </Button>
          )}
          {onRetry && (
            <Button
              type="button"
              variant={providerAuth ? "ghost" : "outline"}
              size="sm"
              className={buttonClass}
              onClick={onRetry}
              disabled={isRetrying}
            >
              <RefreshCw className={cn(isRetrying && "animate-spin")} />
              Retry
            </Button>
          )}
        </div>
      )}
      {ref && (
        <span
          className={cn("font-mono text-muted-foreground/60", compact ? "text-[9px]" : "text-[10px]")}
          title={err.correlationId ?? undefined}
        >
          ref {ref}
        </span>
      )}
    </div>
  );
}

interface StaleBadgeProps {
  /** The query's `dataUpdatedAt` (0 before anything has loaded). */
  dataUpdatedAt: number;
  isFetching: boolean;
  /** The query's current `error` — set while the latest poll failed and stale data is on screen. */
  error: unknown;
  className?: string;
}

/**
 * Freshness marker for polling panels: "updated 12 s ago" while polls
 * succeed, "live updates paused — retrying" while the latest one failed.
 * The panel keeps rendering its last good data either way.
 */
export function StaleBadge({ dataUpdatedAt, isFetching, error, className }: StaleBadgeProps) {
  const now = useNow(10_000);
  const paused = error !== null && error !== undefined;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap font-mono text-[9px] tracking-wide",
        paused ? "text-status-projected" : "text-muted-foreground/60",
        className
      )}
      title={paused ? userMessage(error) : undefined}
      aria-live="polite"
    >
      <span
        className={cn(
          "h-1 w-1 shrink-0 rounded-full",
          paused
            ? "bg-status-projected animate-pulse"
            : isFetching
              ? "bg-signal-live animate-pulse"
              : "bg-signal-live/60"
        )}
      />
      {paused ? "live updates paused — retrying" : `updated ${formatRelativeTime(dataUpdatedAt, now)}`}
    </span>
  );
}

/** Re-renders every `intervalMs` so relative times stay honest. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
