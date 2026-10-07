"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { DraftBoardRow, DraftKeeper, DraftSession } from "@/types/draft";

/**
 * Pre-designate keepers. Saved whole with a PATCH: a keeper is identity plus
 * the round it costs, and the session prices it into a pick number on read.
 * Recording keepers as picks is a separate step in the roster zone, so
 * editing the list never touches the draft record.
 */
interface KeeperEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: DraftSession;
  /** Board rows to search — the players still available to keep. */
  rows: DraftBoardRow[];
  onSave: (keepers: DraftKeeper[]) => void;
  isSaving: boolean;
  /** Hands off to the slot editor — keepers cannot be priced without a slot. */
  onEditSlot?: () => void;
}

function fromSession(session: DraftSession): DraftKeeper[] {
  return session.keepers.map((k) => ({
    player_id: k.player_id ?? null,
    espn_player_id: k.espn_player_id ?? null,
    name: k.name ?? null,
    round: k.round ?? null,
  }));
}

export function KeeperEditor({
  open,
  onOpenChange,
  session,
  rows,
  onSave,
  isSaving,
  onEditSlot,
}: KeeperEditorProps) {
  const [keepers, setKeepers] = useState<DraftKeeper[]>(() => fromSession(session));
  const [query, setQuery] = useState("");

  // Reopening starts from what the session holds, not from a stale edit.
  useEffect(() => {
    if (open) {
      setKeepers(fromSession(session));
      setQuery("");
    }
  }, [open, session]);

  const taken = useMemo(
    () => new Set(keepers.map((k) => k.player_id).filter((id): id is number => id != null)),
    [keepers]
  );
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    return rows
      .filter((row) => !taken.has(row.player_id) && row.name.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [rows, query, taken]);

  const allowance = session.keeper_count;
  const overAllowance = allowance != null && keepers.length > allowance;

  function add(row: DraftBoardRow) {
    setKeepers((list) => [
      ...list,
      { player_id: row.player_id, espn_player_id: row.espn_id ?? null, name: row.name, round: null },
    ]);
    setQuery("");
  }

  function setRound(index: number, value: string) {
    const round = value === "" ? null : Math.max(1, Math.floor(Number(value)));
    setKeepers((list) => list.map((k, i) => (i === index ? { ...k, round } : k)));
  }

  function remove(index: number) {
    setKeepers((list) => list.filter((_, i) => i !== index));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Keepers</DialogTitle>
          <DialogDescription className="text-xs">
            Who you are keeping and the round each one costs. Record them from the roster zone
            once the list is right — each takes your pick in its round and leaves the board.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="relative">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Add a keeper by name..."
              className="h-8 text-xs font-mono"
              autoFocus
            />
            {results.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-border bg-popover py-1 shadow-lg">
                {results.map((row) => (
                  <button
                    key={row.player_id}
                    onClick={() => add(row)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted"
                  >
                    <Plus className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{row.name}</span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                      {[row.primary_position ?? row.position, row.team].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {keepers.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No keepers yet.</p>
          ) : (
            <div className="space-y-1">
              {keepers.map((keeper, index) => (
                <div
                  key={`${keeper.player_id ?? keeper.name ?? index}`}
                  className="flex items-center gap-2 rounded border border-border/50 px-2 py-1"
                >
                  <span className="min-w-0 flex-1 truncate text-xs">
                    {keeper.name ?? `Player ${keeper.player_id ?? "?"}`}
                  </span>
                  <label className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                    R
                    <Input
                      type="number"
                      min={1}
                      max={session.rounds ?? 40}
                      value={keeper.round ?? ""}
                      onChange={(e) => setRound(index, e.target.value)}
                      placeholder="?"
                      aria-label={`Round ${keeper.name ?? ""} costs`}
                      className="h-6 w-14 px-1.5 text-center text-xs"
                    />
                  </label>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(index)}
                    title="Remove keeper"
                    className="h-6 w-6"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <p className={cn("font-mono text-[10px]", overAllowance ? "text-amber-500" : "text-muted-foreground")}>
            {keepers.length}
            {allowance != null ? ` of ${allowance} the league allows` : " keepers"}
            {session.my_slot == null && (
              <>
                {" · "}
                {onEditSlot ? (
                  <button
                    onClick={onEditSlot}
                    className="text-amber-500 underline decoration-dotted underline-offset-2 hover:text-amber-400"
                  >
                    set your slot
                  </button>
                ) : (
                  <span className="text-amber-500">set your slot</span>
                )}
                {" to price them into picks"}
              </>
            )}
          </p>
        </div>

        <DialogFooter>
          <Button
            size="sm"
            className="h-8 text-xs"
            disabled={isSaving}
            onClick={() => onSave(keepers)}
          >
            {isSaving ? "Saving..." : "Save keepers"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
