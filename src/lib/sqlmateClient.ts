import type {
  DeleteTableResponse,
  GetTablesResponse,
  QueryRequest,
  QueryResponse,
  SaveTableRequest,
  SaveTableResponse,
  SchemaTable,
  UpdateTableRequest,
  UpdateTableResponse,
} from "@/types/sqlmate";

const SQLMATE_ORIGIN =
  process.env.NEXT_PUBLIC_SQLMATE_ORIGIN || "https://sqlmate.courtvision.dev";

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

function getErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload !== "object" || payload === null) {
    return fallback;
  }

  const record = payload as Record<string, unknown>;
  const status =
    (record.status as Record<string, unknown> | undefined) ||
    (record.details as Record<string, unknown> | undefined);

  const message =
    (typeof status?.message === "string" && status.message) ||
    (typeof record.message === "string" && record.message);

  return message || fallback;
}

async function apiFetch<T>(
  token: string,
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(`${SQLMATE_ORIGIN}${path}`, {
    method: options.method || "GET",
    headers,
    credentials: "include",
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, `Request failed (${response.status})`));
  }

  return payload as T;
}

export async function getSchema(token: string): Promise<SchemaTable[]> {
  return apiFetch<SchemaTable[]>(token, "/schema");
}

export async function runVisualQuery(
  token: string,
  params: QueryRequest
): Promise<QueryResponse> {
  return apiFetch<QueryResponse>(token, "/query", {
    method: "POST",
    body: params,
  });
}

export async function saveTable(
  token: string,
  req: SaveTableRequest
): Promise<SaveTableResponse> {
  return apiFetch<SaveTableResponse>(token, "/users/save_table", {
    method: "POST",
    body: req,
  });
}

export async function getTables(token: string): Promise<GetTablesResponse> {
  return apiFetch<GetTablesResponse>(token, "/users/get_tables");
}

export async function getTableData(
  token: string,
  name: string
): Promise<QueryResponse> {
  return apiFetch<QueryResponse>(
    token,
    `/users/get_table_data?table_name=${encodeURIComponent(name)}`
  );
}

export async function deleteTables(
  token: string,
  names: string[]
): Promise<DeleteTableResponse> {
  return apiFetch<DeleteTableResponse>(token, "/users/delete_table", {
    method: "POST",
    body: { table_names: names },
  });
}

export async function updateTable(
  token: string,
  params: UpdateTableRequest
): Promise<UpdateTableResponse> {
  return apiFetch<UpdateTableResponse>(token, "/users/update_table", {
    method: "POST",
    body: params,
  });
}
