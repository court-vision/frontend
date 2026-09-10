import { cn } from "@/lib/utils"

/**
 * A numeric cell whose value hasn't arrived yet.
 *
 * Rendered *inside the real row* rather than swapped for a skeleton block, so
 * the column keeps its final width and nothing moves when the number lands —
 * the layout is correct by construction instead of by guessing.
 *
 * The glyph is hidden from assistive tech because there is no value to read;
 * mark the surrounding table or card `aria-busy="true"` so the pending state
 * is still announced.
 */
function PendingValue({
  className,
  placeholder = "--.-",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { placeholder?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("font-mono tabular-nums text-muted-foreground/40", className)}
      {...props}
    >
      {placeholder}
    </span>
  )
}

export { PendingValue }
