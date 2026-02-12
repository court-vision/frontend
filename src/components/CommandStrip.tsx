"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  Home,
  Users,
  Zap,
  Swords,
  UserPlus,
  Trophy,
  Terminal,
  Database,
  Search,
  User,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCommandPalette } from "@/providers/CommandPaletteProvider";
import { TeamDropdown } from "@/components/teams-components/TeamDropdown";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

const navItems = [
  { href: "/", label: "Home", icon: Home, shortcut: "1" },
  { href: "/your-teams", label: "Teams", icon: Users, shortcut: "2" },
  { href: "/lineup-generation", label: "Lineup", icon: Zap, shortcut: "3" },
  { href: "/matchup", label: "Matchup", icon: Swords, shortcut: "4" },
  { href: "/streamers", label: "Stream", icon: UserPlus, shortcut: "5" },
  { href: "/rankings", label: "Rankings", icon: Trophy, shortcut: "6" },
  { href: "/terminal", label: "Terminal", icon: Terminal, shortcut: "7" },
  { href: "/query-builder", label: "SQL", icon: Database, shortcut: "8" },
];

const mobileNavItems = [
  { href: "/", label: "Home", icon: Home, shortcut: "⌥1" },
  { href: "/your-teams", label: "Your Teams", icon: Users, shortcut: "⌥2" },
  { href: "/lineup-generation", label: "Lineup Gen", icon: Zap, shortcut: "⌥3" },
  { href: "/matchup", label: "Matchup", icon: Swords, shortcut: "⌥4" },
  { href: "/streamers", label: "Streamers", icon: UserPlus, shortcut: "⌥5" },
  { href: "/rankings", label: "Rankings", icon: Trophy, shortcut: "⌥6" },
  { href: "/terminal", label: "Terminal", icon: Terminal, shortcut: "⌥7" },
  { href: "/query-builder", label: "Query Builder", icon: Database, shortcut: "⌥8" },
  { href: "/account", label: "Account", icon: User, shortcut: "" },
];

export function CommandStrip() {
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useUser();
  const { open: openCommandPalette } = useCommandPalette();

  return (
    <header className="h-11 border-b border-border bg-card/60 backdrop-blur-sm flex items-center px-3 gap-1.5 sticky top-0 z-50 shrink-0">
      {/* Mobile menu */}
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[70vh] rounded-t-xl p-0">
            <div className="p-4 border-b flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-primary/15 border border-primary/25 flex items-center justify-center">
                <span className="font-display text-[13px] font-bold text-primary leading-none">CV</span>
              </div>
              <span className="font-display text-base font-extrabold tracking-tight brand-text">Court Vision</span>
            </div>
            <nav className="grid grid-cols-2 gap-1 p-3">
              {mobileNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <SheetTrigger key={item.href} asChild>
                    <Link href={item.href}>
                      <div className={cn(
                        "flex items-center gap-2.5 px-3 py-2.5 rounded-md text-xs font-medium transition-all",
                        "text-muted-foreground hover:text-foreground hover:bg-muted",
                        isActive && "bg-primary/10 text-primary border-l-2 border-primary"
                      )}>
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {item.shortcut && (
                          <span className="text-[9px] font-mono text-muted-foreground/50">{item.shortcut}</span>
                        )}
                      </div>
                    </Link>
                  </SheetTrigger>
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
      </div>

      {/* Brand mark */}
      <Link href="/" className="flex items-center gap-1.5 mr-3 shrink-0 group">
        <div className="h-6 w-6 rounded-md bg-primary/15 border border-primary/25 flex items-center justify-center group-hover:bg-primary/25 group-hover:shadow-[0_0_8px_hsl(var(--primary)/0.3)] transition-all duration-200">
          <span className="font-display text-[12px] font-bold text-primary leading-none">CV</span>
        </div>
        <span className="ml-1 font-display text-[15px] font-extrabold tracking-tight hidden lg:block brand-text">Court Vision</span>
      </Link>

      {/* Separator */}
      <div className="hidden md:block h-5 w-px bg-border mr-1" />

      {/* Nav tabs - desktop */}
      <nav className="hidden md:flex items-center gap-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div className={cn(
                "relative px-2.5 py-1.5 text-[11px] font-medium tracking-wide transition-all duration-150 rounded-md",
                "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                isActive && "text-primary"
              )}>
                <span>{item.label}</span>
                <sup className="ml-0.5 text-[7px] text-muted-foreground/25 font-mono">{item.shortcut}</sup>
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
      {isLoaded && isSignedIn && (
        <div className="hidden sm:block">
          <TeamDropdown />
        </div>
      )}

      {/* Separator */}
      <div className="hidden sm:block h-5 w-px bg-border mx-1" />

      {/* Command palette trigger */}
      <button
        onClick={openCommandPalette}
        className="flex items-center gap-2 h-7 px-2.5 rounded-md border border-border bg-muted/30 hover:bg-muted hover:border-primary/30 transition-all text-muted-foreground hover:text-foreground"
      >
        <Search className="h-3 w-3" />
        <span className="hidden sm:inline text-[11px]">Search...</span>
        <kbd className="hidden sm:inline-flex h-4 items-center rounded border border-border bg-muted/50 px-1 font-mono text-[9px] text-muted-foreground/60">
          <span className="text-[8px]">⌘</span>K
        </kbd>
      </button>

      {/* Status indicator */}
      <div className="hidden lg:flex items-center gap-1.5 ml-2">
        <span className="h-1.5 w-1.5 rounded-full bg-signal-live animate-beacon" />
        <span className="text-[9px] font-mono text-muted-foreground/50">Live</span>
      </div>

      {/* User */}
      <div className="ml-2">
        {isLoaded && !isSignedIn && (
          <Link href="/account">
            <Button variant="outline" size="sm" className="h-7 text-[11px]">
              Sign In
            </Button>
          </Link>
        )}
        {isLoaded && isSignedIn && (
          <Link href="/account">
            <div className="h-7 w-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center hover:bg-primary/25 transition-all cursor-pointer">
              <User className="h-3.5 w-3.5 text-primary" />
            </div>
          </Link>
        )}
      </div>
    </header>
  );
}
