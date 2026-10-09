import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { API_BASE } from "@/endpoints";
import { toApiError } from "@/lib/api-error";
import type { HealthBody } from "@/lib/health";
import { fetchJson } from "@/lib/http";
import type { OpenApiDoc } from "@/lib/openapi";
import { deleteTables, getSchema, getTableData, getTables, runVisualQuery, saveTable } from "@/lib/sqlmateClient";
import type { QueryRequest, QueryResponse, SchemaTable } from "@/types/sqlmate";

/**
 * The developer desk's queries: the live OpenAPI document, the raw health
 * body, and SQLMate's schema, queries and saved tables.
 */
export const devKeys = {
  openapi: ["dev", "openapi"] as const,
  health: ["dev", "health"] as const,
  schema: ["dev", "sqlmate", "schema"] as const,
  tables: ["dev", "sqlmate", "tables"] as const,
  table: (name: string) => ["dev", "sqlmate", "table", name] as const,
};

/** `GET /openapi.json` as the backend serves it today: the reference is never older than the deploy. */
export function useOpenApiQuery() {
  return useQuery<OpenApiDoc>({
    queryKey: devKeys.openapi,
    queryFn: ({ signal }) => fetchJson<OpenApiDoc>(`${API_BASE}/openapi.json`, { raw: true, signal, timeoutMs: 20_000 }),
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    meta: { toast: false },
  });
}

/** `GET /health` with every field the backend reports; a 503 is data, not a failure. */
export function useRawHealthQuery() {
  return useQuery<HealthBody & { http: number; latencyMs: number }>({
    queryKey: devKeys.health,
    queryFn: async ({ signal }) => {
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/health`, { headers: { Accept: "application/json" }, signal });
      const latencyMs = Math.round(performance.now() - t0);
      const body = (await res.json().catch(() => ({}))) as HealthBody;
      if (res.status !== 200 && res.status !== 503) throw toApiError(new Error(`health answered ${res.status}`));
      return { ...body, http: res.status, latencyMs };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
    meta: { toast: false },
  });
}

export function useSqlmateSchemaQuery(enabled: boolean = true) {
  return useQuery<SchemaTable[]>({
    queryKey: devKeys.schema,
    queryFn: () => getSchema(null),
    enabled,
    staleTime: 1000 * 60 * 60,
    retry: 1,
    meta: { toast: false },
  });
}

/** Run a visual query. Signed in or not; the token only matters for saved tables on the canvas. */
export function useRunQueryMutation() {
  const { getToken, isSignedIn } = useAuth();
  return useMutation<QueryResponse, Error, QueryRequest>({
    mutationFn: async (req) => runVisualQuery(isSignedIn ? await getToken() : null, req),
    meta: { toast: false },
  });
}

export function useSavedTablesQuery(enabled: boolean = true) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: devKeys.tables,
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      const res = await getTables(token);
      return res.tables ?? [];
    },
    enabled: enabled && isSignedIn === true,
    staleTime: 1000 * 60 * 5,
    meta: { toast: false },
  });
}

export function useSavedTableQuery(name: string | null) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery<QueryResponse>({
    queryKey: devKeys.table(name ?? ""),
    queryFn: async () => getTableData((await getToken()) ?? "", name!),
    enabled: !!name && isSignedIn === true,
    staleTime: 1000 * 60 * 5,
    meta: { toast: false },
  });
}

export function useSaveTableMutation() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { table_name: string; query: string }) => saveTable((await getToken()) ?? "", body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: devKeys.tables }),
    meta: { toast: false },
  });
}

export function useDeleteTablesMutation() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (names: string[]) => deleteTables((await getToken()) ?? "", names),
    onSuccess: () => void qc.invalidateQueries({ queryKey: devKeys.tables }),
    meta: { toast: false },
  });
}
