import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        404
      </span>
      <h1 className="font-display text-3xl font-semibold">No play here</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        That page doesn&apos;t exist or has moved.
      </p>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/rankings">Player rankings</Link>
        </Button>
      </div>
    </div>
  );
}
