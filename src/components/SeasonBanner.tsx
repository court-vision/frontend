"use client";

import { Medal } from "lucide-react";
import Link from "next/link";

export function SeasonBanner() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-primary/5 border border-primary/15 text-sm">
      <Medal className="h-4 w-4 text-primary shrink-0" />
      <span className="text-muted-foreground">
        The 2025–26 fantasy regular season is over. NBA Playoffs are live —{" "}
        <Link href="/playoffs" className="text-primary hover:underline font-medium">
          view the bracket
        </Link>
        {" "}or{" "}
        <Link href="/terminal" className="text-primary hover:underline font-medium">
          follow games in the terminal
        </Link>
        .
      </span>
    </div>
  );
}
