"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import * as Sentry from "@sentry/nextjs";

import { CommandStrip } from "@/components/CommandStrip";
import { StatusBar } from "@/components/StatusBar";
import { MobileTabBar } from "@/components/MobileTabBar";
import { MobileDockProvider } from "@/components/MobileDock";
import { PullToRefresh } from "@/components/PullToRefresh";
import { KeyboardShortcutOverlay } from "@/components/KeyboardShortcutOverlay";
import { isDeskPath } from "@/components/desk/routes";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { useScrollTapGuard } from "@/hooks/useScrollTapGuard";

import { FC, useEffect, useRef, useState } from "react";

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
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useAuth();
  // The desks bring their own shell (bar, status line, theme, toasts). The
  // app's shell is a component of its own so it mounts afresh after a desk:
  // its listeners (the scroll-tap guard) attach to the <main> it renders.
  if (isDeskPath(pathname)) return <>{children}</>;
  // So does the signed-out front page (the landing, in a desk frame). It covers
  // the whole window, so until Clerk says who this is the shell under it is
  // never seen; once Clerk says signed out, the shell drops its chrome, in
  // place, so the landing is not mounted twice.
  return <Shell bare={pathname === "/" && isLoaded && !isSignedIn}>{children}</Shell>;
};

const Shell: FC<{ children: React.ReactNode; bare: boolean }> = ({ children, bare }) => {
  const { isLoaded } = useUser();
  const pathname = usePathname();
  const [authTimedOut, setAuthTimedOut] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const [dock, setDock] = useState<HTMLDivElement | null>(null);

  // A touch that scrolls (or stops a momentum scroll) must not click the row under it.
  useScrollTapGuard(mainRef);

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
    <MobileDockProvider value={dock}>
    <div
      data-vaul-drawer-wrapper=""
      className="flex flex-col h-screen supports-[height:100dvh]:h-dvh w-full overflow-hidden bg-background pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
    >
      {/* Command Strip */}
      {bare ? null : <Chrome><CommandStrip /></Chrome>}

      {/* Sign-in service slow: keep the page usable, say why signed-in data may be missing */}
      {showAuthBanner && (
        <div
          role="status"
          className="shrink-0 border-b border-status-projected/30 bg-status-projected/10 px-3 py-1 text-center text-[11px] text-muted-foreground"
        >
          Sign-in service is slow to load — signed-in features will appear once it responds.
        </div>
      )}

      {/* Main Content Area. A pull slides <main> down to uncover the refresh
          court parked behind it (hence its opaque background); the box keeps
          the court below the header and clips the slid page at the bottom. */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {bare ? null : <Chrome><PullToRefresh scrollerRef={mainRef} /></Chrome>}
        <main ref={mainRef} className={`flex-1 overflow-y-auto overflow-x-clip overscroll-y-contain relative bg-background ${isFullHeightPage ? '' : 'p-4 md:p-5 lg:p-8'}`}>
          <div key={pathname} className="relative z-10 page-enter">
            {loading ? <SkeletonCard /> : children}
          </div>
        </main>
      </div>

      {/* Phone dock (below md): page actions pinned flush on the tab bar, see MobileDockPortal */}
      {bare ? null : <div ref={setDock} data-app-chrome="" className="md:hidden relative z-20 shrink-0" />}

      {/* Phone tab bar (below md) — in flow, so no page needs bottom padding */}
      {bare ? null : <Chrome><MobileTabBar /></Chrome>}

      {/* Status Strip (md and up) */}
      {bare ? null : <Chrome><StatusBar /></Chrome>}

      {/* Keyboard Shortcut Overlay */}
      {bare ? null : <Chrome><KeyboardShortcutOverlay /></Chrome>}
    </div>
    </MobileDockProvider>
  );
};

/**
 * The shell's chrome, marked so that a page bringing its own frame (the
 * landing) can hide it in CSS from the first paint, before Clerk has loaded
 * and `bare` can drop it (globals.css).
 */
const Chrome: FC<{ children: React.ReactNode }> = ({ children }) => (
  <div data-app-chrome="" className="contents">
    {children}
  </div>
);

export default Layout;
