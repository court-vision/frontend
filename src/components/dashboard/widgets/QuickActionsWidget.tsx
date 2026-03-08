"use client";

import Link from "next/link";
import { Terminal, Trophy, Swords, Zap, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { label: "Terminal", icon: Terminal, href: "/terminal", color: "text-primary" },
  { label: "Rankings", icon: Trophy, href: "/rankings", color: "text-amber-400" },
  { label: "Matchup", icon: Swords, href: "/matchup", color: "text-blue-400" },
  { label: "Streamers", icon: Zap, href: "/streamers", color: "text-green-400" },
  { label: "Settings", icon: Settings, href: "/settings", color: "text-muted-foreground" },
];

export function QuickActionsWidget() {
  return (
    <div className="grid grid-cols-3 gap-1.5 p-2 h-full content-start">
      {ACTIONS.map(({ label, icon: Icon, href, color }) => (
        <Link
          key={href}
          href={href}
          className="flex flex-col items-center gap-1 p-2 rounded-md hover:bg-muted/40 transition-colors text-center"
        >
          <Icon className={cn("h-5 w-5", color)} />
          <span className="text-[11px] text-muted-foreground">{label}</span>
        </Link>
      ))}
    </div>
  );
}
