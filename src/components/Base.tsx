"use client";

import { useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

import { CommandStrip } from "@/components/CommandStrip";
import { StatusBar } from "@/components/StatusBar";
import { KeyboardShortcutOverlay } from "@/components/KeyboardShortcutOverlay";
import { SkeletonCard } from "@/components/ui/skeleton-card";

import { FC } from "react";

const Layout: FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoaded } = useUser();
  const loading = !isLoaded;
  const pathname = usePathname();

  // Terminal page manages its own full-height layout
  const isTerminalPage = pathname === "/terminal";

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      {/* Command Strip */}
      <CommandStrip />

      {/* Main Content Area */}
      <main className={`flex-1 overflow-auto relative ${isTerminalPage ? '' : 'p-4 lg:p-6'}`}>
        <div className="relative z-10">
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
