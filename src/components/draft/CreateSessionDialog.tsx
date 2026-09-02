"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { scoringShortLabel } from "@/lib/category-format";
import { useSelectedTeam } from "@/hooks/useSelectedTeam";
import { useTeamLeagueQuery } from "@/hooks/useTeams";
import { useCreateDraftSessionMutation } from "@/hooks/useDrafts";
import type { DraftKind, DraftType } from "@/types/draft";

const MOCK_TEAM = "mock";

/**
 * Start a draft room.
 *
 * Everything the provider told us is prefilled server-side from the team's
 * synced league — draft type, pick order, rounds, keeper allowance — so the
 * form asks for the one thing nothing can infer: which seat is yours.
 * `pick_order` holds ESPN team ids that do not map back to our teams.
 */
export function CreateSessionDialog() {
  const router = useRouter();
  const { teams, teamId: selectedTeamId } = useSelectedTeam();
  const createSession = useCreateDraftSessionMutation();

  const [open, setOpen] = useState(false);
  const [teamValue, setTeamValue] = useState<string>(
    selectedTeamId !== null ? String(selectedTeamId) : MOCK_TEAM
  );
  const [kind, setKind] = useState<DraftKind>("manual");
  const [draftType, setDraftType] = useState<DraftType | "">("");
  const [mySlot, setMySlot] = useState("");
  const [rounds, setRounds] = useState("");

  useEffect(() => {
    setTeamValue(selectedTeamId !== null ? String(selectedTeamId) : MOCK_TEAM);
  }, [selectedTeamId]);

  const team = useMemo(
    () => teams.find((t) => String(t.team_id) === teamValue) ?? null,
    [teams, teamValue]
  );

  // `draft_settings` lives on the league *detail*, not the summary embedded in
  // the team row — so the picked team's league is fetched to size the slot
  // picker. Without a synced league the user types a slot instead.
  const { data: league } = useTeamLeagueQuery(team?.team_id ?? null);
  const leagueSize = useMemo(() => {
    const order = league?.draft_settings?.pick_order;
    return Array.isArray(order) ? order.length : 0;
  }, [league]);

  function reset() {
    setTeamValue(selectedTeamId !== null ? String(selectedTeamId) : MOCK_TEAM);
    setKind("manual");
    setDraftType("");
    setMySlot("");
    setRounds("");
  }

  function handleCreate() {
    createSession.mutate(
      {
        team_id: teamValue === MOCK_TEAM ? null : Number(teamValue),
        kind: teamValue === MOCK_TEAM ? "mock" : kind,
        draft_type: draftType === "" ? null : draftType,
        my_slot: mySlot === "" ? null : Number(mySlot),
        rounds: rounds === "" ? null : Number(rounds),
        pick_order: null,
        keepers: [],
      },
      {
        onSuccess: (session) => {
          setOpen(false);
          reset();
          router.push(`/draft/${session.id}`);
        },
      }
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="h-7 gap-1.5 text-[11px]">
          <Plus className="h-3 w-3" />
          New draft
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Start a draft room</DialogTitle>
          <DialogDescription className="text-xs">
            Pick the team you are drafting for and we will prefill the draft type, pick order and
            rounds from its league.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Team</label>
            <Select value={teamValue} onValueChange={setTeamValue}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.team_id} value={String(t.team_id)} className="text-xs">
                    <span className="flex w-full items-center">
                      <span
                        className={cn(
                          "mr-2 h-2 w-2 shrink-0 rounded-full",
                          t.league_info?.provider === "yahoo" ? "bg-purple-500" : "bg-orange-500"
                        )}
                      />
                      <span className="truncate">
                        {t.league_info?.team_name || "Unknown Team"}
                      </span>
                      {scoringShortLabel(t.league) && (
                        <span className="ml-auto pl-2 font-mono text-[9px] text-muted-foreground/60">
                          {scoringShortLabel(t.league)}
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
                <SelectItem value={MOCK_TEAM} className="text-xs">
                  Mock draft (no league)
                </SelectItem>
              </SelectContent>
            </Select>
            {team && !team.league?.settings_synced && (
              <p className="text-[10px] text-amber-500">
                This league&apos;s settings are not synced, so nothing can be prefilled. Sync it from
                Manage Teams for pick order and rounds.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Your slot</label>
            {leagueSize > 0 ? (
              <Select value={mySlot} onValueChange={setMySlot}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={`Pick 1–${leagueSize}`} />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: leagueSize }, (_, i) => i + 1).map((slot) => (
                    <SelectItem key={slot} value={String(slot)} className="text-xs">
                      Slot {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type="number"
                min={1}
                value={mySlot}
                onChange={(e) => setMySlot(e.target.value)}
                placeholder="e.g. 3"
                className="h-8 text-xs"
              />
            )}
            <p className="text-[10px] text-muted-foreground">
              ESPN&apos;s pick order uses its own team ids, so we cannot tell which seat is yours.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Draft type</label>
              <Select
                value={draftType === "" ? "auto" : draftType}
                onValueChange={(v) => setDraftType(v === "auto" ? "" : (v as DraftType))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto" className="text-xs">
                    From league
                  </SelectItem>
                  <SelectItem value="snake" className="text-xs">
                    Snake
                  </SelectItem>
                  <SelectItem value="auction" className="text-xs">
                    Auction
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Rounds</label>
              <Input
                type="number"
                min={1}
                max={40}
                value={rounds}
                onChange={(e) => setRounds(e.target.value)}
                placeholder="From league"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {teamValue !== MOCK_TEAM && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Room type</label>
              <Select value={kind} onValueChange={(v) => setKind(v as DraftKind)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual" className="text-xs">
                    Manual — I enter every pick
                  </SelectItem>
                  <SelectItem value="mock" className="text-xs">
                    Mock — practice run
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleCreate}
            disabled={createSession.isPending}
          >
            {createSession.isPending ? "Creating..." : "Start drafting"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
