"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { scoringShortLabel } from "@/lib/category-format";
import { importFailure, type ImportFailure } from "@/lib/draft-import";
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
import { useSelectedTeam } from "@/hooks/useSelectedTeam";
import {
  useCreateDraftSessionMutation,
  useDeleteDraftSessionMutation,
  useDraftImportMutation,
} from "@/hooks/useDrafts";

type Phase = "idle" | "creating" | "importing" | "cleaning";

const PHASE_LABEL: Record<Phase, string> = {
  idle: "Import",
  creating: "Opening a room…",
  importing: "Importing from ESPN…",
  cleaning: "Cleaning up…",
};

/**
 * Import a finished ESPN draft: a room is opened for the team, the completed
 * draft folded into it, and the recap opened — one click for a manager who
 * drafted without the room.
 *
 * ESPN writes the picks only when the draft completes, so an unfinished draft
 * is refused, and the empty room the refusal leaves behind is removed again:
 * the list should not fill with rooms that hold nothing. Yahoo drafts cannot
 * be imported yet, and the dialog says so rather than offering the team.
 */
export function ImportDraftDialog() {
  const router = useRouter();
  const { teams, teamId: selectedTeamId } = useSelectedTeam();
  const createSession = useCreateDraftSessionMutation({ silent: true });
  const importDraft = useDraftImportMutation();
  const deleteSession = useDeleteDraftSessionMutation({ silent: true });

  const espnTeams = useMemo(
    () => teams.filter((t) => t.league_info?.provider === "espn"),
    [teams]
  );
  const otherTeams = teams.length - espnTeams.length;

  const [open, setOpen] = useState(false);
  const [teamValue, setTeamValue] = useState("");
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [failure, setFailure] = useState<ImportFailure | null>(null);

  useEffect(() => {
    // The selected team when it is an ESPN team, else the first one that is;
    // a choice already made is kept as long as it is still on offer.
    setTeamValue((current) => {
      if (espnTeams.some((t) => String(t.team_id) === current)) return current;
      const preferred = espnTeams.find((t) => t.team_id === selectedTeamId) ?? espnTeams[0];
      return preferred ? String(preferred.team_id) : "";
    });
  }, [espnTeams, selectedTeamId]);

  const team = espnTeams.find((t) => String(t.team_id) === teamValue) ?? null;
  const busy = phase !== "idle";

  const reset = () => {
    setName("");
    setPhase("idle");
    setFailure(null);
  };

  async function handleImport() {
    if (!team) return;
    setFailure(null);
    let sessionId: number | null = null;
    try {
      setPhase("creating");
      const session = await createSession.mutateAsync({
        name: name.trim() || null,
        team_id: team.team_id,
        kind: "import",
        draft_type: null,
        my_slot: null,
        rounds: null,
        pick_order: null,
        keepers: [],
      });
      sessionId = session.id;
      setPhase("importing");
      const result = await importDraft.mutateAsync(session.id);
      toast.success(
        `Imported ${result.inserted} pick${result.inserted === 1 ? "" : "s"} from ESPN draft ${result.espn_league_id}`,
        result.warnings.length > 0 ? { description: result.warnings.join(" · ") } : undefined
      );
      setOpen(false);
      reset();
      router.push(`/draft/${session.id}/recap`);
    } catch (error) {
      if (sessionId !== null) {
        // The refusal left an empty room behind; one click here recreates it.
        setPhase("cleaning");
        try {
          await deleteSession.mutateAsync(sessionId);
        } catch (cleanupError) {
          console.error("Import cleanup error:", cleanupError);
          toast.error(`Could not remove the empty room #${sessionId}`);
        }
      }
      setFailure(importFailure(error));
      setPhase("idle");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[11px]">
          <Download className="h-3 w-3" />
          Import a finished draft
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Import a finished draft</DialogTitle>
          <DialogDescription className="text-xs">
            Read a completed ESPN draft into a room and grade it. ESPN publishes the picks only
            once the draft is over, so an unfinished draft cannot be imported yet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Team</label>
            {espnTeams.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                None of your teams is in an ESPN league. Yahoo drafts cannot be imported yet.
              </p>
            ) : (
              <Select value={teamValue} onValueChange={setTeamValue} disabled={busy}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Choose a team" />
                </SelectTrigger>
                <SelectContent>
                  {espnTeams.map((t) => (
                    <SelectItem key={t.team_id} value={String(t.team_id)} className="text-xs">
                      <span className="flex w-full items-center">
                        <span className="mr-2 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                        <span className="truncate">{t.league_info?.team_name || "Unknown Team"}</span>
                        {scoringShortLabel(t.league) && (
                          <span className="ml-auto pl-2 font-mono text-[9px] text-muted-foreground/60">
                            {scoringShortLabel(t.league)}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {espnTeams.length > 0 && otherTeams > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Only ESPN teams are listed: Yahoo drafts cannot be imported yet.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Name (optional)</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 2026 draft"
              disabled={busy}
              className="h-8 text-xs"
            />
          </div>

          {failure && (
            <div
              role="alert"
              className="space-y-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-500"
            >
              <p>{failure.message}</p>
              {failure.existingSessionId !== null && (
                <Link
                  href={`/draft/${failure.existingSessionId}/recap`}
                  className="inline-block underline decoration-dotted underline-offset-2"
                  onClick={() => setOpen(false)}
                >
                  Open its recap
                </Link>
              )}
              {failure.reconnect && (
                <Link
                  href="/manage-teams"
                  className="inline-block underline decoration-dotted underline-offset-2"
                  onClick={() => setOpen(false)}
                >
                  Reconnect ESPN in Manage Teams
                </Link>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setOpen(false);
              reset();
            }}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleImport}
            disabled={busy || !team}
            className={cn(busy && "animate-pulse")}
          >
            {PHASE_LABEL[phase]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
