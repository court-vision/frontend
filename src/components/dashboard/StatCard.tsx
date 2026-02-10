"use client";

import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
  href?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  subValue,
  trend,
  href,
  className,
}: StatCardProps) {
  const content = (
    <Card
      variant={href ? "interactive" : "panel"}
      className={cn("p-3.5", className)}
    >
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
        {label}
      </p>
      <div className="flex items-center gap-2 mt-1">
        <span className="font-mono text-xl font-bold tabular-nums">
          {value}
        </span>
        {trend === "up" && (
          <TrendingUp className="h-3.5 w-3.5 text-status-win" />
        )}
        {trend === "down" && (
          <TrendingDown className="h-3.5 w-3.5 text-status-loss" />
        )}
      </div>
      {subValue && (
        <p className="text-[11px] text-muted-foreground mt-0.5">{subValue}</p>
      )}
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
