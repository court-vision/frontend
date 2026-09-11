import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Page-level actions (links, dialogs). Kept on every screen size. */
  actions?: ReactNode;
  className?: string;
}

/**
 * Page title row. Phones only: from `md` up the command strip's active tab
 * names the page, so the title and subtitle are hidden there (they stay in
 * the DOM for crawlers). Actions still render on desktop, right-aligned on
 * their own row, so nothing a page offers goes away with its title.
 *
 * `md:[&+*]:!mt-0`: pages stack their children with `space-y-4`, which would
 * otherwise leave the hidden header's 16px gap above the first visible block.
 */
export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <section
      className={cn(
        "flex items-start justify-between gap-3",
        !actions && "md:hidden md:[&+*]:!mt-0",
        className
      )}
    >
      <div className="min-w-0 md:hidden">
        <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2 md:ml-auto">{actions}</div>
      )}
    </section>
  );
}
