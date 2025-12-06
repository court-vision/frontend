"use client";
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
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import Image from "next/image";
import { useUIStore } from "@/stores/useUIStore";
import { toast } from "sonner";
import type { UseMutationResult } from "@tanstack/react-query";
import type { GenerateLineupResponse, LineupGenerationRequest } from "@/types/lineup";

interface StopzFormProps {
  generateLineupMutation: UseMutationResult<GenerateLineupResponse, Error, LineupGenerationRequest>;
}

const stopzInput = z.object({
  threshold: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "Value must be a decimal number"),
  week: z.string().min(1).regex(/^\d+$/, { message: "Week must be a number" }),
});

export default function StopzForm({ generateLineupMutation }: StopzFormProps) {
  const { selectedTeam } = useUIStore();

  const form = useForm<z.infer<typeof stopzInput>>({
    resolver: zodResolver(stopzInput),
    defaultValues: {
      threshold: "",
      week: "",
    },
  });

  const reset = form.reset;

  const handleClearClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    console.log("Clearing form");
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
        threshold: parseFloat(data.threshold),
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

  return (
    <div className="w-full pl-4 pr-4">
      <Card>
        <CardHeader>
          <CardDescription>
            Get an optimized streaming lineup for your fantasy basketball team.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* <CardDescription>Select a team or enter a new one</CardDescription> */}
          <Form {...form}>
            <form
              className="flex flex-col gap-3"
              onSubmit={form.handleSubmit(handleSubmit)}
            >
              <FormField
                control={form.control}
                name="threshold"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>
                        Threshold
                        {/* <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="h-4 w-5 rounded-full border ml-1 text-md">?</div>
                            </TooltipTrigger>
                            <TooltipContent className="text-center">
                              <p>
                                &quot;I am okay dropping any player under (threshold) average <br />
                                fantasy points per game&quot;
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider> */}
                        <span style={{ color: "red" }}> *</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder='"I am ok dropping anybody who averages less than {threshold} points"'
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
                name="week"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>
                        Matchup Week
                        {/* <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="h-4 w-5 rounded-full border ml-1 text-md">?</div>
                            </TooltipTrigger>
                            <TooltipContent className="text-center">
                              <p>
                                Matchup week is the matchup number for which you want <br />
                                to generate a lineup.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider> */}
                        <span style={{ color: "red" }}> *</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Week to generate a lineup for"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <CardFooter className="flex justify-between pl-0 pr-0 mb-[-1rem]">
                <Button
                  type="button"
                  className="size-sm bg-primary"
                  onClick={handleClearClick}
                >
                  <Image
                    src="/clear.png"
                    alt="clear"
                    width={30}
                    height={30}
                    fill-true
                  />
                </Button>
                <Button
                  type="submit"
                  className="size-sm bg-primary"
                  disabled={generateLineupMutation.isPending}
                >
                  {generateLineupMutation.isPending ? (
                    "Generating..."
                  ) : (
                    <Image
                      src="/arrow.png"
                      alt="submit"
                      width={30}
                      height={30}
                      fill-true
                    />
                  )}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
