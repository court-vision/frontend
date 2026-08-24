"use client";

import "./globals.css";

// Replaces the root layout when it throws, so it must render its own html/body.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Something broke
        </span>
        <h1 className="text-3xl font-semibold">Court Vision couldn&apos;t load</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          An unexpected error stopped the app from rendering.
          {error.digest && (
            <span className="mt-2 block font-mono text-xs">ref {error.digest}</span>
          )}
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Reload
        </button>
      </body>
    </html>
  );
}
