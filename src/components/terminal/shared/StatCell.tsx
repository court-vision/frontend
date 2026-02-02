"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCellProps {
  label: string;
  value: number | string;
  decimals?: number;
  trend?: "up" | "down" | "neutral";
  trendValue?: number;
  size?: "sm" | "md" | "lg";
  highlight?: boolean;
  className?: string;
}

export function StatCell({
  label,
  value,
  decimals = 1,
  trend,
  trendValue,
  size = "md",
  highlight = false,
  className,
}: StatCellProps) {
  const formattedValue =
    typeof value === "number" ? value.toFixed(decimals) : value;

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  const trendColor =
    trend === "up"
      ? "text-green-500"
      : trend === "down"
      ? "text-red-500"
      : "text-muted-foreground";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-2 rounded",
        highlight && "bg-primary/10 border border-primary/20",
        !highlight && "bg-muted/30",
        className
      )}
    >
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </span>
      <div className="flex items-center gap-1">
        <span
          className={cn(
            "font-mono font-bold tabular-nums",
            sizeClasses[size],
            highlight && "text-primary"
          )}
        >
          {formattedValue}
        </span>
        {trend && (
          <TrendIcon className={cn("h-3 w-3", trendColor)} />
        )}
      </div>
      {trendValue !== undefined && (
        <span className={cn("text-[10px] font-mono", trendColor)}>
          {trendValue > 0 ? "+" : ""}
          {trendValue.toFixed(1)}
        </span>
      )}
    </div>
  );
}

interface StatRowProps {
  stats: Array<{
    label: string;
    value: number | string;
    decimals?: number;
  }>;
  className?: string;
}

export function StatRow({ stats, className }: StatRowProps) {
  return (
    <div className={cn("flex items-center gap-3 font-mono text-xs", className)}>
      {stats.map((stat, i) => (
        <div key={i} className="flex items-center gap-1">
          <span className="text-muted-foreground">{stat.label}:</span>
          <span className="font-medium tabular-nums">
            {typeof stat.value === "number"
              ? stat.value.toFixed(stat.decimals ?? 1)
              : stat.value}
          </span>
        </div>
      ))}
    </div>
  );
}
