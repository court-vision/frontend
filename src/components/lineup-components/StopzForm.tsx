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
import { useUIStore } from "@/stores/useUIStore";
import { toast } from "sonner";
import type { UseMutationResult } from "@tanstack/react-query";
import type { GenerateLineupResponse, LineupGenerationRequest } from "@/types/lineup";
import { useScheduleWeeksQuery } from "@/hooks/useLineups";
import { useMatchupQuery } from "@/hooks/useMatchup";

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
});

export default function StopzForm({ generateLineupMutation }: StopzFormProps) {
  const { selectedTeam, selectedProvider } = useUIStore();
  const { data: scheduleData } = useScheduleWeeksQuery();
  const { data: matchupData } = useMatchupQuery(selectedTeam);

  const form = useForm<z.infer<typeof stopzInput>>({
    resolver: zodResolver(stopzInput),
    defaultValues: {
      streaming_slots: "",
      week: "",
    },
  });

  const reset = form.reset;

  // Auto-fill the week when data is available
  useEffect(() => {
    // Don't override if user already selected a week
    if (form.getValues("week")) return;

    let currentWeek: number | null = null;

    if (selectedProvider === "yahoo" && matchupData) {
      // Yahoo: use platform-specific matchup period
      currentWeek = matchupData.matchup_period;
    } else if (scheduleData) {
      // ESPN (or no provider): use date-based current week from schedule
      currentWeek = scheduleData.current_week;
    }

    if (currentWeek) {
      form.setValue("week", currentWeek.toString());
    }
  }, [scheduleData, matchupData, selectedProvider, form]);

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
          toast.error("Failed to generate lineup. Please try again.");
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
                  <FormMessage />
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
