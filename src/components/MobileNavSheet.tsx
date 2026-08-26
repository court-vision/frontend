"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";

import { cn } from "@/lib/utils";
import { MOBILE_NAV, altShortcutLabel } from "@/lib/navigation";
import { TeamDropdown } from "@/components/teams-components/TeamDropdown";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";

interface MobileNavSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Bottom sheet with every mobile destination; opened from the tab bar's "More". */
export function MobileNavSheet({ open, onOpenChange }: MobileNavSheetProps) {
  const pathname = usePathname();
  const { isSignedIn } = useUser();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        aria-describedby={undefined}
        className="h-auto max-h-[70vh] supports-[height:100dvh]:max-h-[70dvh] overflow-y-auto rounded-t-xl p-0 pb-[env(safe-area-inset-bottom)]"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="p-4 border-b flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary/15 border border-primary/25 flex items-center justify-center">
            <span className="font-display text-[13px] font-bold text-primary leading-none">CV</span>
          </div>
          <span className="font-display text-base font-extrabold tracking-tight brand-text">Court Vision</span>
        </div>
        <nav className="grid grid-cols-2 gap-1 p-3">
          {MOBILE_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            const shortcut = altShortcutLabel(item);
            return (
              <SheetClose key={item.href} asChild>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-3 rounded-md text-xs font-medium transition-all",
                    "text-muted-foreground hover:text-foreground hover:bg-muted",
                    isActive && "bg-primary/10 text-primary border-l-2 border-primary"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1">{item.mobileLabel ?? item.label}</span>
                  {shortcut && (
                    <span className="text-[9px] font-mono text-muted-foreground/50">{shortcut}</span>
                  )}
                </Link>
              </SheetClose>
            );
          })}
        </nav>
        {isSignedIn && (
          <div className="p-3 border-t">
            <TeamDropdown />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
