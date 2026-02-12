"use client";

import { useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

import { CommandStrip } from "@/components/CommandStrip";
import { StatusBar } from "@/components/StatusBar";
import { KeyboardShortcutOverlay } from "@/components/KeyboardShortcutOverlay";
import { SkeletonCard } from "@/components/ui/skeleton-card";

import { FC, useEffect, useRef } from "react";

const routeOrder = [
  "/",
  "/your-teams",
  "/lineup-generation",
  "/matchup",
  "/streamers",
  "/rankings",
  "/terminal",
  "/query-builder",
];

function getRouteIndex(path: string): number {
  const idx = routeOrder.indexOf(path);
  return idx === -1 ? routeOrder.length : idx;
}

const Layout: FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoaded } = useUser();
  const loading = !isLoaded;
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);

  // Determine slide direction based on nav order
  const prevIndex = getRouteIndex(prevPathRef.current);
  const currIndex = getRouteIndex(pathname);
  const direction = currIndex >= prevIndex ? "page-enter-right" : "page-enter-left";

  useEffect(() => {
    prevPathRef.current = pathname;
  }, [pathname]);

  // Terminal page manages its own full-height layout
  const isTerminalPage = pathname === "/terminal";

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      {/* Command Strip */}
      <CommandStrip />

      {/* Main Content Area */}
      <main className={`flex-1 overflow-y-auto overflow-x-clip relative ${isTerminalPage ? '' : 'p-4 lg:p-6'}`}>
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
