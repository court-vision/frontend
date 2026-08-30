"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { MyTablesPanel } from "@/components/query-builder/MyTablesPanel";
import { Button } from "@/components/ui/button";

const TOKEN_REFRESH_INTERVAL = 30_000;

export default function ManageTablesPage() {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const refreshToken = async () => {
      try {
        const nextToken = await getToken();
        if (isMounted) {
          setToken(nextToken || null);
        }
      } catch {
        if (isMounted) {
          setToken(null);
        }
      }
    };

    refreshToken();
    const interval = window.setInterval(refreshToken, TOKEN_REFRESH_INTERVAL);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [getToken]);

  return (
    <div className="space-y-4 animate-slide-up-fade">
      <section className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Manage Tables
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            View and manage your saved query tables.
          </p>
        </div>
        <Link href="/query-builder">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
        </Link>
      </section>
      {!token ? (
        <div className="text-sm text-muted-foreground">Authenticating...</div>
      ) : (
        <MyTablesPanel token={token} />
      )}
    </div>
  );
}
