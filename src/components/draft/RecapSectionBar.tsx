/** A section's band inside a recap card: a title on the left, a mono note on the right. */
export function RecapSectionBar({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 border-b border-border/50 bg-muted/30 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {title}
      {right !== undefined && (
        <span className="ml-auto flex items-center gap-1.5 font-mono normal-case tracking-normal text-muted-foreground/70">
          {right}
        </span>
      )}
    </div>
  );
}
