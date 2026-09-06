"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { ArrowRight, CheckCircle2, MoreHorizontal, Pencil, Swords, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/relative-time";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-error";
import { CreateSessionDialog } from "@/components/draft/CreateSessionDialog";
import {
  useDeleteDraftSessionMutation,
  useDraftSessionsQuery,
  useUpdateDraftSessionMutation,
} from "@/hooks/useDrafts";
import type { DraftKind, DraftSession, DraftStatus } from "@/types/draft";

const STATUS_CLASSES: Record<DraftStatus, string> = {
  active: "border-green-500/40 bg-green-500/10 text-green-500",
  completed: "border-border bg-muted text-muted-foreground",
  abandoned: "border-border bg-muted text-muted-foreground/70",
};

const KIND_LABEL: Record<DraftKind, string> = {
  live: "live",
  mock: "mock",
  manual: "manual",
  import: "import",
};

/** A room's title: its name, else what kind of room it is. */
export function sessionTitle(session: Pick<DraftSession, "id" | "name" | "kind">): string {
  if (session.name) return session.name;
  if (session.kind === "mock") return "Mock draft";
  if (session.kind === "live") return "Live draft";
  return `Draft #${session.id}`;
}

/** API timestamps: ISO with an offset, or naive UTC — never local time. */
function apiTime(value: string | null | undefined): number {
  if (!value) return 0;
  const zoned = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
  const ms = Date.parse(zoned);
  return Number.isNaN(ms) ? 0 : ms;
}

function RenameDialog({
  session,
  open,
  onOpenChange,
}: {
  session: DraftSession;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(session.name ?? "");
  const update = useUpdateDraftSessionMutation(session.id);

  function save() {
    update.mutate({ name: name.trim() || null }, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Rename draft room</DialogTitle>
          <DialogDescription className="text-xs">An empty name goes back to the default.</DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          placeholder={sessionTitle({ ...session, name: null })}
          className="h-8 text-xs"
        />
        <DialogFooter>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={save} disabled={update.isPending}>
            {update.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  session,
  open,
  onOpenChange,
}: {
  session: DraftSession;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const remove = useDeleteDraftSessionMutation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Delete “{sessionTitle(session)}”?</DialogTitle>
          <DialogDescription className="text-xs">
            The room and its {session.pick_count} recorded pick{session.pick_count === 1 ? "" : "s"} are removed.
            There is no undo.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
            Keep it
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-8 text-xs"
            disabled={remove.isPending}
            onClick={() => remove.mutate(session.id, { onSuccess: () => onOpenChange(false) })}
          >
            {remove.isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SessionCard({ session }: { session: DraftSession }) {
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const finish = useUpdateDraftSessionMutation(session.id);

  const progress =
    session.total_picks && session.total_picks > 0
      ? Math.round((session.pick_count / session.total_picks) * 100)
      : null;

  // The whole card is a link; the menu must not follow it.
  const stop = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const when =
    session.status === "completed" && session.completed_at
      ? `finished ${formatRelativeTime(apiTime(session.completed_at))}`
      : session.updated_at && apiTime(session.updated_at) - apiTime(session.created_at) > 60_000
        ? `updated ${formatRelativeTime(apiTime(session.updated_at))}`
        : `created ${formatRelativeTime(apiTime(session.created_at))}`;

  return (
    <>
      <Link href={`/draft/${session.id}`} className="block">
        <Card
          variant="panel"
          className="group flex items-center gap-3 p-3 transition-colors hover:border-primary/40"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{sessionTitle(session)}</span>
              <span
                className={cn(
                  "shrink-0 rounded border px-1.5 text-[9px] uppercase",
                  STATUS_CLASSES[session.status]
                )}
              >
                {session.status}
              </span>
              <span className="shrink-0 rounded border border-border px-1.5 font-mono text-[9px] uppercase text-muted-foreground">
                {KIND_LABEL[session.kind]}
              </span>
              <span className="shrink-0 font-mono text-[9px] uppercase text-muted-foreground/60">
                {session.draft_type}
              </span>
            </div>

            <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
              <span>
                {session.pick_count}
                {session.total_picks ? ` / ${session.total_picks}` : ""} picks
              </span>
              {session.league_size && (
                <>
                  <span className="text-border">·</span>
                  <span>{session.league_size} teams</span>
                </>
              )}
              {session.my_slot ? (
                <>
                  <span className="text-border">·</span>
                  <span>slot {session.my_slot}</span>
                </>
              ) : (
                <>
                  <span className="text-border">·</span>
                  <span className="text-amber-500">no slot set</span>
                </>
              )}
              {progress !== null && (
                <>
                  <span className="text-border">·</span>
                  <span>{progress}%</span>
                </>
              )}
              {session.espn_league_id != null && (
                <>
                  <span className="text-border">·</span>
                  <span title="The ESPN draft this room follows">ESPN {session.espn_league_id}</span>
                </>
              )}
              <span className="text-border">·</span>
              <span className="text-muted-foreground/70">{when}</span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={stop}
                aria-label="Draft room actions"
                className="rounded p-1 text-muted-foreground opacity-60 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={stop} className="text-xs">
              <DropdownMenuItem onSelect={() => setRenaming(true)} className="gap-2 text-xs">
                <Pencil className="h-3 w-3" />
                Rename
              </DropdownMenuItem>
              {session.status === "active" && (
                <DropdownMenuItem
                  onSelect={() => finish.mutate({ status: "completed" })}
                  className="gap-2 text-xs"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Finish draft
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setDeleting(true)}
                className="gap-2 text-xs text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
        </Card>
      </Link>

      {renaming && <RenameDialog session={session} open={renaming} onOpenChange={setRenaming} />}
      {deleting && <DeleteDialog session={session} open={deleting} onOpenChange={setDeleting} />}
    </>
  );
}

export default function DraftSessions() {
  const { isSignedIn, isLoaded } = useUser();
  const { data: sessions = [], isLoading, error, refetch, isFetching } = useDraftSessionsQuery();

  const pageHeader = (
    <section className="flex items-center justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Draft Lab</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Your draft rooms — board, recommendations and pick tracking for draft day.
        </p>
      </div>
      {isSignedIn && <CreateSessionDialog />}
    </section>
  );

  if (!isLoaded || (isSignedIn && isLoading)) {
    return (
      <div className="space-y-4 animate-slide-up-fade">
        {pageHeader}
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="space-y-4 animate-slide-up-fade">
        {pageHeader}
        <Card variant="panel" className="p-8">
          <p className="text-center text-sm text-muted-foreground">
            Please sign in to open a draft room.
          </p>
        </Card>
      </div>
    );
  }

  if (error && sessions.length === 0) {
    return (
      <div className="space-y-4 animate-slide-up-fade">
        {pageHeader}
        <Card variant="panel">
          <QueryErrorState error={error} onRetry={() => refetch()} isRetrying={isFetching} />
        </Card>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="space-y-4 animate-slide-up-fade">
        {pageHeader}
        <Card variant="panel" className="flex flex-col items-center gap-2 p-8 text-center">
          <Swords className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm font-medium">No draft rooms yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Start one from a synced team and the draft type, pick order and rounds are prefilled
            from its league — you only confirm which seat is yours.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up-fade">
      {pageHeader}
      <div className="space-y-2">
        {sessions.map((session) => (
          <SessionCard key={session.id} session={session} />
        ))}
      </div>
    </div>
  );
}
