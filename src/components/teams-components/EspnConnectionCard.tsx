"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-error";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useConnectEspnMutation,
  useConnectionsQuery,
  useDeleteConnectionMutation,
  useVerifyConnectionMutation,
} from "@/hooks/useConnections";
import { userMessage } from "@/lib/api-error";
import {
  accountLabel,
  connectionFreshness,
  espnConnections,
  swidHint,
  teamCount,
} from "@/lib/connections";
import { decodeSwid, type EspnCookies } from "@/lib/espn-cookies";
import { cn } from "@/lib/utils";
import type { ProviderConnection } from "@/types/connections";
import { ConnectionStatusBadge } from "./ConnectionStatusBadge";
import { EspnBookmarkletStep, EspnCookiePaste } from "./EspnCookieInputs";

/**
 * The ESPN account whose cookies the user's ESPN teams share: whether ESPN
 * still accepts them, a one-click re-check, and the one place to paste fresh
 * cookies when ESPN rotates them — every team on the account picks them up.
 */
export function EspnConnectionCard() {
  const { data, isLoading, error, refetch, isFetching } = useConnectionsQuery();
  const connections = espnConnections(data);
  const [dialog, setDialog] = useState<{ open: boolean; refreshing: ProviderConnection | null }>({
    open: false,
    refreshing: null,
  });
  const [removing, setRemoving] = useState<ProviderConnection | null>(null);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-orange-500" />
            ESPN account
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your espn_s2 and SWID cookies, saved once and shared by every ESPN team on the account.
          </p>
        </div>

        {isLoading ? (
          <Skeleton className="h-16 w-full rounded-md" />
        ) : error && !data ? (
          <QueryErrorState error={error} onRetry={() => refetch()} isRetrying={isFetching} compact />
        ) : connections.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed p-3">
            <p className="text-sm text-muted-foreground max-w-prose">
              Connect once and every ESPN team you add uses these cookies. When ESPN
              rotates them, one refresh here fixes all of those teams.
            </p>
            <Button type="button" size="sm" onClick={() => setDialog({ open: true, refreshing: null })}>
              Connect ESPN
            </Button>
          </div>
        ) : (
          connections.map((connection) => (
            <ConnectionRow
              key={connection.id}
              connection={connection}
              onUpdate={() => setDialog({ open: true, refreshing: connection })}
              onRemove={() => setRemoving(connection)}
            />
          ))
        )}
      </CardContent>

      <EspnConnectDialog
        open={dialog.open}
        refreshing={dialog.refreshing}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
      <RemoveConnectionDialog
        connection={removing}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
      />
    </Card>
  );
}

function ConnectionRow({
  connection,
  onUpdate,
  onRemove,
}: {
  connection: ProviderConnection;
  onUpdate: () => void;
  onRemove: () => void;
}) {
  const { mutate: verify, isPending: checking } = useVerifyConnectionMutation();
  const expired = connection.status === "expired";
  const n = connection.teams.length;

  return (
    <div className={cn("rounded-md border p-3", expired && "border-status-loss/30 bg-status-loss/5")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{accountLabel(connection)}</span>
            <ConnectionStatusBadge status={connection.status} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {/* Court Vision teams reading ESPN with these cookies — not ESPN's own list */}
            {n === 0 ? "No teams use it yet" : `Used by ${teamCount(n)}`} · {connectionFreshness(connection)}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            disabled={checking}
            onClick={() => verify(connection.id)}
          >
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Check"}
          </Button>
          <Button
            type="button"
            variant={expired ? "default" : "outline"}
            size="sm"
            className="text-xs"
            onClick={onUpdate}
          >
            Update cookies
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            aria-label={`Remove ${accountLabel(connection)}`}
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {expired && (
        <p className="text-xs text-status-loss mt-2">
          ESPN rejected these cookies. Paste fresh ones
          {n > 0 && ` to fix ${n === 1 ? "your team" : `all ${n} teams`} at once`}.
        </p>
      )}
      {n > 0 && (
        <p className="text-xs text-muted-foreground mt-1.5 truncate">
          {connection.teams.map((t) => t.team_name).join(" · ")}
        </p>
      )}
    </div>
  );
}

function EspnConnectDialog({
  open,
  refreshing,
  onOpenChange,
}: {
  open: boolean;
  refreshing: ProviderConnection | null;
  onOpenChange: (open: boolean) => void;
}) {
  const n = refreshing?.teams.length ?? 0;
  const description = !refreshing
    ? "Paste your espn_s2 and SWID cookies once. Every ESPN team you add uses them, and ESPN checks them before they're saved."
    : n === 0
      ? `Paste fresh cookies for ${accountLabel(refreshing)}. ESPN checks them before they're saved.`
      : `Fresh cookies for ${accountLabel(refreshing)} reach ${n === 1 ? "its team" : `all ${n} of its teams`} at once. ESPN checks them before they're saved.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{refreshing ? "Update ESPN cookies" : "Connect your ESPN account"}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <EspnConnectForm refreshing={refreshing} onConnected={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Paste an ESPN account's cookies and connect it — or, with `refreshing`,
 * replace that account's cookies. ESPN checks them before anything is saved,
 * and a refusal is shown here rather than as a toast.
 */
export function EspnConnectForm({
  refreshing = null,
  onConnected,
}: {
  refreshing?: ProviderConnection | null;
  onConnected?: (connection: ProviderConnection | null) => void;
}) {
  const [tab, setTab] = useState<"paste" | "manual">("paste");
  const [pasted, setPasted] = useState<EspnCookies | null>(null);
  const [manual, setManual] = useState({ s2: "", swid: "" });
  const { mutate: connect, isPending, error, reset } = useConnectEspnMutation();

  const cookies: EspnCookies | null =
    tab === "paste"
      ? pasted
      : manual.s2.trim() && manual.swid.trim()
        ? { s2: manual.s2.trim(), swid: decodeSwid(manual.swid.trim()) }
        : null;
  // A pair for another account adds that account instead of refreshing this one
  const pastedHint = cookies ? swidHint(cookies.swid) : null;
  const otherAccount =
    refreshing?.account_hint && pastedHint && pastedHint !== refreshing.account_hint ? pastedHint : null;

  const submit = () => {
    if (!cookies) return;
    connect(
      { espn_s2: cookies.s2, swid: cookies.swid },
      { onSuccess: (response) => onConnected?.(response.data ?? null) }
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <EspnBookmarkletStep />

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value as "paste" | "manual");
          reset();
        }}
        className="w-full"
      >
        <TabsList className="w-full">
          <TabsTrigger value="paste" className="flex-1">
            Paste Cookies
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex-1">
            Manual Entry
          </TabsTrigger>
        </TabsList>
        <TabsContent value="paste" className="space-y-3">
          <EspnCookiePaste
            onParsed={(parsed) => {
              setPasted(parsed);
              reset();
            }}
          />
        </TabsContent>
        <TabsContent value="manual" className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="espn-connect-s2">ESPN s2</Label>
            <Input
              id="espn-connect-s2"
              placeholder="espn_s2"
              value={manual.s2}
              onChange={(e) => {
                setManual((m) => ({ ...m, s2: e.target.value }));
                reset();
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="espn-connect-swid">SWID</Label>
            <Input
              id="espn-connect-swid"
              placeholder="{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}"
              value={manual.swid}
              onChange={(e) => {
                setManual((m) => ({ ...m, swid: e.target.value }));
                reset();
              }}
            />
          </div>
        </TabsContent>
      </Tabs>

      {otherAccount && (
        <p className="text-xs text-muted-foreground">
          These cookies belong to a different ESPN account ({otherAccount}). Saving adds it
          alongside {refreshing?.account_hint} instead of refreshing it.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-status-loss">
          {userMessage(error, "Couldn't connect your ESPN account")}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={submit} disabled={!cookies || isPending}>
          {isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Checking with ESPN…
            </>
          ) : refreshing ? (
            "Update cookies"
          ) : (
            "Connect ESPN"
          )}
        </Button>
      </div>
    </div>
  );
}

function RemoveConnectionDialog({
  connection,
  onOpenChange,
}: {
  connection: ProviderConnection | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { mutate: remove, isPending } = useDeleteConnectionMutation();
  const n = connection?.teams.length ?? 0;

  return (
    <Dialog open={connection !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {connection ? accountLabel(connection) : "ESPN account"}?</DialogTitle>
          <DialogDescription>
            {n === 0
              ? "No teams use these cookies."
              : `${teamCount(n)} will lose ${n === 1 ? "its" : "their"} cookies. Public leagues keep working; private ones need cookies again before Court Vision can read them.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" className="mr-2" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              if (connection) remove(connection.id, { onSettled: () => onOpenChange(false) });
            }}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
