"use client";

import { useCallback, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useApiKeysQuery, useCreateApiKeyMutation, useRevokeApiKeyMutation } from "@/hooks/useApiKeys";
import { useDeleteTablesMutation, useRunQueryMutation, useSaveTableMutation, useSavedTableQuery, useSavedTablesQuery, useSqlmateSchemaQuery } from "@/hooks/useDev";
import { userMessage } from "@/lib/api-error";
import { DEMO_KEYS, DEMO_SCHEMA, demoRawKey, runDemoQuery } from "@/lib/dev-demo";
import type { ApiKeyListItem, CreateApiKeyRequest } from "@/types/api-keys";
import type { QueryRequest, QueryResponse, SchemaTable, UserTable } from "@/types/sqlmate";

/** Everything the Keys view needs, from the API or from the demo. */
export interface KeysModel {
  demo: boolean;
  signedIn: boolean;
  loaded: boolean;
  keys: ApiKeyListItem[];
  loading: boolean;
  error: string | null;
  create: (body: CreateApiKeyRequest) => Promise<{ raw: string; key: ApiKeyListItem }>;
  creating: boolean;
  revoke: (id: string) => Promise<void>;
  revoking: string | null;
}

export function useLiveKeys(): KeysModel {
  const { isLoaded, isSignedIn } = useAuth();
  const list = useApiKeysQuery();
  const create = useCreateApiKeyMutation();
  const revoke = useRevokeApiKeyMutation();
  const createAsync = create.mutateAsync;
  const revokeAsync = revoke.mutateAsync;
  return {
    demo: false,
    signedIn: isSignedIn === true,
    loaded: isLoaded,
    keys: list.data ?? [],
    loading: isSignedIn === true && list.isLoading,
    error: list.error ? userMessage(list.error, "Couldn't load your keys") : null,
    create: useCallback(
      async (body: CreateApiKeyRequest) => {
        const res = await createAsync(body);
        if (res.status !== "success" || !res.data) throw new Error(res.message || "The key was not created");
        return { raw: res.data.raw_key, key: res.data.key };
      },
      [createAsync]
    ),
    creating: create.isPending,
    revoke: useCallback(
      async (id: string) => {
        await revokeAsync(id);
      },
      [revokeAsync]
    ),
    revoking: revoke.isPending ? (revoke.variables ?? null) : null,
  };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useDemoKeys(): KeysModel {
  const [keys, setKeys] = useState<ApiKeyListItem[]>(DEMO_KEYS);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  return {
    demo: true,
    signedIn: true,
    loaded: true,
    keys,
    loading: false,
    error: null,
    create: useCallback(async (body: CreateApiKeyRequest) => {
      setCreating(true);
      await wait(350);
      const raw = demoRawKey();
      const key: ApiKeyListItem = {
        id: `demo-${Date.now()}`,
        name: body.name,
        key_prefix: raw.slice(0, 11),
        scopes: body.scopes ?? ["read"],
        rate_limit: 1000,
        created_at: new Date().toISOString(),
        last_used_at: null,
        expires_at: body.expires_days ? new Date(Date.now() + body.expires_days * 86_400_000).toISOString() : null,
        is_active: true,
      };
      setKeys((list) => [key, ...list]);
      setCreating(false);
      return { raw, key };
    }, []),
    creating,
    revoke: useCallback(async (id: string) => {
      setRevoking(id);
      await wait(250);
      setKeys((list) => list.filter((k) => k.id !== id));
      setRevoking(null);
    }, []),
    revoking,
  };
}

/** Everything the Query view needs: the schema, a runner, and the saved tables. */
export interface QueryModel {
  demo: boolean;
  signedIn: boolean;
  schema: SchemaTable[];
  schemaLoading: boolean;
  schemaError: string | null;
  reloadSchema: () => void;
  run: (req: QueryRequest) => Promise<QueryResponse>;
  running: boolean;
  saved: UserTable[];
  savedLoading: boolean;
  openSaved: (name: string | null) => void;
  savedOpen: string | null;
  savedData: QueryResponse | null;
  savedDataLoading: boolean;
  save: (name: string, query: string) => Promise<void>;
  saving: boolean;
  remove: (names: string[]) => Promise<void>;
}

export function useLiveQuery(): QueryModel {
  const { isSignedIn } = useAuth();
  const schema = useSqlmateSchemaQuery();
  const run = useRunQueryMutation();
  const saved = useSavedTablesQuery();
  const [savedOpen, setSavedOpen] = useState<string | null>(null);
  const savedData = useSavedTableQuery(savedOpen);
  const save = useSaveTableMutation();
  const remove = useDeleteTablesMutation();
  const runAsync = run.mutateAsync;
  const saveAsync = save.mutateAsync;
  const removeAsync = remove.mutateAsync;
  const refetchSchema = schema.refetch;
  return {
    demo: false,
    signedIn: isSignedIn === true,
    schema: useMemo(() => schema.data ?? [], [schema.data]),
    schemaLoading: schema.isLoading,
    schemaError: schema.error ? schema.error.message || "The query builder service is unavailable" : null,
    reloadSchema: useCallback(() => void refetchSchema(), [refetchSchema]),
    run: useCallback((req: QueryRequest) => runAsync(req), [runAsync]),
    running: run.isPending,
    saved: saved.data ?? [],
    savedLoading: saved.isLoading,
    openSaved: setSavedOpen,
    savedOpen,
    savedData: savedData.data ?? null,
    savedDataLoading: savedData.isLoading,
    save: useCallback(
      async (name: string, query: string) => {
        const res = await saveAsync({ table_name: name, query });
        const st = res.status ?? res.details;
        if (st && st.status !== "success") throw new Error(st.message || "The table was not saved");
      },
      [saveAsync]
    ),
    saving: save.isPending,
    remove: useCallback(
      async (names: string[]) => {
        await removeAsync(names);
      },
      [removeAsync]
    ),
  };
}

export function useDemoQuery(): QueryModel {
  const [running, setRunning] = useState(false);
  const [saved, setSaved] = useState<Array<UserTable & { data: QueryResponse }>>([]);
  const [savedOpen, setSavedOpen] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<QueryResponse | null>(null);
  return {
    demo: true,
    signedIn: true,
    schema: DEMO_SCHEMA,
    schemaLoading: false,
    schemaError: null,
    reloadSchema: () => {},
    run: useCallback(async (req: QueryRequest) => {
      setRunning(true);
      await wait(200);
      const res = runDemoQuery(req);
      setLastResult(res);
      setRunning(false);
      return res;
    }, []),
    running,
    saved: saved.map(({ table_name, created_at }) => ({ table_name, created_at })),
    savedLoading: false,
    openSaved: setSavedOpen,
    savedOpen,
    savedData: savedOpen ? (saved.find((t) => t.table_name === savedOpen)?.data ?? null) : null,
    savedDataLoading: false,
    save: useCallback(
      async (name: string) => {
        await wait(200);
        if (!lastResult?.table) throw new Error("Run a query first");
        setSaved((list) => [{ table_name: name, created_at: new Date().toISOString(), data: lastResult }, ...list.filter((t) => t.table_name !== name)]);
      },
      [lastResult]
    ),
    saving: false,
    remove: useCallback(async (names: string[]) => {
      setSaved((list) => list.filter((t) => !names.includes(t.table_name)));
      setSavedOpen((cur) => (cur && names.includes(cur) ? null : cur));
    }, []),
  };
}
