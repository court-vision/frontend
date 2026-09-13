"use client";

import { useRef, useState, type TouchEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useHydrated } from "@/hooks/useHydrated";
import { LogIn, Menu, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { SIGNED_OUT_TAB_NAV, TAB_NAV } from "@/lib/navigation";
import { MobileNavSheet } from "@/components/MobileNavSheet";

const TAB_CLASS =
  "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground transition-colors";

function Tab({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(TAB_CLASS, active && "text-primary")}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </Link>
  );
}

/** Upward travel, in px, that counts as "swipe up" on the bar. */
const SWIPE_UP_PX = 28;

/**
 * Phone navigation (below `md`): four destinations plus "More", which opens
 * the full mobile sheet — a swipe up anywhere on the bar opens it too.
 * Rendered in flow (not `fixed`) so pages need no bottom padding and the
 * safe-area inset is counted once.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const { isSignedIn } = useUser();
  const [sheetOpen, setSheetOpen] = useState(false);
  const touchStartY = useRef<number | null>(null);

  const onTouchStart = (e: TouchEvent) => {
    touchStartY.current = e.touches[0]?.clientY ?? null;
  };
  const onTouchMove = (e: TouchEvent) => {
    const y = e.touches[0]?.clientY;
    if (touchStartY.current == null || y == null) return;
    if (touchStartY.current - y > SWIPE_UP_PX) {
      touchStartY.current = null;
      setSheetOpen(true);
    }
  };
  const onTouchEnd = () => {
    touchStartY.current = null;
  };

  // Same SSR/hydration rule as CommandStrip: the signed-out bar is what the server rendered.
  const tabs = useHydrated() && isSignedIn ? TAB_NAV : SIGNED_OUT_TAB_NAV;

  return (
    <>
      <nav
        aria-label="Primary"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        className="md:hidden shrink-0 h-14 box-content touch-none pb-[env(safe-area-inset-bottom)] border-t border-border bg-card grid grid-cols-5"
      >
        {tabs.map((item) => (
          <Tab
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={pathname === item.href}
          />
        ))}
        {!isSignedIn && (
          <Tab
            href="/sign-in"
            label="Sign in"
            icon={LogIn}
            active={pathname.startsWith("/sign-in")}
          />
        )}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          className={cn(TAB_CLASS, sheetOpen && "text-foreground")}
        >
          <Menu className="h-5 w-5" />
          <span>More</span>
        </button>
      </nav>
      <MobileNavSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  );
}
