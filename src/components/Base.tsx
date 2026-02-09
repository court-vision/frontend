"use client";

import { useUser } from "@clerk/nextjs";

import Link from "next/link";
import { usePathname } from "next/navigation";

import Head from "next/head";
import {
  Menu,
  User,
  Home,
  Users,
  Zap,
  Swords,
  UserPlus,
  Trophy,
  Command,
  ChevronRight,
  Terminal,
  Database,
} from "lucide-react";
import Image from "next/image";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

import { ModeToggle } from "@/components/ui/toggle-mode";
import { Separator } from "@/components/ui/separator";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { StatusBar } from "@/components/StatusBar";

import { TeamDropdown } from "@/components/teams-components/TeamDropdown";

import { FC, useEffect, useState } from "react";
import { useCommandPalette } from "@/providers/CommandPaletteProvider";
import { cn } from "@/lib/utils";
import { Roboto } from "next/font/google";

const navItems = [
  { href: "/", label: "Home", icon: Home, shortcut: "1" },
  { href: "/your-teams", label: "Your Teams", icon: Users, shortcut: "2" },
  {
    href: "/lineup-generation",
    label: "Lineup Generation",
    icon: Zap,
    shortcut: "3",
  },
  { href: "/matchup", label: "Matchup", icon: Swords, shortcut: "4" },
  { href: "/streamers", label: "Streamers", icon: UserPlus, shortcut: "5" },
  { href: "/rankings", label: "Rankings", icon: Trophy, shortcut: "6" },
  { href: "/terminal", label: "Terminal", icon: Terminal, shortcut: "7" },
  { href: "/query-builder", label: "Query Builder", icon: Database, shortcut: "8" },
];

const accountItems = [
  { href: "/account", label: "Account", icon: User },
  { href: "/manage-teams", label: "Manage Teams", nested: true },
  { href: "/manage-lineups", label: "Manage Lineups", nested: true },
];

const font = Roboto({
  weight: "900",
  style: "italic",
  subsets: ["latin-ext"],
});

const Layout: FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isSignedIn, isLoaded } = useUser();
  const isLoggedIn = isSignedIn === true;
  const loading = !isLoaded;
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const { open: openCommandPalette } = useCommandPalette();
  const [logoSrc, setLogoSrc] = useState<string>("/logo-dark.png");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setLogoSrc(isDark ? "/logo-dark.png" : "/logo-light.png");
  }, []);

  useEffect(() => {
    if (resolvedTheme) {
      setLogoSrc(
        resolvedTheme === "light" ? "/logo-light.png" : "/logo-dark.png",
      );
    }
  }, [resolvedTheme]);

  const isAccountSection =
    pathname === "/account" ||
    pathname === "/manage-teams" ||
    pathname === "/manage-lineups";

  return (
    <>
      <Head>
        <title>Court Vision</title>
        <meta
          name="description"
          content="Court Vision provides advanced tools to help you win your fantasy basketball league."
        />
        <meta
          name="keywords"
          content="fantasy basketball, fantasy sports, lineup optimization, fantasy streaming, fantasy dashboard"
        />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
      </Head>

      <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr]">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col border-r bg-card/50 backdrop-blur-sm sticky top-0 h-screen">
          {/* Logo */}
          <div className="h-20 flex items-center justify-center px-4 pt-4">
            <Link href="/">
              <Image
                src={logoSrc}
                alt="Court Vision"
                width={100}
                height={100}
                key={logoSrc}
                className="hover:opacity-80 transition-opacity"
              />
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} prefetch>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                      "text-muted-foreground hover:text-foreground hover:bg-muted",
                      isActive &&
                        "bg-primary/10 text-primary border-l-2 border-primary -ml-[2px] pl-[14px]",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground/70">
                      <span className="text-xs">⌥</span>
                      {item.shortcut}
                    </kbd>
                  </div>
                </Link>
              );
            })}

            <Separator className="my-3" />

            {/* Account Section */}
            <Link href="/account" prefetch>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  "text-muted-foreground hover:text-foreground hover:bg-muted",
                  pathname === "/account" &&
                    "bg-primary/10 text-primary border-l-2 border-primary -ml-[2px] pl-[14px]",
                )}
              >
                <User className="h-4 w-4 shrink-0" />
                <span>Account</span>
              </div>
            </Link>

            {/* Nested account items - show when in account section and logged in */}
            {isAccountSection && isLoggedIn && (
              <div className="ml-4 space-y-1">
                <Link href="/manage-teams">
                  <div
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                      "text-muted-foreground hover:text-foreground hover:bg-muted",
                      pathname === "/manage-teams" && "text-primary",
                    )}
                  >
                    <ChevronRight className="h-3 w-3" />
                    Manage Teams
                  </div>
                </Link>
                <Link href="/manage-lineups">
                  <div
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                      "text-muted-foreground hover:text-foreground hover:bg-muted",
                      pathname === "/manage-lineups" && "text-primary",
                    )}
                  >
                    <ChevronRight className="h-3 w-3" />
                    Manage Lineups
                  </div>
                </Link>
              </div>
            )}
          </nav>

          {/* Command Palette Trigger */}
          <div className="p-3 border-t">
            <button
              onClick={openCommandPalette}
              className="flex items-center justify-between w-full px-3 py-2.5 text-sm text-muted-foreground rounded-lg hover:bg-muted hover:text-foreground transition-all group"
            >
              <div className="flex items-center gap-2">
                <Command className="h-4 w-4" />
                <span>Command</span>
              </div>
              <kbd className="inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground/70 group-hover:border-primary/50">
                <span className="text-xs">⌘</span>K
              </kbd>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex flex-col min-h-screen">
          {/* Header */}
          <header className="sticky top-0 z-40 flex h-14 items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 md:hidden"
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex flex-col w-72 p-0">
                {/* Mobile Logo */}
                <div className="h-14 flex items-center gap-2 px-4 border-b">
                  <div className="h-4 w-1 rounded-full bg-gradient-to-b from-primary to-primary/50" />
                  <span className={cn("text-lg tracking-tight", font.className)}>Court Vision</span>
                </div>

                {/* Mobile Nav */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                  {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <SheetTrigger key={item.href} asChild>
                        <Link href={item.href}>
                          <div
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                              "text-muted-foreground hover:text-foreground hover:bg-muted",
                              isActive && "bg-primary/10 text-primary",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            {item.label}
                          </div>
                        </Link>
                      </SheetTrigger>
                    );
                  })}

                  <Separator className="my-3" />

                  <SheetTrigger asChild>
                    <Link href="/account">
                      <div
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                          "text-muted-foreground hover:text-foreground hover:bg-muted",
                          pathname === "/account" &&
                            "bg-primary/10 text-primary",
                        )}
                      >
                        <User className="h-4 w-4" />
                        Account
                      </div>
                    </Link>
                  </SheetTrigger>

                  {isLoggedIn && (
                    <>
                      <SheetTrigger asChild>
                        <Link href="/manage-teams">
                          <div
                            className={cn(
                              "flex items-center gap-2 ml-4 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                              "text-muted-foreground hover:text-foreground hover:bg-muted",
                              pathname === "/manage-teams" && "text-primary",
                            )}
                          >
                            <ChevronRight className="h-3 w-3" />
                            Manage Teams
                          </div>
                        </Link>
                      </SheetTrigger>
                      <SheetTrigger asChild>
                        <Link href="/manage-lineups">
                          <div
                            className={cn(
                              "flex items-center gap-2 ml-4 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                              "text-muted-foreground hover:text-foreground hover:bg-muted",
                              pathname === "/manage-lineups" && "text-primary",
                            )}
                          >
                            <ChevronRight className="h-3 w-3" />
                            Manage Lineups
                          </div>
                        </Link>
                      </SheetTrigger>
                    </>
                  )}
                </nav>

                {/* Mobile Footer */}
                <div className="p-4 border-t space-y-3">
                  {!isLoggedIn && (
                    <SheetTrigger asChild>
                      <Link href="/account" className="block">
                        <Button variant="outline" className="w-full">
                          Sign In
                        </Button>
                      </Link>
                    </SheetTrigger>
                  )}
                  {isLoggedIn && <TeamDropdown />}
                  <ModeToggle />
                </div>
              </SheetContent>
            </Sheet>

            {/* Page Title / Breadcrumb */}
            <div className="flex-1 flex justify-center ml-2 md:ml-0">
              <div className="flex items-center gap-2">
                <div className="h-4 md:h-6 w-1 rounded-full bg-gradient-to-b from-primary to-primary/50" />
                <h1 className={cn("text-3xl md:text-4xl tracking-tight", font.className)}>
                  Court Vision
                </h1>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2">
              {isLoggedIn && (
                <div className="hidden sm:block">
                  <TeamDropdown />
                </div>
              )}
              {!isLoggedIn && (
                <Link href="/account" className="hidden sm:block">
                  <Button variant="outline" size="sm">
                    Sign In
                  </Button>
                </Link>
              )}
              <Link href="/account">
                <Button variant="ghost" size="icon">
                  <User className="h-4 w-4" />
                </Button>
              </Link>
              <ModeToggle />
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 p-4 lg:p-6 overflow-auto">
            {loading && <SkeletonCard />}
            {!loading && children}
          </main>

          {/* Status Bar */}
          <StatusBar />
        </div>
      </div>
    </>
  );
};

export default Layout;
