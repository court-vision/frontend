"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Something broke
      </span>
      <h1 className="font-display text-3xl font-semibold">This page hit an error</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The rest of Court Vision is still running. Try again, or head back home.
        {error.digest && (
          <span className="mt-2 block font-mono text-xs">ref {error.digest}</span>
        )}
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
