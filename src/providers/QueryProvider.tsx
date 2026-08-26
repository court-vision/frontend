"use client";

import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import * as Sentry from "@sentry/nextjs";
import { toast } from "sonner";
import { useState } from "react";
import { ApiError, isEmptyResult, toApiError, userMessage } from "@/lib/api-error";

const SIGN_IN_URL = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? "/sign-in";

/**
 * One toast per failure kind (sonner dedupes on `id`). Opt out per query or
 * mutation with `meta: { toast: false }` when the UI reports the error itself.
 */
function notifyError(error: unknown) {
  const err = toApiError(error);
  if (isEmptyResult(err)) return; // an empty state, not a failure
  const id = err.code ?? err.kind;
  if (err.kind === "auth") {
    toast.error(userMessage(err), {
      id,
      action: {
        label: "Sign in",
        onClick: () => {
          const redirect = encodeURIComponent(window.location.pathname);
          window.location.assign(`${SIGN_IN_URL}?redirect_url=${redirect}`);
        },
      },
    });
    return;
  }
  toast.error(userMessage(err), { id });
}

function recordFailure(error: unknown, category: "query" | "mutation", key: unknown) {
  const err = toApiError(error);
  Sentry.addBreadcrumb({
    category,
    level: "error",
    message: `${err.kind} ${err.status}${err.code ? ` ${err.code}` : ""}`,
    data: { key: JSON.stringify(key ?? null), correlationId: err.correlationId },
  });
  // API failures belong to the backend's Sentry; anything else is a client bug.
  if (!(error instanceof ApiError) && err.kind === "unknown") {
    Sentry.captureException(error);
  }
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            recordFailure(error, "query", query.queryKey);
            if (query.meta?.toast === false) return;
            // Stale data is still on screen: the panel shows its own badge.
            if (query.state.data !== undefined) return;
            notifyError(error);
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            recordFailure(error, "mutation", mutation.options.mutationKey);
            if (mutation.meta?.toast === false) return;
            notifyError(error);
          },
        }),
        defaultOptions: {
          queries: {
            // Data is considered fresh for 5 minutes
            staleTime: 1000 * 60 * 5,
            // Data is cached for 10 minutes
            gcTime: 1000 * 60 * 10,
            // Only transient failures are worth retrying (network, timeout, provider, 429, 503)
            retry: (failureCount, error) => toApiError(error).retryable && failureCount < 2,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
            // Don't refetch on window focus by default
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
          },
          mutations: {
            // Mutations are not idempotent; the user re-submits
            retry: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
