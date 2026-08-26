import Link from "next/link";
import { Monitor } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DesktopOnlyNoticeProps {
  feature: "Terminal" | "Query Builder";
  /** Outer wrapper classes (e.g. `p-5` on pages whose `main` is unpadded). */
  className?: string;
}

/** Shown below `lg` (1024 px) on pages whose layout needs a wide screen. */
export function DesktopOnlyNotice({ feature, className }: DesktopOnlyNoticeProps) {
  return (
    <div className={cn(className)}>
      <Card variant="panel" className="max-w-md mx-auto mt-8 p-6 text-center">
        <Monitor className="h-8 w-8 mx-auto text-primary" aria-hidden />
        <h1 className="font-display text-lg font-bold tracking-tight mt-4">
          {feature} is desktop-only
        </h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          The {feature} is built for screens &ge;1024 px. On a phone use Matchup or
          Rankings; on a tablet rotate to landscape.
        </p>
        <div className="flex items-center justify-center gap-3 mt-6">
          <Button asChild size="touch">
            <Link href="/matchup">Matchup</Link>
          </Button>
          <Button asChild size="touch" variant="outline">
            <Link href="/rankings">Rankings</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
