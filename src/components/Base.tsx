"use client";

import { useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

import { CommandStrip } from "@/components/CommandStrip";
import { StatusBar } from "@/components/StatusBar";
import { KeyboardShortcutOverlay } from "@/components/KeyboardShortcutOverlay";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { ROUTE_ORDER } from "@/lib/navigation";

import { FC, useEffect, useRef } from "react";

function getRouteIndex(path: string): number {
  const idx = ROUTE_ORDER.indexOf(path);
  return idx === -1 ? ROUTE_ORDER.length : idx;
}

// Public pages whose content doesn't depend on auth render immediately, so
// their prerendered HTML carries real content (crawlers, first paint) instead
// of a skeleton waiting on Clerk.
const RENDER_BEFORE_AUTH = new Set(["/rankings"]);

const Layout: FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoaded } = useUser();
  const pathname = usePathname();
  const loading = !isLoaded && !RENDER_BEFORE_AUTH.has(pathname);
  const prevPathRef = useRef(pathname);

  // Determine slide direction based on nav order
  const prevIndex = getRouteIndex(prevPathRef.current);
  const currIndex = getRouteIndex(pathname);
  const direction = currIndex >= prevIndex ? "page-enter-right" : "page-enter-left";

  useEffect(() => {
    prevPathRef.current = pathname;
  }, [pathname]);

  // Terminal and dashboard pages manage their own full-height layout
  const isFullHeightPage = pathname === "/terminal" || pathname === "/";

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      {/* Command Strip */}
      <CommandStrip />

      {/* Main Content Area */}
      <main className={`flex-1 overflow-y-auto overflow-x-clip relative ${isFullHeightPage ? '' : 'p-5 lg:p-8'}`}>
        <div key={pathname} className={`relative z-10 ${direction}`}>
          {loading && <SkeletonCard />}
          {!loading && children}
        </div>
      </main>

      {/* Status Strip */}
      <StatusBar />

      {/* Keyboard Shortcut Overlay */}
      <KeyboardShortcutOverlay />
    </div>
  );
};

export default Layout;
