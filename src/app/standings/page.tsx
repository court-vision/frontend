"use client";

import StandingsDisplay from "@/components/standings-components/StandingsDisplay";

export default function Standings() {
  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Standings</h1>
      </div>
      <div className="flex flex-1 justify-center rounded-lg border border-primary border-dashed shadow-sm">
        <div className="flex flex-col items-center gap-1 w-full">
          <div className="flex flex-col items-center mt-5">
            <p className="text-sm text-center text-gray-500">
              Last updated: Today <br />
            </p>
          </div>
          <StandingsDisplay />
        </div>
      </div>
    </>
  );
}