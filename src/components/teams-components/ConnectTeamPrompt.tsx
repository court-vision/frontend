"use client";

import Link from "next/link";
import { Plug, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ConnectTeamPromptProps {
  variant?: "card" | "banner";
  title?: string;
  description?: string;
  ctaLabel?: string;
  onDismiss?: () => void;
  className?: string;
}

const ADD_TEAM_HREF = "/manage-teams?add=1";

/**
 * Empty-state prompt for users with no connected team. `card` replaces page
 * content; `banner` sits above content and can be dismissed.
 */
export function ConnectTeamPrompt({
  variant = "card",
  title = "Connect your league",
  description = "Link your ESPN or Yahoo team to unlock matchups, rankings tuned to your scoring format, streamers, and lineup tools.",
  ctaLabel = "Add a Team",
  onDismiss,
  className,
}: ConnectTeamPromptProps) {
  if (variant === "banner") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-lg bg-primary/5 border border-primary/15 text-sm",
          className
        )}
      >
        <Plug className="h-4 w-4 text-primary shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="font-medium text-foreground">{title}.</span>{" "}
          <span className="text-muted-foreground">{description}</span>
        </div>
        <Link href={ADD_TEAM_HREF} className="shrink-0">
          <Button size="sm" className="h-7 text-xs">
            {ctaLabel}
          </Button>
        </Link>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="h-6 w-6 shrink-0 flex items-center justify-center rounded text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <Card variant="panel" className={cn("p-8", className)}>
      <div className="mx-auto max-w-md text-center space-y-3">
        <div className="mx-auto h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Plug className="h-5 w-5 text-primary" />
        </div>
        <p className="font-display text-base font-bold tracking-tight">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
        <Link href={ADD_TEAM_HREF} className="inline-block">
          <Button size="sm">{ctaLabel}</Button>
        </Link>
      </div>
    </Card>
  );
}
