"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { EspnConnectionCard } from "@/components/teams-components/EspnConnectionCard";
import { ManageTeamsTable } from "@/components/teams-components/ManageTeamsTable";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { YahooOAuthState } from "@/types/yahoo";
import { PageHeader } from "@/components/PageHeader";

function ManageTeamsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [yahooOAuthState, setYahooOAuthState] = useState<YahooOAuthState | null>(
    null
  );
  const autoOpenAdd = searchParams.get("add") === "1";

  useEffect(() => {
    // Check for Yahoo OAuth callback params
    const yahooConnected = searchParams.get("yahoo_connected");
    const yahooError = searchParams.get("yahoo_error");
    // An opaque connection id, not credentials. The tokens stay server-side.
    const connectionId = searchParams.get("yahoo_connection");

    if (yahooError) {
      // Truncate to prevent message injection from crafted URLs
      const safeError = yahooError.slice(0, 100);
      toast.error(`Yahoo connection failed: ${safeError}`);
      // Clean URL
      router.replace("/manage-teams");
      return;
    }

    if (yahooConnected === "true" && connectionId) {
      // Store the handle for the add-team flow
      setYahooOAuthState({
        connectionId: Number(connectionId),
        selectedLeague: null,
        selectedTeam: null,
      });

      toast.success("Yahoo account connected! Select your league and team.");

      // Drop the handle from the URL once consumed
      router.replace("/manage-teams");
    }
  }, [searchParams, router]);

  return (
    <div className="space-y-4 animate-slide-up-fade">
      <PageHeader
        title="Manage Teams"
        subtitle="Add, remove, or configure your fantasy teams."
        actions={
          <Link href="/your-teams">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
          </Link>
        }
      />
      <EspnConnectionCard />
      <ManageTeamsTable yahooOAuthState={yahooOAuthState} autoOpenAdd={autoOpenAdd} />
    </div>
  );
}

export default function ManageTeams() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ManageTeamsContent />
    </Suspense>
  );
}
