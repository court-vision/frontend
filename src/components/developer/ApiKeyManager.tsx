"use client";

import { useState } from "react";
import { Plus, Copy, Check, AlertTriangle, Key, Trash2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useApiKeysQuery,
  useCreateApiKeyMutation,
  useRevokeApiKeyMutation,
} from "@/hooks/useApiKeys";
import type { ApiKeyListItem } from "@/types/api-keys";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function RelativeTime({ dateStr }: { dateStr: string | null }) {
  if (!dateStr) return <span className="text-muted-foreground/50">Never</span>;
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let text: string;
  if (diffMins < 1) text = "Just now";
  else if (diffMins < 60) text = `${diffMins}m ago`;
  else if (diffHours < 24) text = `${diffHours}h ago`;
  else if (diffDays < 30) text = `${diffDays}d ago`;
  else text = formatDate(dateStr);

  return <span title={d.toISOString()}>{text}</span>;
}

export function ApiKeyManager() {
  const { data: keys, isLoading } = useApiKeysQuery();
  const createMutation = useCreateApiKeyMutation();
  const revokeMutation = useRevokeApiKeyMutation();

  const [createOpen, setCreateOpen] = useState(false);
  const [secretDialogOpen, setSecretDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyListItem | null>(null);

  // Create form state
  const [keyName, setKeyName] = useState("");
  const [scopeRead, setScopeRead] = useState(true);
  const [scopeAnalytics, setScopeAnalytics] = useState(false);
  const [scopeLive, setScopeLive] = useState(false);
  const [expiresIn, setExpiresIn] = useState("never");

  // Secret key after creation
  const [createdSecret, setCreatedSecret] = useState("");
  const [copied, setCopied] = useState(false);

  function resetCreateForm() {
    setKeyName("");
    setScopeRead(true);
    setScopeAnalytics(false);
    setScopeLive(false);
    setExpiresIn("never");
  }

  function handleCreate() {
    const scopes: string[] = ["read"];
    if (scopeAnalytics) scopes.push("analytics");
    if (scopeLive) scopes.push("live");

    let expires_days: number | null = null;
    if (expiresIn === "30") expires_days = 30;
    else if (expiresIn === "90") expires_days = 90;
    else if (expiresIn === "365") expires_days = 365;

    createMutation.mutate(
      { name: keyName, scopes, expires_days },
      {
        onSuccess: (data) => {
          setCreatedSecret(data.data.raw_key);
          setCreateOpen(false);
          setSecretDialogOpen(true);
          resetCreateForm();
        },
      }
    );
  }

  function handleRevoke() {
    if (!revokeTarget) return;
    revokeMutation.mutate(revokeTarget.id, {
      onSuccess: () => {
        setRevokeDialogOpen(false);
        setRevokeTarget(null);
      },
    });
  }

  function handleCopy() {
    navigator.clipboard.writeText(createdSecret);
    setCopied(true);
    toast.success("API key copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  const keyList = keys ?? [];

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Your API Keys</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Create and manage API keys for programmatic access.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-7 text-[11px] gap-1.5">
              <Plus className="h-3 w-3" />
              Create Key
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base">Create API Key</DialogTitle>
              <DialogDescription className="text-xs">
                Generate a new key for accessing the Court Vision API.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Key name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Key Name</label>
                <Input
                  placeholder="e.g. My Analytics App"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              {/* Scopes */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Scopes</label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="scope-read"
                      checked={scopeRead}
                      disabled
                      onCheckedChange={() => {}}
                    />
                    <label htmlFor="scope-read" className="text-xs">
                      <span className="font-medium">read</span>
                      <span className="text-muted-foreground ml-1.5">-- Access player stats, rankings, games, and schedules</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="scope-analytics"
                      checked={scopeAnalytics}
                      onCheckedChange={(checked) => setScopeAnalytics(checked === true)}
                    />
                    <label htmlFor="scope-analytics" className="text-xs">
                      <span className="font-medium">analytics</span>
                      <span className="text-muted-foreground ml-1.5">-- Access analytics features (lineup generation, breakout streamers)</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2 opacity-50">
                    <Checkbox
                      id="scope-live"
                      checked={scopeLive}
                      onCheckedChange={(checked) => setScopeLive(checked === true)}
                      disabled
                    />
                    <label htmlFor="scope-live" className="text-xs">
                      <span className="font-medium">live</span>
                      <span className="text-muted-foreground ml-1.5">-- Access live game data and real-time statistics</span>
                      <span className="text-muted-foreground/60 ml-1.5 italic">Coming soon</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Expiration */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Expires In</label>
                <Select value={expiresIn} onValueChange={setExpiresIn}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never" className="text-xs">Never</SelectItem>
                    <SelectItem value="30" className="text-xs">30 days</SelectItem>
                    <SelectItem value="90" className="text-xs">90 days</SelectItem>
                    <SelectItem value="365" className="text-xs">1 year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={handleCreate}
                disabled={!keyName.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create Key"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Keys table */}
      {isLoading ? (
        <div className="rounded-md border border-border bg-card/50 p-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs">
            <div className="h-3 w-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            Loading keys...
          </div>
        </div>
      ) : keyList.length === 0 ? (
        <div className="rounded-md border border-border bg-card/50 p-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="h-10 w-10 rounded-lg bg-muted/50 border border-border flex items-center justify-center">
              <Key className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs font-medium text-foreground">No API keys yet</p>
            <p className="text-[11px] text-muted-foreground max-w-xs">
              Create an API key to start making authenticated requests to the Court Vision API.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px]">Name</TableHead>
                <TableHead className="text-[10px]">Key</TableHead>
                <TableHead className="text-[10px]">Scopes</TableHead>
                <TableHead className="text-[10px]">Rate Limit</TableHead>
                <TableHead className="text-[10px]">Last Used</TableHead>
                <TableHead className="text-[10px]">Expires</TableHead>
                <TableHead className="text-[10px]">Status</TableHead>
                <TableHead className="text-[10px] w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {keyList.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="text-xs font-medium py-2">{key.name}</TableCell>
                  <TableCell className="py-2">
                    <code className="font-mono text-[11px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                      {key.key_prefix}...
                    </code>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex gap-1">
                      {key.scopes.map((scope) => (
                        <Badge
                          key={scope}
                          variant={scope === "analytics" || scope === "live" ? "default" : "neutral"}
                          className="text-[9px] px-1 py-0"
                        >
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground font-mono py-2">
                    {key.rate_limit}/min
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground py-2">
                    <RelativeTime dateStr={key.last_used_at} />
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground py-2">
                    {key.expires_at ? formatDate(key.expires_at) : "Never"}
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge
                      variant={key.is_active ? "win" : "loss"}
                      className="text-[9px] px-1 py-0"
                    >
                      {key.is_active ? "Active" : "Revoked"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2">
                    {key.is_active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setRevokeTarget(key);
                          setRevokeDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Secret key dialog (shown after creation) */}
      <Dialog open={secretDialogOpen} onOpenChange={setSecretDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              API Key Created
            </DialogTitle>
            <DialogDescription className="text-xs">
              Copy your key now. It will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-[11px] bg-muted/80 border border-border rounded-md px-3 py-2.5 break-all select-all">
                {createdSecret}
              </code>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 shrink-0"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-200/80">
                This key will only be shown once. Copy it now and store it securely. If you lose it, you will need to create a new key.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => setSecretDialogOpen(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation dialog */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Revoke API Key</DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to revoke <span className="font-medium text-foreground">{revokeTarget?.name}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setRevokeDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-8 text-xs"
              onClick={handleRevoke}
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending ? "Revoking..." : "Revoke Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
