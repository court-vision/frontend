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
      variant={href ? "interactive" : "default"}
      className={cn("p-4", className)}
    >
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
        {label}
      </p>
      <div className="flex items-center gap-2 mt-1">
        <span className="font-display text-2xl font-bold tabular-nums">
          {value}
        </span>
        {trend === "up" && (
          <TrendingUp className="h-4 w-4 text-status-win" />
        )}
        {trend === "down" && (
          <TrendingDown className="h-4 w-4 text-status-loss" />
        )}
      </div>
      {subValue && (
        <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
      )}
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
