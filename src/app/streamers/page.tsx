"use client";

import StreamerDisplay from "@/components/streamers-components/StreamerDisplay";

export default function Streamers() {
  return (
    <>
      <div className="flex items-center mb-4">
        <h1 className="text-lg font-semibold md:text-2xl">Find a Streamer</h1>
      </div>
      <div className="flex flex-1 justify-center rounded-lg border border-primary border-dashed shadow-sm">
        <StreamerDisplay />
      </div>
    </>
  );
}
