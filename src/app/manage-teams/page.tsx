"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ManageTeamsTable } from "@/components/teams-components/ManageTeamsTable";
import { toast } from "sonner";
import type { YahooOAuthState } from "@/types/yahoo";

function ManageTeamsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [yahooOAuthState, setYahooOAuthState] = useState<YahooOAuthState | null>(
    null
  );

  useEffect(() => {
    // Check for Yahoo OAuth callback params
    const yahooConnected = searchParams.get("yahoo_connected");
    const yahooError = searchParams.get("yahoo_error");
    const accessToken = searchParams.get("yahoo_access_token");
    const refreshToken = searchParams.get("yahoo_refresh_token");
    const tokenExpiry = searchParams.get("yahoo_token_expiry");

    if (yahooError) {
      toast.error(`Yahoo connection failed: ${yahooError}`);
      // Clean URL
      router.replace("/manage-teams");
      return;
    }

    if (yahooConnected === "true" && accessToken && refreshToken) {
      // Store OAuth state for the add team flow
      setYahooOAuthState({
        accessToken,
        refreshToken,
        tokenExpiry: tokenExpiry || "",
        selectedLeague: null,
        selectedTeam: null,
      });

      toast.success("Yahoo account connected! Select your league and team.");

      // Clean sensitive tokens from URL immediately
      router.replace("/manage-teams");
    }
  }, [searchParams, router]);

  return (
    <>
      <div className="flex items-center mb-4">
        <h1 className="text-lg font-semibold md:text-2xl">Manage Your Teams</h1>
      </div>
      <div className="flex-1 rounded-lg border border-primary border-dashed shadow-sm max-w-[100vw]">
        <div className="flex flex-col gap-1">
          <div className="w-full">
            <ManageTeamsTable yahooOAuthState={yahooOAuthState} />
          </div>
        </div>
      </div>
    </>
  );
}

export default function ManageTeams() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ManageTeamsContent />
    </Suspense>
  );
}
