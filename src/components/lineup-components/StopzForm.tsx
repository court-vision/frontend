"use client";
import { useEffect } from "react";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "../ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "../ui/card";
import { Button } from "../ui/button";
import { QueryErrorState } from "../ui/query-error";
import { Switch } from "../ui/switch";
import { useUIStore } from "@/stores/useUIStore";
import { toast } from "sonner";
import { userMessage } from "@/lib/api-error";
import type { UseMutationResult } from "@tanstack/react-query";
import type { GenerateLineupResponse, LineupGenerationRequest } from "@/types/lineup";
import { useScheduleWeeksQuery } from "@/hooks/useLineups";
import { useMatchupQuery } from "@/hooks/useMatchup";
import { useSeason } from "@/hooks/useSeason";
import { defaultLineupWeek } from "@/lib/lineup-week";
import { getTodayET } from "@/lib/utils";

interface StopzFormProps {
  generateLineupMutation: UseMutationResult<GenerateLineupResponse, Error, LineupGenerationRequest>;
}

const stopzInput = z.object({
  streaming_slots: z
    .string()
    .min(1, "Required")
    .regex(/^\d+$/, "Must be a whole number")
    .refine((v) => parseInt(v) >= 1 && parseInt(v) <= 10, "Must be between 1 and 10"),
  week: z.string().min(1, "Required"),
  avg_mode: z.enum(["season", "recent"]),
});

export default function StopzForm({ generateLineupMutation }: StopzFormProps) {
  const {
    selectedTeam,
    selectedProvider,
    selectedLineupWeek,
    selectedLineupSeason,
    setSelectedLineupWeek,
  } = useUIStore();
  const {
    data: scheduleData,
    error: scheduleError,
    refetch: refetchSchedule,
    isFetching: scheduleFetching,
  } = useScheduleWeeksQuery();
  const { data: matchupData } = useMatchupQuery(selectedTeam);
  const season = useSeason();

  const form = useForm<z.infer<typeof stopzInput>>({
    resolver: zodResolver(stopzInput),
    defaultValues: {
      streaming_slots: "",
      // Restore the persisted week immediately on mount, but only if it was
      // saved for this season — a week from last season means nothing now.
      week: selectedLineupSeason === season.key && selectedLineupWeek ? selectedLineupWeek : "",
      avg_mode: "season" as const,
    },
  });

  const reset = form.reset;

  // Auto-fill the week once the schedule is known. Re-runs when the season
  // key changes (e.g. the server reports a different season than the fallback
  // we mounted with), so a week persisted for another season is replaced.
  useEffect(() => {
    if (!scheduleData) return;
    const staleSeason = selectedLineupSeason !== season.key;
    // Keep a restored or user-chosen week unless it belongs to another season
    if (!staleSeason && form.getValues("week")) return;

    let week: string | null = null;

    if (selectedProvider === "yahoo" && matchupData) {
      // Yahoo: our calendar week for the current matchup, else Yahoo's own period
      const matchupWeek = matchupData.schedule_week ?? matchupData.matchup_period;
      if (matchupWeek) week = String(matchupWeek);
    }
    if (week === null) {
      // ESPN (or no provider): date-based current week, or the next one up
      week = defaultLineupWeek(scheduleData.weeks, scheduleData.current_week, getTodayET());
    }

    if (week) {
      form.setValue("week", week);
    } else if (staleSeason) {
      setSelectedLineupWeek(null, season.key);
    }
  }, [scheduleData, matchupData, selectedProvider, season.key, selectedLineupSeason, form, setSelectedLineupWeek]);

  // Persist the week (and the season it belongs to) whenever it changes
  const weekValue = form.watch("week");
  useEffect(() => {
    if (weekValue) {
      setSelectedLineupWeek(weekValue, season.key);
    }
  }, [weekValue, season.key, setSelectedLineupWeek]);

  const handleClearClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    reset();
  };

  const handleSubmit = (data: z.infer<typeof stopzInput>) => {
    if (!selectedTeam) {
      toast.error("Please select a team first.");
      return;
    }

    generateLineupMutation.mutate(
      {
        team_id: selectedTeam,
        streaming_slots: parseInt(data.streaming_slots),
        week: parseInt(data.week),
        avg_mode: data.avg_mode,
      },
      {
        onSuccess: (response) => {
          if (response.status === "success") {
            toast.success("Lineup generated successfully!");
          } else {
            toast.error(response.message || "Failed to generate lineup.");
          }
        },
        onError: (error) => {
          console.error("Generate lineup error:", error);
          toast.error(userMessage(error, "Failed to generate lineup. Please try again."));
        },
      }
    );
  };

  // Format date for display (e.g., "2025-10-21" → "Oct 21")
  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate + "T00:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Card variant="panel">
      <CardHeader>
        <CardDescription className="text-xs">
          Configure your streaming slots and matchup week to generate an optimized lineup.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit(handleSubmit)}
          >
            <FormField
              control={form.control}
              name="streaming_slots"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">
                    Streaming Slots
                    <span className="text-destructive"> *</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      placeholder="Number of roster spots for streaming"
                      className="h-8 text-xs"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="week"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">
                    Matchup Week
                    <span className="text-destructive"> *</span>
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select a matchup week" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {scheduleData?.weeks.map((week) => (
                        <SelectItem
                          key={week.week}
                          value={week.week.toString()}
                        >
                          Week {week.week}: {formatDate(week.start_date)} – {formatDate(week.end_date)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {scheduleError && !scheduleData && (
                    <QueryErrorState
                      error={scheduleError}
                      onRetry={() => refetchSchedule()}
                      isRetrying={scheduleFetching}
                      compact
                      fallback="Couldn't load the matchup weeks"
                      className="flex-row justify-start gap-1.5 p-0 text-left"
                    />
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="avg_mode"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <FormLabel className="text-xs">Recent avg (last 14 days)</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value === "recent"}
                      onCheckedChange={(checked) =>
                        field.onChange(checked ? "recent" : "season")
                      }
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <CardFooter className="flex justify-between p-0 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearClick}
              >
                Clear
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={generateLineupMutation.isPending}
              >
                {generateLineupMutation.isPending
                  ? "Generating..."
                  : "Generate Lineup"}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
