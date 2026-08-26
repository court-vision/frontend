"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export interface ScrollXProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Class for the outer `relative` wrapper (the scroller itself takes `className`). */
  wrapperClassName?: string
}

interface Fade {
  left: boolean
  right: boolean
}

const NO_FADE: Fade = { left: false, right: false }

/**
 * Horizontal scroller with edge fades that exist only while the content
 * overflows, so anything that fits (desktop tables) renders exactly as before.
 */
const ScrollX = React.forwardRef<HTMLDivElement, ScrollXProps>(
  ({ className, wrapperClassName, children, onScroll, ...props }, ref) => {
    const scrollerRef = React.useRef<HTMLDivElement | null>(null)
    const frameRef = React.useRef(0)
    const [fade, setFade] = React.useState<Fade>(NO_FADE)

    const setScroller = React.useCallback(
      (node: HTMLDivElement | null) => {
        scrollerRef.current = node
        if (typeof ref === "function") ref(node)
        else if (ref) ref.current = node
      },
      [ref]
    )

    const measure = React.useCallback(() => {
      const el = scrollerRef.current
      if (!el) return
      const overflow = el.scrollWidth - el.clientWidth
      const next: Fade =
        overflow <= 1
          ? NO_FADE
          : {
              left: el.scrollLeft > 1,
              right: el.scrollLeft < overflow - 1,
            }
      setFade((prev) =>
        prev.left === next.left && prev.right === next.right ? prev : next
      )
    }, [])

    const scheduleMeasure = React.useCallback(() => {
      if (frameRef.current) return
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = 0
        measure()
      })
    }, [measure])

    React.useEffect(() => {
      const el = scrollerRef.current
      if (!el) return
      measure()
      const observer = new ResizeObserver(scheduleMeasure)
      observer.observe(el)
      // Content (a table filling with rows) changes scrollWidth without
      // resizing the scroller, so watch the direct children too.
      for (const child of Array.from(el.children)) observer.observe(child)
      return () => {
        observer.disconnect()
        if (frameRef.current) cancelAnimationFrame(frameRef.current)
        frameRef.current = 0
      }
    }, [measure, scheduleMeasure])

    return (
      <div
        className={cn("relative", wrapperClassName)}
        data-fade-left={fade.left || undefined}
        data-fade-right={fade.right || undefined}
      >
        <div
          ref={setScroller}
          // `overscroll-contain` is phone-only: on desktop it promotes the scroller to
          // its own compositing layer, which changes text anti-aliasing.
          className={cn("overflow-x-auto max-md:overscroll-x-contain", className)}
          onScroll={(e) => {
            scheduleMeasure()
            onScroll?.(e)
          }}
          {...props}
        >
          {children}
        </div>
        {fade.left && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-card"
          />
        )}
        {fade.right && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-card"
          />
        )}
      </div>
    )
  }
)
ScrollX.displayName = "ScrollX"

export { ScrollX }
