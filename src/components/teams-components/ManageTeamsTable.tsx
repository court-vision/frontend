import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronRight, Lock, Plus } from "lucide-react";
import {
  Form,
  FormField,
  FormLabel,
  FormControl,
  FormMessage,
  FormItem,
} from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState, useEffect } from "react";
import { useTeams } from "@/app/context/TeamsContext";
import {
  useAddTeamMutation,
  useDeleteTeamMutation,
  useUpdateTeamMutation,
} from "@/hooks/useTeams";
import { useYahooAuthUrl, useYahooLeagues, useYahooTeams } from "@/hooks/useYahoo";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TeamCard } from "./TeamCard";
import type { YahooOAuthState, YahooLeague, YahooTeam } from "@/types/yahoo";
import type { FantasyProvider, TeamResponseData } from "@/types/team";

interface TeamInfo {
  provider?: FantasyProvider;
  team_name: string;
  league_name?: string | null;
  league_id: number;
  year: number;
  espn_s2?: string | null;
  swid?: string | null;
  yahoo_access_token?: string | null;
  yahoo_refresh_token?: string | null;
  yahoo_token_expiry?: string | null;
  yahoo_team_key?: string | null;
}

interface ManageTeamsTableProps {
  yahooOAuthState?: YahooOAuthState | null;
}

export function ManageTeamsTable({ yahooOAuthState }: ManageTeamsTableProps) {
  const { teams } = useTeams();
  const [editingTeam, setEditingTeam] = useState<TeamResponseData | null>(null);
  const [deletingTeamId, setDeletingTeamId] = useState<number | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {teams.map((team) => (
          <TeamCard
            key={team.team_id}
            team={team}
            onEdit={(t) => setEditingTeam(t)}
            onDelete={(id) => setDeletingTeamId(id)}
          />
        ))}
        <AddTeamCard yahooOAuthState={yahooOAuthState} />
      </div>

      <EditTeamDialog
        team={editingTeam}
        onOpenChange={(open) => { if (!open) setEditingTeam(null); }}
      />

      <DeleteTeamDialog
        teamId={deletingTeamId}
        onOpenChange={(open) => { if (!open) setDeletingTeamId(null); }}
      />
    </>
  );
}

function AddTeamCard({ yahooOAuthState }: { yahooOAuthState?: YahooOAuthState | null }) {
  const [open, setOpen] = useState(false);

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
            Connect your fantasy basketball team.
          </DialogDescription>
        </DialogHeader>
        <AddTeamFormContent yahooOAuthState={yahooOAuthState} />
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
  const { mutate: deleteTeam } = useDeleteTeamMutation();

  return (
    <Dialog open={teamId !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Team</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this team?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" className="mr-2" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (teamId !== null) {
                deleteTeam(teamId);
                onOpenChange(false);
              }
            }}
            variant="default"
          >
            Delete
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
          <DialogDescription>
            Edit the information of your team.
          </DialogDescription>
        </DialogHeader>
        <EditTeamFormContent
          team_id={team.team_id}
          team_info={team.league_info}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

const parseCookieString = (
  input: string
): { s2: string; swid: string } | null => {
  const s2Match = input.match(/espn_s2=([^;]+)/);
  const swidMatch = input.match(/SWID=([^;]+)/);

  if (s2Match && swidMatch) {
    return {
      s2: s2Match[1].trim(),
      swid: swidMatch[1].trim(),
    };
  }
  return null;
};

const BOOKMARKLET_CODE = `javascript:(function(){const s2=document.cookie.match(/espn_s2=([^;]+)/);const swid=document.cookie.match(/SWID=([^;]+)/);if(s2&&swid){prompt('Copy these values:','espn_s2='+decodeURIComponent(s2[1])+'; SWID='+decodeURIComponent(swid[1]));}else{alert('Please log into ESPN first.');}})()`;

function AddTeamFormContent({ yahooOAuthState }: { yahooOAuthState?: YahooOAuthState | null }) {
  const [activeTab, setActiveTab] = useState<"espn" | "yahoo">("espn");

  useEffect(() => {
    if (yahooOAuthState) {
      setActiveTab("yahoo");
    }
  }, [yahooOAuthState]);

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as "espn" | "yahoo")}
    >
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
        <EspnAddTeamForm />
      </TabsContent>

      <TabsContent value="yahoo">
        <YahooAddTeamFlow yahooOAuthState={yahooOAuthState} />
      </TabsContent>
    </Tabs>
  );
}

function EspnAddTeamForm() {
  const { mutate: addTeam, isPending } = useAddTeamMutation();

  const leagueInfoSchema = z.object({
    leagueID: z
      .string()
      .min(1)
      .regex(/^\d+$/, { message: "League ID must be a number" }),
    leagueYear: z
      .string()
      .min(1)
      .regex(/^\d+$/, { message: "League Year must be a number" }),
    teamName: z.string().min(1),
    leagueName: z.string().optional(),
    s2: z.string().optional(),
    swid: z.string().optional(),
  });

  const form = useForm<z.infer<typeof leagueInfoSchema>>({
    resolver: zodResolver(leagueInfoSchema),
    defaultValues: {
      leagueID: "",
      leagueYear: "",
      teamName: "",
      s2: "",
      swid: "",
    },
  });
  const reset = form.reset;

  const handleClearClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setSubmitted(false);
    reset();
  };

  const [submitted, setSubmitted] = useState(false);
  const [cookieInput, setCookieInput] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSuccess, setParseSuccess] = useState(false);

  const handleSubmit = async (values: z.infer<typeof leagueInfoSchema>) => {
    setSubmitted(true);

    addTeam(
      {
        provider: "espn",
        league_id: parseInt(values.leagueID),
        team_name: values.teamName,
        year: parseInt(values.leagueYear),
        league_name: values.leagueName,
        espn_s2: values.s2,
        swid: values.swid,
      },
      {
        onSettled: () => {
          setSubmitted(false);
          reset();
        },
      }
    );
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col gap-3 pt-4"
      >
        <FormField
          control={form.control}
          name="leagueID"
          render={({ field }) => {
            return (
              <FormItem>
                <FormLabel>
                  League ID
                  <span style={{ color: "red" }}> *</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="ID" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <FormField
          control={form.control}
          name="leagueYear"
          render={({ field }) => {
            return (
              <FormItem>
                <FormLabel>
                  League Year
                  <span style={{ color: "red" }}> *</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="YYYY" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <FormField
          control={form.control}
          name="teamName"
          render={({ field }) => {
            return (
              <FormItem>
                <FormLabel>
                  Team Name
                  <span style={{ color: "red" }}> *</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="Name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <details className="group rounded-lg border border-border bg-muted/20 px-3 py-2.5">
          <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground list-none [&::-webkit-details-marker]:hidden">
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
            <Lock className="h-3.5 w-3.5" />
            <span>Private league settings</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto font-normal">Optional</Badge>
          </summary>

          <div className="flex flex-col gap-3 pt-3">
            <div className="rounded-md border border-dashed p-3 bg-muted/30">
              <p className="text-sm text-muted-foreground mb-2">
                Step 1: Drag this button to your bookmarks bar:
              </p>
              <div
                dangerouslySetInnerHTML={{
                  __html: `<a href="${BOOKMARKLET_CODE}" class="inline-block px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md cursor-grab hover:bg-primary/90" onclick="event.preventDefault()">Get ESPN Cookies</a>`,
                }}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Step 2: Log into ESPN, then click the bookmark and copy the result.
              </p>
            </div>

            <Tabs defaultValue="paste" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="paste" className="flex-1">
                  Paste Cookies
                </TabsTrigger>
                <TabsTrigger value="manual" className="flex-1">
                  Manual Entry
                </TabsTrigger>
              </TabsList>

              <TabsContent value="paste" className="space-y-3">
                <div className="space-y-2">
                  <Label>Paste cookie string</Label>
                  <Input
                    placeholder="espn_s2=...; SWID=..."
                    value={cookieInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCookieInput(value);

                      if (!value.trim()) {
                        setParseError(null);
                        setParseSuccess(false);
                        return;
                      }

                      const parsed = parseCookieString(value);
                      if (parsed) {
                        form.setValue("s2", parsed.s2);
                        form.setValue("swid", parsed.swid);
                        setParseSuccess(true);
                        setParseError(null);
                      } else {
                        setParseSuccess(false);
                        setParseError(null);
                      }
                    }}
                  />
                  {parseError && (
                    <p className="text-sm text-destructive">{parseError}</p>
                  )}
                  {parseSuccess && (
                    <div className="text-sm text-green-600 space-y-1">
                      <p>Cookies parsed successfully:</p>
                      <p className="font-mono text-xs truncate">
                        espn_s2: {form.getValues("s2")?.slice(0, 20)}...
                      </p>
                      <p className="font-mono text-xs truncate">
                        SWID: {form.getValues("swid")}
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="manual" className="space-y-3">
                <FormField
                  control={form.control}
                  name="s2"
                  render={({ field }) => {
                    return (
                      <FormItem>
                        <FormLabel>ESPN s2</FormLabel>
                        <FormControl>
                          <Input placeholder="s2" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <FormField
                  control={form.control}
                  name="swid"
                  render={({ field }) => {
                    return (
                      <FormItem>
                        <FormLabel>SWID</FormLabel>
                        <FormControl>
                          <Input placeholder="SWID" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>
        </details>

        <div className="flex justify-between pl-0 pr-0 mb-[-1rem]">
          <Button
            type="button"
            className="size-sm bg-primary"
            onClick={handleClearClick}
          >
            <Image src="/clear.png" alt="clear" width={30} height={30} />
          </Button>
          <Button type="submit" className="size-sm bg-primary">
            <Image src="/arrow.png" alt="submit" width={30} height={30} />
          </Button>
        </div>
        <div className="text-center justify-center items-center">
          <Skeleton
            className={` ${
              submitted
                ? "h-4 mt-5 w-full justify-center items-center"
                : "hidden"
            }`}
          ></Skeleton>
        </div>
      </form>
    </Form>
  );
}

interface YahooAddTeamFlowProps {
  yahooOAuthState?: YahooOAuthState | null;
}

function YahooAddTeamFlow({ yahooOAuthState }: YahooAddTeamFlowProps) {
  const [step, setStep] = useState<"connect" | "select-league" | "select-team">(
    yahooOAuthState ? "select-league" : "connect"
  );
  const [selectedLeague, setSelectedLeague] = useState<YahooLeague | null>(null);

  const { refetch: fetchAuthUrl, isFetching: isLoadingAuthUrl } =
    useYahooAuthUrl();
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
    } catch (error) {
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
        onSuccess: () => {
          toast.success("Yahoo team added successfully!");
        },
        onError: () => {
          toast.error("Failed to add Yahoo team. Please try again.");
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
            {leagues.map((league) => (
              <Button
                key={league.league_key}
                variant="outline"
                className="w-full justify-start text-left h-auto py-3"
                onClick={() => handleLeagueSelect(league)}
              >
                <div>
                  <div className="font-medium">{league.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {league.season} - {league.num_teams} teams -{" "}
                    {league.scoring_type}
                  </div>
                </div>
              </Button>
            ))}
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
  team_info: TeamInfo;
  onClose: () => void;
}) {
  const { mutate: editTeam } = useUpdateTeamMutation();

  const leagueInfoSchema = z.object({
    leagueID: z
      .string()
      .min(1)
      .regex(/^\d+$/, { message: "League ID must be a number" }),
    leagueYear: z
      .string()
      .min(1)
      .regex(/^\d+$/, { message: "League Year must be a number" }),
    teamName: z.string().min(1),
    leagueName: z.string().optional(),
    s2: z.string().optional(),
    swid: z.string().optional(),
  });

  const form = useForm<z.infer<typeof leagueInfoSchema>>({
    resolver: zodResolver(leagueInfoSchema),
    defaultValues: {
      leagueID: `${team_info.league_id}`,
      leagueYear: `${team_info.year}`,
      teamName: team_info.team_name,
      leagueName: team_info.league_name || "",
      s2: team_info.espn_s2 || "",
      swid: team_info.swid || "",
    },
  });
  const reset = form.reset;

  const handleClearClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setSubmitted(false);
    reset();
  };

  const [submitted, setSubmitted] = useState(false);
  const [cookieInput, setCookieInput] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSuccess, setParseSuccess] = useState(false);

  const handleSubmit = async (values: z.infer<typeof leagueInfoSchema>) => {
    if (
      values.leagueID === `${team_info.league_id}` &&
      values.leagueYear === `${team_info.year}` &&
      values.teamName === team_info.team_name &&
      values.leagueName === (team_info.league_name || "") &&
      values.s2 === (team_info.espn_s2 || "") &&
      values.swid === (team_info.swid || "")
    ) {
      toast.error("No edits were made.");
      return;
    }

    setSubmitted(true);

    editTeam(
      {
        teamId: team_id,
        teamData: {
          provider: "espn",
          league_id: parseInt(values.leagueID),
          team_name: values.teamName,
          year: parseInt(values.leagueYear),
          league_name: values.leagueName,
          espn_s2: values.s2,
          swid: values.swid,
        },
      },
      {
        onSettled: () => {
          setSubmitted(false);
        },
      }
    );
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col gap-3"
      >
        <FormField
          control={form.control}
          name="leagueID"
          render={({ field }) => {
            return (
              <FormItem>
                <FormLabel>League ID</FormLabel>
                <FormControl>
                  <Input
                    placeholder={`${team_info.league_id}`}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <FormField
          control={form.control}
          name="leagueYear"
          render={({ field }) => {
            return (
              <FormItem>
                <FormLabel>League Year</FormLabel>
                <FormControl>
                  <Input placeholder="YYYY" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <FormField
          control={form.control}
          name="teamName"
          render={({ field }) => {
            return (
              <FormItem>
                <FormLabel>Team Name</FormLabel>
                <FormControl>
                  <Input placeholder="Name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <FormField
          control={form.control}
          name="leagueName"
          render={({ field }) => {
            return (
              <FormItem>
                <FormLabel>League Name</FormLabel>
                <FormControl>
                  <Input placeholder="League Name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <details className="group rounded-lg border border-border bg-muted/20 px-3 py-2.5">
          <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground list-none [&::-webkit-details-marker]:hidden">
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
            <Lock className="h-3.5 w-3.5" />
            <span>Private league settings</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto font-normal">Optional</Badge>
          </summary>

          <div className="flex flex-col gap-3 pt-3">
            <div className="rounded-md border border-dashed p-3 bg-muted/30">
              <p className="text-sm text-muted-foreground mb-2">
                Step 1: Drag this button to your bookmarks bar:
              </p>
              <div
                dangerouslySetInnerHTML={{
                  __html: `<a href="${BOOKMARKLET_CODE}" class="inline-block px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md cursor-grab hover:bg-primary/90" onclick="event.preventDefault()">Get ESPN Cookies</a>`,
                }}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Step 2: Log into ESPN, then click the bookmark and copy the
                result.
              </p>
            </div>

            <Tabs defaultValue="paste" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="paste" className="flex-1">
                  Paste Cookies
                </TabsTrigger>
                <TabsTrigger value="manual" className="flex-1">
                  Manual Entry
                </TabsTrigger>
              </TabsList>

              <TabsContent value="paste" className="space-y-3">
                <div className="space-y-2">
                  <Label>Paste cookie string</Label>
                  <Input
                    placeholder="espn_s2=...; SWID=..."
                    value={cookieInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCookieInput(value);

                      if (!value.trim()) {
                        setParseError(null);
                        setParseSuccess(false);
                        return;
                      }

                      const parsed = parseCookieString(value);
                      if (parsed) {
                        form.setValue("s2", parsed.s2);
                        form.setValue("swid", parsed.swid);
                        setParseSuccess(true);
                        setParseError(null);
                      } else {
                        setParseSuccess(false);
                        setParseError(null);
                      }
                    }}
                  />
                  {parseError && (
                    <p className="text-sm text-destructive">{parseError}</p>
                  )}
                  {parseSuccess && (
                    <div className="text-sm text-green-600 space-y-1">
                      <p>Cookies parsed successfully:</p>
                      <p className="font-mono text-xs truncate">
                        espn_s2: {form.getValues("s2")?.slice(0, 20)}...
                      </p>
                      <p className="font-mono text-xs truncate">
                        SWID: {form.getValues("swid")}
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="manual" className="space-y-3">
                <FormField
                  control={form.control}
                  name="s2"
                  render={({ field }) => {
                    return (
                      <FormItem>
                        <FormLabel>ESPN s2</FormLabel>
                        <FormControl>
                          <Input placeholder="s2" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <FormField
                  control={form.control}
                  name="swid"
                  render={({ field }) => {
                    return (
                      <FormItem>
                        <FormLabel>SWID</FormLabel>
                        <FormControl>
                          <Input placeholder="SWID" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>
        </details>

        <div className="flex justify-between pl-0 pr-0 mb-[-1rem]">
          <Button
            type="button"
            className="size-sm bg-primary"
            onClick={handleClearClick}
          >
            <Image src="/clear.png" alt="clear" width={30} height={30} />
          </Button>
          <Button type="submit" className="size-sm bg-primary">
            <Image src="/arrow.png" alt="submit" width={30} height={30} />
          </Button>
        </div>
        <div className="text-center justify-center items-center">
          <Skeleton
            className={` ${
              submitted
                ? "h-4 mt-5 w-full justify-center items-center"
                : "hidden"
            }`}
          ></Skeleton>
        </div>
      </form>
    </Form>
  );
}
