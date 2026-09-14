"use client";

import { Loader2, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useLineupEditor } from "./LineupEditorProvider";

/**
 * Plan today's open seats and stage the moves; the apply bar appears once
 * there is something staged, and a plan with nothing to do is a toast.
 * Renders nothing outside a `LineupEditorProvider` or before the board loads.
 */
export function OptimizeLineupButton({ className }: { className?: string }) {
  const editor = useLineupEditor();
  if (!editor?.state) return null;
  const loading = editor.planStatus === "loading";

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("h-8 gap-1.5 text-xs", className)}
      onClick={() => void editor.loadPlan()}
      disabled={loading || editor.applying}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
      <span className="max-sm:hidden">Optimize today</span>
      <span className="sm:hidden">Optimize</span>
    </Button>
  );
}
