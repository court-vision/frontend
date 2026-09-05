"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { toApiError } from "@/lib/api-error";
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

const NO_TEAM = "none";

/** Where the picks come from — the one choice that shapes everything else about a room. */
const SOURCES: { value: DraftKind; label: string; help: string }[] = [
  {
    value: "live",
    label: "This league's ESPN draft",
    help: "Picks arrive from your league's ESPN draft room through the Draft Tap. The room is linked to that league from the start.",
  },
  {
    value: "mock",
    label: "An ESPN mock lobby",
    help: "Join any ESPN mock draft with these settings. The room links to the lobby when it opens, and follows only that one.",
  },
  {
    value: "manual",
    label: "I enter every pick",
    help: "Nothing connects to ESPN; you record picks as they happen.",
  },
];

/**
 * Start a draft room. Two questions decide its shape: whose settings it uses
 * (a team's league, or generic ones) and where its picks come from (this
 * league's own ESPN draft, an ESPN mock lobby, or you). Everything the provider
 * told us is prefilled from the league — draft type, pick order, rounds, keeper
 * allowance — so the one thing the form must ask is which seat is yours:
 * `pick_order` holds ESPN team ids that do not map back to our teams.
 */
export function CreateSessionDialog() {
  const router = useRouter();
  const { teams, teamId: selectedTeamId } = useSelectedTeam();
  const createSession = useCreateDraftSessionMutation();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [teamValue, setTeamValue] = useState<string>(
    selectedTeamId !== null ? String(selectedTeamId) : NO_TEAM
  );
  const [source, setSource] = useState<DraftKind>("mock");
  const [draftType, setDraftType] = useState<DraftType | "">("");
  const [mySlot, setMySlot] = useState("");
  const [rounds, setRounds] = useState("");
  const [existingRoom, setExistingRoom] = useState<number | null>(null);

  useEffect(() => {
    setTeamValue(selectedTeamId !== null ? String(selectedTeamId) : NO_TEAM);
  }, [selectedTeamId]);

  const team = useMemo(
    () => teams.find((t) => String(t.team_id) === teamValue) ?? null,
    [teams, teamValue]
  );
  const isEspnTeam = team?.league_info?.provider === "espn";

  // A live room can only follow an ESPN league's own draft; every other
  // combination practises in a mock lobby or is entered by hand.
  const sources = useMemo(
    () => SOURCES.filter((s) => s.value !== "live" || isEspnTeam),
    [isEspnTeam]
  );
  useEffect(() => {
    if (!sources.some((s) => s.value === source)) setSource(isEspnTeam ? "live" : "mock");
  }, [sources, source, isEspnTeam]);
  useEffect(() => {
    // The team just changed: the sensible default follows it.
    setSource(isEspnTeam ? "live" : "mock");
    setExistingRoom(null);
  }, [teamValue, isEspnTeam]);

  // `draft_settings` lives on the league *detail*, not the summary embedded in
  // the team row — so the picked team's league is fetched to size the slot
  // picker. Without a synced league the user types a slot instead.
  const { data: league, isPending: leagueLoading } = useTeamLeagueQuery(team?.team_id ?? null);
  const leagueSize = useMemo(() => {
    const order = league?.draft_settings?.pick_order;
    return Array.isArray(order) ? order.length : 0;
  }, [league]);

  // A league still loading looks exactly like a league with no pick order —
  // `league` is undefined either way — so the requirement below cannot be
  // decided yet. Switching teams re-enters this state, which is where a room
  // could otherwise be created slot-less in the moment before its seats
  // arrive. (A *failed* query is not pending: we genuinely cannot offer seats
  // then, so it falls through to optional and the room can set the slot later.)
  const leagueUnknown = team !== null && leagueLoading;

  // Required once there are seats to choose from. A room opened without a slot
  // cannot say whose turn it is or price a keeper, and the seat list is the
  // one thing the provider cannot tell us — so this is the moment to ask.
  // With no pick order there are no seats and the answer would mean nothing
  // yet, so it stays optional there and the room can set it later.
  const slotRequired = leagueSize > 0;
  const slotMissing = slotRequired && mySlot === "";
  const cannotCreateYet = slotMissing || leagueUnknown;

  function reset() {
    setName("");
    setTeamValue(selectedTeamId !== null ? String(selectedTeamId) : NO_TEAM);
    setDraftType("");
    setMySlot("");
    setRounds("");
    setExistingRoom(null);
  }

  function handleCreate() {
    setExistingRoom(null);
    createSession.mutate(
      {
        name: name.trim() || null,
        team_id: teamValue === NO_TEAM ? null : Number(teamValue),
        kind: source,
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
        onError: (error) => {
          // One live room per league: point at the one that exists.
          const api = toApiError(error);
          const existing = (api.data as { existing_session_id?: number } | null)?.existing_session_id;
          if (api.code === "DRAFT_ROOM_ALREADY_LINKED" && existing) setExistingRoom(existing);
        },
      }
    );
  }

  const sourceHelp = sources.find((s) => s.value === source)?.help;

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
            Whose settings the room uses, and where its picks come from. Draft type, pick order and
            rounds are prefilled from the league.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Settings from</label>
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
                <SelectItem value={NO_TEAM} className="text-xs">
                  No league — generic settings
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
            <label className="text-xs font-medium text-muted-foreground">Picks from</label>
            <Select value={source} onValueChange={(v) => setSource(v as DraftKind)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sources.map((s) => (
                  <SelectItem key={s.value} value={s.value} className="text-xs">
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sourceHelp && <p className="text-[10px] text-muted-foreground">{sourceHelp}</p>}
            {existingRoom !== null && (
              <p className="flex items-center gap-2 text-[10px] text-amber-500">
                You already have a live room for this league.
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    reset();
                    router.push(`/draft/${existingRoom}`);
                  }}
                  className="underline decoration-dotted underline-offset-2 hover:text-amber-400"
                >
                  Open Draft #{existingRoom}
                </button>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder={source === "mock" ? "e.g. Tuesday practice" : "Optional"}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Your slot{slotRequired && <span className="ml-0.5 text-amber-500">*</span>}
            </label>
            {leagueUnknown ? (
              <Input disabled placeholder="Checking league settings..." className="h-8 text-xs" />
            ) : leagueSize > 0 ? (
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
            <p className={cn("text-[10px]", slotMissing ? "text-amber-500" : "text-muted-foreground")}>
              {leagueUnknown
                ? "Reading this league's draft settings to find its seats..."
                : slotMissing
                  ? "Pick your seat — the room needs it to say whose turn it is."
                  : slotRequired
                    ? "ESPN's pick order uses its own team ids, so we cannot tell which seat is yours."
                    : source === "manual"
                      ? "Optional until this draft has a pick order; you can set it in the room."
                      : "Optional: the ESPN room fills the pick order and your seat in when it opens."}
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
        </div>

        <DialogFooter>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleCreate}
            disabled={createSession.isPending || cannotCreateYet}
            title={
              leagueUnknown
                ? "Waiting for this league's draft settings"
                : slotMissing
                  ? "Pick your slot first"
                  : undefined
            }
          >
            {createSession.isPending ? "Creating..." : "Start drafting"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
