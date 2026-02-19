"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";

import { MyTablesPanel } from "@/components/query-builder/MyTablesPanel";
import { QueryBuilderCanvas } from "@/components/query-builder/QueryBuilderCanvas";
import { Button } from "@/components/ui/button";
import { getSchema } from "@/lib/sqlmateClient";
import type { SchemaTable } from "@/types/sqlmate";

const TOKEN_REFRESH_INTERVAL = 30_000;

export default function QueryBuilderPage() {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"builder" | "my-tables">("builder");
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
      <div className="flex border-b border-border px-4 pt-2 gap-2">
        <Button
          variant={activeTab === "builder" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("builder")}
        >
          Query Builder
        </Button>
        <Button
          variant={activeTab === "my-tables" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("my-tables")}
        >
          My Tables
        </Button>
      </div>

      {!token && (
        <div className="p-4 text-sm text-muted-foreground">Authenticating...</div>
      )}

      {schemaError && (
        <div className="p-4 text-sm text-red-500">{schemaError}</div>
      )}

      <div className={activeTab === "builder" ? "flex-1 flex overflow-hidden" : "hidden"}>
        {token && schema && <QueryBuilderCanvas token={token} schema={schema} />}
      </div>

      <div className={activeTab === "my-tables" ? "flex-1 overflow-auto" : "hidden"}>
        {token && <MyTablesPanel token={token} />}
      </div>
    </div>
  );
}
