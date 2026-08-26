"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-error";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogHeader,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  useAddTeamMutation,
  useDeleteTeamMutation,
  useTeamsQuery,
  useUpdateTeamMutation,
} from "@/hooks/useTeams";
import { useYahooAuthUrl, useYahooLeagues, useYahooTeams } from "@/hooks/useYahoo";
import { normalizeProviderScoringType } from "@/lib/category-format";
import { cn } from "@/lib/utils";
import { TeamCard } from "./TeamCard";
import {
  EspnTeamFormFields,
  espnFormDefaults,
  espnTeamFormSchema,
  toScoringPreview,
  type EspnTeamFormValues,
} from "./EspnTeamFormFields";
import type { YahooOAuthState, YahooLeague, YahooTeam } from "@/types/yahoo";
import type { LeagueInfo, TeamResponseData } from "@/types/team";

interface ManageTeamsTableProps {
  yahooOAuthState?: YahooOAuthState | null;
  /** Open the Add Team dialog immediately (e.g. `/manage-teams?add=1`). */
  autoOpenAdd?: boolean;
}

export function ManageTeamsTable({ yahooOAuthState, autoOpenAdd = false }: ManageTeamsTableProps) {
  const { data, isLoading, error, refetch, isFetching } = useTeamsQuery();
  const teams = data ?? [];
  const [editingTeam, setEditingTeam] = useState<TeamResponseData | null>(null);
  const [deletingTeamId, setDeletingTeamId] = useState<number | null>(null);

  // First-run: a user with no teams lands straight in the Add dialog. A Yahoo
  // OAuth return also reopens it so the league/team picker is right there.
  const shouldAutoOpen =
    autoOpenAdd || !!yahooOAuthState || (!isLoading && !error && teams.length === 0);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-[150px] w-full rounded-md" />)
        ) : error && !data ? (
          // A failed fetch is an error state with Retry, never an empty table.
          <Card className="md:col-span-2">
            <QueryErrorState
              error={error}
              onRetry={() => refetch()}
              isRetrying={isFetching}
              compact
            />
          </Card>
        ) : (
          teams.map((team) => (
            <TeamCard
              key={team.team_id}
              team={team}
              onEdit={(t) => setEditingTeam(t)}
              onDelete={(id) => setDeletingTeamId(id)}
            />
          ))
        )}
        <AddTeamCard yahooOAuthState={yahooOAuthState} defaultOpen={shouldAutoOpen} />
      </div>

      <EditTeamDialog
        team={editingTeam}
        onOpenChange={(open) => {
          if (!open) setEditingTeam(null);
        }}
      />

      <DeleteTeamDialog
        teamId={deletingTeamId}
        onOpenChange={(open) => {
          if (!open) setDeletingTeamId(null);
        }}
      />
    </>
  );
}

function AddTeamCard({
  yahooOAuthState,
  defaultOpen,
}: {
  yahooOAuthState?: YahooOAuthState | null;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className="border-dashed border-2 bg-transparent cursor-pointer hover:border-primary/50 transition-colors">
          <CardContent className="p-4 flex items-center justify-center h-full min-h-[120px]">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Plus className="h-6 w-6" />
              <span className="text-sm font-medium">Add Team</span>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Team</DialogTitle>
          <DialogDescription>
            Connect your fantasy basketball team. We&apos;ll detect whether your
            league scores by points or categories.
          </DialogDescription>
        </DialogHeader>
        <AddTeamFormContent
          yahooOAuthState={yahooOAuthState}
          onAdded={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function DeleteTeamDialog({
  teamId,
  onOpenChange,
}: {
  teamId: number | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { mutate: deleteTeam, isPending } = useDeleteTeamMutation();

  return (
    <Dialog open={teamId !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Team</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this team? Saved lineups and
            notification overrides for it will be removed too.
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
              if (teamId !== null) {
                deleteTeam(teamId, { onSettled: () => onOpenChange(false) });
              }
            }}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditTeamDialog({
  team,
  onOpenChange,
}: {
  team: TeamResponseData | null;
  onOpenChange: (open: boolean) => void;
}) {
  if (!team) return null;

  return (
    <Dialog open={team !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Team</DialogTitle>
          <DialogDescription>Edit the information of your team.</DialogDescription>
        </DialogHeader>
        <EditTeamFormContent
          key={team.team_id}
          team_id={team.team_id}
          team_info={team.league_info}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function AddTeamFormContent({
  yahooOAuthState,
  onAdded,
}: {
  yahooOAuthState?: YahooOAuthState | null;
  onAdded?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"espn" | "yahoo">("espn");

  useEffect(() => {
    if (yahooOAuthState) {
      setActiveTab("yahoo");
    }
  }, [yahooOAuthState]);

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "espn" | "yahoo")}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="espn" className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-orange-500" />
          ESPN
        </TabsTrigger>
        <TabsTrigger value="yahoo" className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-purple-500" />
          Yahoo
        </TabsTrigger>
      </TabsList>

      <TabsContent value="espn">
        <EspnAddTeamForm onAdded={onAdded} />
      </TabsContent>

      <TabsContent value="yahoo">
        <YahooAddTeamFlow yahooOAuthState={yahooOAuthState} onAdded={onAdded} />
      </TabsContent>
    </Tabs>
  );
}

function EspnAddTeamForm({ onAdded }: { onAdded?: () => void }) {
  const { mutate: addTeam, isPending } = useAddTeamMutation();
  const [fieldsKey, setFieldsKey] = useState(0);

  const form = useForm<EspnTeamFormValues>({
    resolver: zodResolver(espnTeamFormSchema),
    defaultValues: espnFormDefaults(),
  });

  const handleClear = () => {
    form.reset(espnFormDefaults());
    setFieldsKey((k) => k + 1);
  };

  const handleSubmit = (values: EspnTeamFormValues) => {
    addTeam(
      {
        provider: "espn",
        league_id: parseInt(values.leagueID),
        team_name: values.teamName,
        year: parseInt(values.leagueYear),
        league_name: values.leagueName || undefined,
        espn_s2: values.s2 || undefined,
        swid: values.swid || undefined,
      },
      {
        onSuccess: (response) => {
          if (response.status === "success") {
            handleClear();
            onAdded?.();
          }
        },
      }
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-3 pt-4">
        <EspnTeamFormFields key={fieldsKey} form={form} required />

        <div className="flex justify-between pt-1">
          <Button type="button" variant="outline" size="sm" onClick={handleClear} disabled={isPending}>
            Clear
          </Button>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Adding…
              </>
            ) : (
              "Add Team"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

interface YahooAddTeamFlowProps {
  yahooOAuthState?: YahooOAuthState | null;
  onAdded?: () => void;
}

function YahooAddTeamFlow({ yahooOAuthState, onAdded }: YahooAddTeamFlowProps) {
  const [step, setStep] = useState<"connect" | "select-league" | "select-team">(
    yahooOAuthState ? "select-league" : "connect"
  );
  const [selectedLeague, setSelectedLeague] = useState<YahooLeague | null>(null);

  const { refetch: fetchAuthUrl, isFetching: isLoadingAuthUrl } = useYahooAuthUrl();
  const { data: leagues, isLoading: isLoadingLeagues } = useYahooLeagues(
    yahooOAuthState?.accessToken || null
  );
  const { data: teams, isLoading: isLoadingTeams } = useYahooTeams(
    yahooOAuthState?.accessToken || null,
    selectedLeague?.league_key || null
  );

  const { mutate: addTeam, isPending } = useAddTeamMutation();

  useEffect(() => {
    if (yahooOAuthState) {
      setStep("select-league");
    }
  }, [yahooOAuthState]);

  const handleConnectClick = async () => {
    try {
      const result = await fetchAuthUrl();
      if (result.data) {
        window.location.href = result.data;
      }
    } catch {
      toast.error("Failed to connect to Yahoo. Please try again.");
    }
  };

  const handleLeagueSelect = (league: YahooLeague) => {
    setSelectedLeague(league);
    setStep("select-team");
  };

  const handleTeamSelect = (team: YahooTeam) => {
    if (!yahooOAuthState || !selectedLeague) return;

    addTeam(
      {
        provider: "yahoo",
        league_id: parseInt(selectedLeague.league_id),
        team_name: team.name,
        league_name: selectedLeague.name,
        year: parseInt(selectedLeague.season),
        yahoo_access_token: yahooOAuthState.accessToken,
        yahoo_refresh_token: yahooOAuthState.refreshToken,
        yahoo_token_expiry: yahooOAuthState.tokenExpiry,
        yahoo_team_key: team.team_key,
      },
      {
        onSuccess: (response) => {
          if (response.status === "success") onAdded?.();
        },
      }
    );
  };

  if (step === "connect") {
    return (
      <div className="space-y-4 py-4">
        <p className="text-sm text-muted-foreground">
          Connect your Yahoo account to import your fantasy teams.
        </p>
        <Button
          onClick={handleConnectClick}
          disabled={isLoadingAuthUrl}
          className="w-full bg-purple-600 hover:bg-purple-700"
        >
          {isLoadingAuthUrl ? "Loading..." : "Connect with Yahoo"}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          You will be redirected to Yahoo to authorize access.
        </p>
      </div>
    );
  }

  if (step === "select-league") {
    return (
      <div className="space-y-4 py-4">
        <p className="text-sm text-muted-foreground">Select a league:</p>
        {isLoadingLeagues ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : leagues && leagues.length > 0 ? (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {leagues.map((league) => {
              const format = normalizeProviderScoringType(league.scoring_type, "yahoo");
              return (
                <Button
                  key={league.league_key}
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-3"
                  onClick={() => handleLeagueSelect(league)}
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{league.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span>
                        {league.season} · {league.num_teams} teams
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0 font-normal normal-case">
                        {format.label}
                      </Badge>
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No fantasy basketball leagues found.
          </p>
        )}
      </div>
    );
  }

  if (step === "select-team") {
    return (
      <div className="space-y-4 py-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Select your team in {selectedLeague?.name}:
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedLeague(null);
              setStep("select-league");
            }}
          >
            Back
          </Button>
        </div>
        {isLoadingTeams ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : teams && teams.length > 0 ? (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {teams.map((team) => (
              <Button
                key={team.team_key}
                variant="outline"
                className={cn(
                  "w-full justify-start",
                  team.is_owned_by_current_login && "border-purple-500"
                )}
                onClick={() => handleTeamSelect(team)}
                disabled={isPending}
              >
                <div className="flex items-center gap-2">
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {team.is_owned_by_current_login && (
                    <Badge variant="secondary" className="text-xs">
                      Your Team
                    </Badge>
                  )}
                  <span>{team.name}</span>
                </div>
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No teams found in this league.
          </p>
        )}
      </div>
    );
  }

  return null;
}

function EditTeamFormContent({
  team_id,
  team_info,
  onClose,
}: {
  team_id: number;
  team_info: LeagueInfo;
  onClose: () => void;
}) {
  const { mutate: editTeam, isPending } = useUpdateTeamMutation();

  const form = useForm<EspnTeamFormValues>({
    resolver: zodResolver(espnTeamFormSchema),
    defaultValues: espnFormDefaults(team_info),
  });

  const handleSubmit = (values: EspnTeamFormValues) => {
    const original = espnFormDefaults(team_info);
    const unchanged = (Object.keys(original) as (keyof EspnTeamFormValues)[]).every(
      (k) => (values[k] ?? "") === (original[k] ?? "")
    );
    if (unchanged) {
      toast.error("No edits were made.");
      return;
    }

    editTeam(
      {
        teamId: team_id,
        teamData: {
          provider: "espn",
          league_id: parseInt(values.leagueID),
          team_name: values.teamName,
          year: parseInt(values.leagueYear),
          league_name: values.leagueName || undefined,
          espn_s2: values.s2 || undefined,
          swid: values.swid || undefined,
          scoring_preview: toScoringPreview(values.scoringPreview),
        },
      },
      {
        onSuccess: (response) => {
          if (response.status === "success") onClose();
        },
      }
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-3">
        <EspnTeamFormFields form={form} showPreview />

        <div className="flex justify-between pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Saving…
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
