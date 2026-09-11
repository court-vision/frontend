import { Badge } from "@/components/ui/badge";
import { connectionStatusLabel, type ConnectionTone } from "@/lib/connections";
import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "@/types/connections";

const TONES: Record<ConnectionTone, string> = {
  ok: "border-status-win/30 bg-status-win/10 text-status-win",
  error: "border-status-loss/30 bg-status-loss/10 text-status-loss",
  muted: "text-muted-foreground",
};

/** Connected / Expired / Not verified, from ESPN's last verdict on the cookies. */
export function ConnectionStatusBadge({
  status,
  className,
}: {
  status: ConnectionStatus;
  className?: string;
}) {
  const { label, tone } = connectionStatusLabel(status);
  return (
    <Badge variant="outline" className={cn("text-[11px] px-1.5 py-0 font-normal", TONES[tone], className)}>
      {label}
    </Badge>
  );
}
