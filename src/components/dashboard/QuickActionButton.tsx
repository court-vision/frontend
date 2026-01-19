"use client";

import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionButtonProps {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function QuickActionButton({
  icon: Icon,
  label,
  shortcut,
  href,
  onClick,
  className,
}: QuickActionButtonProps) {
  const content = (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
        "bg-muted/50 hover:bg-muted text-foreground transition-all",
        "cursor-pointer group",
        className
      )}
      onClick={onClick}
    >
      <Icon className="h-4 w-4 text-primary shrink-0" />
      <span className="flex-1">{label}</span>
      {shortcut && (
        <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] text-muted-foreground group-hover:border-primary/50 transition-colors">
          {shortcut}
        </kbd>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
