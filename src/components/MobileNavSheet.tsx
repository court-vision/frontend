"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";

import { cn } from "@/lib/utils";
import { MOBILE_NAV } from "@/lib/navigation";
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
        <div className="p-4 border-b flex items-center">
          <span className="font-display text-lg font-black tracking-tighter leading-none">
            COURT<span className="text-primary">VISION</span>
          </span>
        </div>
        <nav className="grid grid-cols-2 gap-1 p-3">
          {MOBILE_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
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
