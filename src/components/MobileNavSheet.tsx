"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";

import { cn } from "@/lib/utils";
import { MOBILE_NAV } from "@/lib/navigation";
import { TeamDropdown } from "@/components/teams-components/TeamDropdown";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";

interface MobileNavSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Bottom drawer with every mobile destination. Opened from the tab bar's
 * "More" or by swiping up on the bar; swipe it back down to dismiss.
 */
export function MobileNavSheet({ open, onOpenChange }: MobileNavSheetProps) {
  const pathname = usePathname();
  const { isSignedIn } = useUser();

  return (
    <Drawer open={open} onOpenChange={onOpenChange} setBackgroundColorOnScale={false}>
      <DrawerContent className="max-h-[80vh] supports-[height:100dvh]:max-h-[80dvh] pb-[env(safe-area-inset-bottom)]">
        <DrawerTitle className="sr-only">Navigation</DrawerTitle>
        <DrawerDescription className="sr-only">Every page, and your team.</DrawerDescription>
        <div className="flex items-center px-4 pb-3 pt-1">
          <span className="font-display text-lg font-black leading-none tracking-tighter">
            COURT<span className="text-primary">VISION</span>
          </span>
        </div>
        <nav className="grid grid-cols-2 gap-1 overflow-y-auto border-t border-border p-3">
          {MOBILE_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <DrawerClose key={item.href} asChild>
                <Link
                  href={item.href}
                  className={cn(
                    "flex min-h-[44px] items-center gap-2.5 rounded-md px-3 py-2.5 text-xs font-medium transition-all",
                    "text-muted-foreground hover:bg-muted hover:text-foreground",
                    isActive && "bg-primary/10 text-primary"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1">{item.mobileLabel ?? item.label}</span>
                </Link>
              </DrawerClose>
            );
          })}
        </nav>
        {isSignedIn && (
          <div className="border-t border-border p-3">
            <TeamDropdown />
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
