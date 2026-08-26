"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
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

/**
 * Phone navigation (below `md`): four destinations plus "More", which opens
 * the full mobile sheet. Rendered in flow (not `fixed`) so pages need no
 * bottom padding and the safe-area inset is counted once.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const { isSignedIn } = useUser();
  const [sheetOpen, setSheetOpen] = useState(false);

  const tabs = isSignedIn ? TAB_NAV : SIGNED_OUT_TAB_NAV;

  return (
    <>
      <nav
        aria-label="Primary"
        className="md:hidden shrink-0 h-14 box-content pb-[env(safe-area-inset-bottom)] border-t border-border bg-card grid grid-cols-5"
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
