import { Badge } from "@/components/ui/badge";

/**
 * The compact injury pill shown next to a player's name (roster table,
 * lineup editor). OUT-class statuses are red, day-to-day orange, questionable
 * yellow; anything else (ACTIVE, null) renders nothing.
 */
export function getInjuryBadge(status: string | null | undefined) {
  if (!status) return null;
  const upper = status.toUpperCase();

  if (["OUT", "O", "IL", "IL+", "SUSPENSION", "INJURY_RESERVE"].includes(upper)) {
    return (
      <Badge className="text-[11px] px-1 py-0 h-4 bg-red-500/15 text-red-500 border-red-500/30">
        {upper === "SUSPENSION" ? "SUSP" : upper === "INJURY_RESERVE" ? "IR" : upper}
      </Badge>
    );
  }
  if (["DTD", "DAY_TO_DAY"].includes(upper)) {
    return (
      <Badge className="text-[11px] px-1 py-0 h-4 bg-orange-500/15 text-orange-500 border-orange-500/30">
        DTD
      </Badge>
    );
  }
  if (["GTD", "QUESTIONABLE", "DOUBTFUL"].includes(upper)) {
    return (
      <Badge className="text-[11px] px-1 py-0 h-4 bg-yellow-500/15 text-yellow-500 border-yellow-500/30">
        {upper === "QUESTIONABLE" ? "Q" : upper === "DOUBTFUL" ? "DBT" : upper}
      </Badge>
    );
  }
  return null;
}
