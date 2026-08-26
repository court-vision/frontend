"use client"

import * as React from "react"

import { useIsTouch } from "@/hooks/useBreakpoint"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type Side = "top" | "right" | "bottom" | "left"

export interface HintPopoverProps {
  content: React.ReactNode
  /** The trigger; rendered `asChild`, so pass a single element. */
  children: React.ReactNode
  side?: Side
  contentClassName?: string
}

/**
 * Informational hint: a hover Tooltip with a mouse, a tap-to-toggle Popover on
 * touch devices (where tooltips never open). For action buttons use
 * `aria-label` instead.
 */
export function HintPopover({
  content,
  children,
  side = "top",
  contentClassName,
}: HintPopoverProps) {
  const isTouch = useIsTouch()

  if (isTouch) {
    return (
      <Popover>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent
          side={side}
          className={cn("w-auto max-w-[260px] px-3 py-2 text-xs", contentClassName)}
        >
          {content}
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className={contentClassName}>
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
