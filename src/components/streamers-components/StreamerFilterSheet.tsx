"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import {
  StreamerFilterControls,
  type StreamerFilterControlsProps,
} from "./StreamerFilterControls";

interface StreamerFilterSheetProps
  extends Omit<StreamerFilterControlsProps, "layout"> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Non-default filters, shown in the title. */
  activeCount: number;
  onClearAll: () => void;
}

/** Bottom sheet holding the streamer filters on phones. Results update live; "Done" just closes it. */
export function StreamerFilterSheet({
  open,
  onOpenChange,
  activeCount,
  onClearAll,
  ...controls
}: StreamerFilterSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-auto max-h-[85vh] supports-[height:100dvh]:max-h-[85dvh] flex-col gap-0 overflow-y-auto rounded-t-xl p-0 pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader className="space-y-1 border-b px-4 pb-3 pt-4 text-left">
          <SheetTitle className="text-base">
            Filters{activeCount > 0 ? ` · ${activeCount}` : ""}
          </SheetTitle>
          <SheetDescription className="text-xs">
            Results update as you change filters.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 py-4">
          <StreamerFilterControls layout="stacked" {...controls} />
        </div>
        <div className="grid grid-cols-2 gap-2 border-t px-4 py-3">
          <Button
            variant="outline"
            size="touch"
            onClick={onClearAll}
            disabled={activeCount === 0}
          >
            Clear all
          </Button>
          <SheetClose asChild>
            <Button size="touch">Done</Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
