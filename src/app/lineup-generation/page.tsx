"use client";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import StopzForm from "@/components/lineup-components/StopzForm";
import LineupDisplay from "@/components/lineup-components/LineupDisplay";
import { useGenerateLineupMutation } from "@/hooks/useLineups";

function SkeletonCard() {
  return (
    <div className="flex flex-col space-y-3">
      <Skeleton className="h-[125px] w-[250px] rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-[250px]" />
        <Skeleton className="h-4 w-[200px]" />
      </div>
    </div>
  );
}

export default function LineupGeneration() {
  const generateLineupMutation = useGenerateLineupMutation();

  const response = generateLineupMutation.data;
  const lineup = response?.data;
  const isLoading = generateLineupMutation.isPending;

  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Lineup Generation</h1>
      </div>
      <div className="flex flex-1 justify-center rounded-lg border border-primary border-dashed shadow-sm">
        <section className="py-5 flex-row gap-3">
          <div>
            <StopzForm generateLineupMutation={generateLineupMutation} />
          </div>

          <div className="flex flex-col items-center">
            <Separator
              orientation="horizontal"
              className="w-full my-4 bg-primary"
            />
            {isLoading ? (
              <>
                <SkeletonCard />
              </>
            ) : lineup ? (
              <>
                <LineupDisplay lineup={lineup} />
              </>
            ) : (
              <div className="text-center text-muted-foreground">
                Generate a lineup to see it displayed here
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
