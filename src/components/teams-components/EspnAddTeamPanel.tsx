"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-error";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConnectionsQuery, useEspnAccountTeamsQuery } from "@/hooks/useConnections";
import { useAddTeamMutation } from "@/hooks/useTeams";
import { accountLabel, espnConnections, espnScoringFormat } from "@/lib/connections";
import type { EspnAccountTeam, ProviderConnection } from "@/types/connections";
import { EspnConnectForm } from "./EspnConnectionCard";
import {
  EspnTeamFormFields,
  espnFormDefaults,
  espnTeamFormSchema,
  type EspnTeamFormValues,
} from "./EspnTeamFormFields";

/**
 * The ESPN side of Add Team. With a connected ESPN account the user picks a
 * team from the account's leagues as ESPN lists them — nothing to paste or
 * look up. Without one they connect first, or type a public league's id.
 */
export function EspnAddTeamPanel({ onAdded }: { onAdded?: () => void }) {
  const { data, isLoading } = useConnectionsQuery();
  const connections = espnConnections(data);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [manual, setManual] = useState(false);
  const connection = connections.find((c) => c.id === selectedId) ?? connections[0] ?? null;

  if (isLoading) {
    return (
      <div className="space-y-2 pt-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (manual) {
    return <EspnManualAddForm connection={connection} onAdded={onAdded} onBack={() => setManual(false)} />;
  }

  if (!connection) {
    return (
      <div className="flex flex-col gap-3 pt-4">
        <p className="text-sm text-muted-foreground">
          Connect your ESPN account to pick your team from its leagues. You paste the
          cookies once; every ESPN team you add shares them.
        </p>
        <EspnConnectForm />
        <TextButton onClick={() => setManual(true)}>Public league? Add it by league ID instead</TextButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pt-4">
      {connections.length > 1 && (
        <Select value={String(connection.id)} onValueChange={(value) => setSelectedId(Number(value))}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {connections.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {accountLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <EspnAccountTeamPicker connection={connection} onAdded={onAdded} />
      <TextButton onClick={() => setManual(true)}>Not listed? Enter a league ID</TextButton>
    </div>
  );
}

function TextButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start inline-flex items-center text-xs text-muted-foreground underline-offset-2 hover:underline hover:text-foreground"
    >
      {children}
    </button>
  );
}

function EspnAccountTeamPicker({
  connection,
  onAdded,
}: {
  connection: ProviderConnection;
  onAdded?: () => void;
}) {
  const { data: teams, isLoading, error, refetch, isFetching } = useEspnAccountTeamsQuery(connection.id);
  const { mutate: addTeam, isPending, variables } = useAddTeamMutation();

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }
  if (error) {
    return <QueryErrorState error={error} onRetry={() => refetch()} isRetrying={isFetching} compact />;
  }
  if (!teams?.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        ESPN lists no fantasy basketball teams on {accountLabel(connection)}.
      </p>
    );
  }

  const pick = (team: EspnAccountTeam) => {
    addTeam(
      {
        provider: "espn",
        league_id: team.league_id,
        team_name: team.team_name,
        year: team.season,
        league_name: team.league_name ?? undefined,
        // The server takes the cookies from this connection
        espn_connection_id: connection.id,
      },
      {
        onSuccess: (response) => {
          if (response.status === "success") onAdded?.();
        },
      }
    );
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Your teams on {accountLabel(connection)}:</p>
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {teams.map((team) => {
          const added = team.tracked_team_id != null;
          const adding =
            isPending && variables?.league_id === team.league_id && variables?.team_name === team.team_name;
          return (
            <Button
              key={`${team.season}-${team.league_id}-${team.espn_team_id}`}
              type="button"
              variant="outline"
              className="w-full min-w-0 overflow-hidden justify-start text-left h-auto py-2.5"
              disabled={added || isPending}
              onClick={() => pick(team)}
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate flex items-center gap-2">
                  {adding && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {team.team_name}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 min-w-0">
                  <span className="truncate">{team.league_name ?? `League ${team.league_id}`}</span>
                  <span className="shrink-0">
                    · {team.season}
                    {team.league_size ? ` · ${team.league_size} teams` : ""}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 font-normal normal-case shrink-0">
                    {espnScoringFormat(team.scoring_type).label}
                  </Badge>
                </div>
              </div>
              {added && (
                <Badge variant="secondary" className="text-[10px] ml-2 shrink-0">
                  Added
                </Badge>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function EspnManualAddForm({
  connection,
  onAdded,
  onBack,
}: {
  connection: ProviderConnection | null;
  onAdded?: () => void;
  onBack: () => void;
}) {
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
        // A connected account supplies the cookies; otherwise whatever was pasted (or none)
        ...(connection
          ? { espn_connection_id: connection.id }
          : { espn_s2: values.s2 || undefined, swid: values.swid || undefined }),
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
        <TextButton onClick={onBack}>
          <ArrowLeft className="h-3 w-3 mr-1" />
          {connection ? "Your ESPN teams" : "Connect your ESPN account"}
        </TextButton>

        <EspnTeamFormFields key={fieldsKey} form={form} required connection={connection} />

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
