"use client";

import { Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { DASHBOARD_WIDGET_REGISTRY } from "./DashboardWidgetRegistry";
import { useDashboardStore } from "@/stores/useDashboardStore";
import { useUIStore } from "@/stores/useUIStore";
import { cn } from "@/lib/utils";

const CATEGORIES = ["team", "market", "schedule", "utility"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  team: "Team",
  market: "Market",
  schedule: "Schedule",
  utility: "Utility",
};

interface WidgetCatalogProps {
  open: boolean;
  onClose: () => void;
  teamKey: string;
}

export function WidgetCatalog({ open, onClose, teamKey }: WidgetCatalogProps) {
  const { layouts, addWidget } = useDashboardStore();
  const { selectedTeam } = useUIStore();
  const currentWidgets = layouts[teamKey]?.widgets ?? [];
  const activeDefinitionIds = new Set(
    currentWidgets.map((w) => w.definitionId)
  );

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-80 p-0">
        <SheetHeader className="p-4 pb-2">
          <SheetTitle className="text-sm">Add Widget</SheetTitle>
          <SheetDescription className="text-xs">
            Choose panels to add to your dashboard
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-5">
          {CATEGORIES.map((cat) => {
            const widgets = DASHBOARD_WIDGET_REGISTRY.filter(
              (w) => w.category === cat
            );
            if (!widgets.length) return null;
            return (
              <div key={cat}>
                <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">
                  {CATEGORY_LABELS[cat]}
                </p>
                <div className="space-y-1">
                  {widgets.map((def) => {
                    const isAdded = activeDefinitionIds.has(def.id);
                    const isDisabled = def.requiresTeam && !selectedTeam;
                    const Icon = def.icon;
                    return (
                      <div
                        key={def.id}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-md",
                          isDisabled
                            ? "opacity-40"
                            : "hover:bg-muted/40 cursor-pointer"
                        )}
                      >
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium">{def.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {def.description}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          disabled={isDisabled}
                          onClick={() => {
                            addWidget(teamKey, def.id);
                            onClose();
                          }}
                        >
                          {isAdded ? (
                            <Check className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
