"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderOpen } from "lucide-react";

import { QueryBuilderCanvas } from "@/components/query-builder/QueryBuilderCanvas";
import { Button } from "@/components/ui/button";
import { getSchema } from "@/lib/sqlmateClient";
import type { SchemaTable } from "@/types/sqlmate";

const TOKEN_REFRESH_INTERVAL = 30_000;

export default function QueryBuilderPage() {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [schema, setSchema] = useState<SchemaTable[] | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);

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

  useEffect(() => {
    let isMounted = true;

    const loadSchema = async () => {
      if (!token) {
        setSchema(null);
        return;
      }

      try {
        setSchemaError(null);
        const data = await getSchema(token);
        if (isMounted) {
          setSchema(data);
        }
      } catch (error) {
        if (isMounted) {
          setSchema([]);
          setSchemaError(
            error instanceof Error ? error.message : "Failed to load schema"
          );
        }
      }
    };

    loadSchema();

    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <div className="flex flex-col h-[calc(94vh-60px)]">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Query Builder
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Build and run SQL queries against real NBA data.
          </p>
        </div>
        <Link href="/query-builder/manage-tables">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <FolderOpen className="h-3.5 w-3.5" />
            Manage Tables
          </Button>
        </Link>
      </div>

      {!token && (
        <div className="p-4 text-sm text-muted-foreground">Authenticating...</div>
      )}

      {schemaError && (
        <div className="p-4 text-sm text-red-500">{schemaError}</div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {token && schema && <QueryBuilderCanvas token={token} schema={schema} />}
      </div>
    </div>
  );
}
