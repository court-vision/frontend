"use client";
import { Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import StopzForm from "@/components/lineup-components/StopzForm";
import LineupDisplay from "@/components/lineup-components/LineupDisplay";
import { useGenerateLineupMutation } from "@/hooks/useLineups";

export default function LineupGeneration() {
  const generateLineupMutation = useGenerateLineupMutation();

  const response = generateLineupMutation.data;
  const lineup = response?.data;
  const isLoading = generateLineupMutation.isPending;

  return (
    <div className="space-y-4 animate-slide-up-fade">
      <section>
        <h1 className="font-display text-xl font-bold tracking-tight">
          Lineup Generation
        </h1>
        <p className="text-muted-foreground text-xs mt-0.5">
          Optimize your streaming moves for the week.
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Configuration */}
        <div>
          <StopzForm generateLineupMutation={generateLineupMutation} />
        </div>

        {/* Results */}
        <div>
          {isLoading ? (
            <Card variant="panel" className="p-6 space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-[300px] w-full rounded-md" />
            </Card>
          ) : lineup ? (
            <LineupDisplay lineup={lineup} />
          ) : (
            <Card variant="panel" className="p-8 flex flex-col items-center justify-center min-h-[300px]">
              <Zap className="h-8 w-8 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground text-center">
                Configure your settings and generate a lineup to see results here.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
