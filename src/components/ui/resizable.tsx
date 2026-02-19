"use client";

import { GripVerticalIcon } from "lucide-react";
import {
  Group,
  Panel,
  Separator,
  type GroupProps,
  type PanelProps,
  type SeparatorProps,
} from "react-resizable-panels";

import { cn } from "@/lib/utils";

type ResizablePanelGroupProps = Omit<GroupProps, "orientation"> & {
  direction?: "horizontal" | "vertical";
};

function ResizablePanelGroup({
  className,
  direction = "horizontal",
  ...props
}: ResizablePanelGroupProps) {
  return (
    <Group
      data-slot="resizable-panel-group"
      orientation={direction}
      className={cn(
        "flex h-full w-full",
        direction === "vertical" && "flex-col",
        className
      )}
      {...props}
    />
  );
}

function ResizablePanel({ ...props }: PanelProps) {
  return <Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: SeparatorProps & {
  withHandle?: boolean;
}) {
  return (
    <Separator
      data-slot="resizable-handle"
      className={cn(
        "bg-border focus-visible:ring-ring relative flex w-px items-center justify-center focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border">
          <GripVerticalIcon className="size-2.5" />
        </div>
      )}
    </Separator>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
