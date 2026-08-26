"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useHydrated } from "@/hooks/useHydrated";
import { Search, User, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { DESKTOP_NAV } from "@/lib/navigation";
import { useCommandPalette } from "@/providers/CommandPaletteProvider";
import {
  CONNECTIVITY_DOT_CLASS,
  connectivityLabel,
  useConnectivity,
} from "@/hooks/useApiHealth";
import { TeamDropdown } from "@/components/teams-components/TeamDropdown";
import { Button } from "@/components/ui/button";

export function CommandStrip() {
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useUser();
  // Clerk can finish loading before React hydrates; keep the first client render equal to the SSR output.
  const authReady = useHydrated() && isLoaded;
  const { open: openCommandPalette } = useCommandPalette();
  const { connectivity, health } = useConnectivity();
  const healthLabel = connectivityLabel(connectivity, health.data?.dbLatencyMs);

  return (
    <header className="h-12 border-b border-border bg-card flex items-center px-3 md:px-4 gap-1.5 sticky top-0 z-50 shrink-0">
      {/* Brand mark (+ phone-only API health dot: the StatusBar is hidden below md) */}
      <div className="relative mr-3 shrink-0">
        <Link href="/" className="flex items-center gap-1.5 group">
          <div className="h-7 w-7 rounded-md bg-primary/15 border border-primary/25 flex items-center justify-center group-hover:bg-primary/25 group-hover:shadow-[0_0_8px_hsl(var(--primary)/0.3)] transition-all duration-200">
            <span className="font-display text-[13px] font-bold text-primary leading-none">CV</span>
          </div>
          <span
            className={cn(
              "font-display font-black tracking-tighter text-foreground drop-shadow-sm leading-none pt-0.5 hidden lg:block"
            )}
          >
            COURT<span className="text-primary">VISION</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => health.refetch()}
          aria-label={`API status: ${healthLabel}. Tap to re-check.`}
          className="md:hidden touch-hit absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center"
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full ring-2 ring-card",
              CONNECTIVITY_DOT_CLASS[connectivity],
              health.isFetching && "animate-beacon"
            )}
          />
        </button>
      </div>

      {/* Separator */}
      <div className="hidden md:block h-5 w-px bg-border mr-1" />

      {/* Nav tabs - desktop */}
      <nav className="hidden md:flex items-center gap-1">
        {DESKTOP_NAV.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div className={cn(
                "relative px-2.5 py-1.5 text-xs font-medium tracking-wide transition-all duration-150 rounded-md",
                "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                isActive && "text-primary"
              )}>
                <span>{item.label}</span>
                <sup className="ml-0.5 text-[9px] text-muted-foreground/25 font-mono">{item.altDigit}</sup>
                {isActive && (
                  <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-full" />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Team selector - desktop */}
      {authReady && isSignedIn && (
        <div className="hidden sm:block">
          <TeamDropdown />
        </div>
      )}

      {/* Separator */}
      <div className="hidden sm:block h-5 w-px bg-border mx-1" />

      {/* Command palette trigger (icon-only 44 px target on phones) */}
      <button
        onClick={openCommandPalette}
        aria-label="Search and commands"
        className="flex items-center justify-center gap-2 h-9 w-9 md:h-8 md:w-auto md:px-2.5 rounded-md border border-border bg-muted/30 hover:bg-muted hover:border-primary/30 transition-all text-muted-foreground hover:text-foreground"
      >
        <Search className="h-3 w-3" />
        <span className="hidden md:inline text-xs">Search...</span>
        <kbd className="hidden md:inline-flex h-4 items-center rounded border border-border bg-muted/50 px-1 font-mono text-[10px] text-muted-foreground/60">
          <span className="text-[9px]">⌘</span>K
        </kbd>
      </button>

      {/* Status indicator */}
      <div className="hidden lg:flex items-center gap-1.5 ml-2">
        <span className="h-1.5 w-1.5 rounded-full bg-signal-live animate-beacon" />
        <span className="text-[11px] text-muted-foreground/50">Live</span>
      </div>

      {/* Settings + User */}
      <div className="ml-2 flex items-center gap-1.5">
        {authReady && isSignedIn && (
          <Link href="/settings" aria-label="Settings">
            <div className={cn(
              "h-9 w-9 md:h-7 md:w-7 rounded-md flex items-center justify-center transition-all cursor-pointer",
              "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}>
              <Settings className="h-3.5 w-3.5" />
            </div>
          </Link>
        )}
        {authReady && !isSignedIn && (
          <Link href="/account">
            <Button variant="outline" size="sm" className="h-9 md:h-7 text-[11px]">
              Sign In
            </Button>
          </Link>
        )}
        {authReady && isSignedIn && (
          <Link href="/account" aria-label="Account">
            <div className="h-9 w-9 md:h-7 md:w-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center hover:bg-primary/25 transition-all cursor-pointer">
              <User className="h-3.5 w-3.5 text-primary" />
            </div>
          </Link>
        )}
      </div>
    </header>
  );
}
