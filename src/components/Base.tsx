"use client";

import { useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import * as Sentry from "@sentry/nextjs";

import { CommandStrip } from "@/components/CommandStrip";
import { StatusBar } from "@/components/StatusBar";
import { MobileTabBar } from "@/components/MobileTabBar";
import { KeyboardShortcutOverlay } from "@/components/KeyboardShortcutOverlay";
import { SkeletonCard } from "@/components/ui/skeleton-card";

import { FC, useEffect, useState } from "react";

// Pages render immediately, so prerendered HTML carries real content (crawlers,
// first paint) instead of a skeleton waiting on Clerk. A page shell — heading,
// tabs, filters, table structure — never depends on auth, and every
// authenticated query is gated on `isSignedIn === true`, so those stay idle
// until Clerk resolves rather than firing without a token.
//
// The exception is the two pages whose body IS Clerk's own auth widget:
// /sign-in renders <SignIn> with no loading state of its own, and /account
// renders <SignIn> / <Show when="signed-in">. Rendering them early buys
// nothing — the widget only appears once Clerk has loaded either way — so they
// keep waiting rather than hand hydration a tree whose shape depends on how
// far Clerk has got.
const AWAIT_AUTH_BEFORE_RENDER = ["/account", "/sign-in"];

function awaitsAuth(path: string): boolean {
  return AWAIT_AUTH_BEFORE_RENDER.some(
    (p) => path === p || path.startsWith(`${p}/`)
  );
}

// After this long without Clerk loading, render the page anyway (with a
// banner) rather than leaving the user on a permanent skeleton.
const CLERK_LOAD_TIMEOUT_MS = 8_000;

const Layout: FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoaded } = useUser();
  const pathname = usePathname();
  const [authTimedOut, setAuthTimedOut] = useState(false);

  useEffect(() => {
    if (isLoaded) return;
    const timer = setTimeout(() => {
      setAuthTimedOut(true);
      Sentry.captureMessage("clerk_load_timeout", { level: "warning" });
    }, CLERK_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isLoaded]);

  const loading = !isLoaded && !authTimedOut && awaitsAuth(pathname);
  const showAuthBanner = !isLoaded && authTimedOut;

  // Terminal and dashboard pages manage their own full-height layout
  const isFullHeightPage = pathname === "/terminal" || pathname === "/";

  return (
    <div className="flex flex-col h-screen supports-[height:100dvh]:h-dvh w-full overflow-hidden pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      {/* Command Strip */}
      <CommandStrip />

      {/* Sign-in service slow: keep the page usable, say why signed-in data may be missing */}
      {showAuthBanner && (
        <div
          role="status"
          className="shrink-0 border-b border-status-projected/30 bg-status-projected/10 px-3 py-1 text-center text-[11px] text-muted-foreground"
        >
          Sign-in service is slow to load — signed-in features will appear once it responds.
        </div>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 overflow-y-auto overflow-x-clip overscroll-y-contain relative ${isFullHeightPage ? '' : 'p-4 md:p-5 lg:p-8'}`}>
        <div key={pathname} className="relative z-10 page-enter">
          {loading ? <SkeletonCard /> : children}
        </div>
      </main>

      {/* Phone tab bar (below md) — in flow, so no page needs bottom padding */}
      <MobileTabBar />

      {/* Status Strip (md and up) */}
      <StatusBar />

      {/* Keyboard Shortcut Overlay */}
      <KeyboardShortcutOverlay />
    </div>
  );
};

export default Layout;
