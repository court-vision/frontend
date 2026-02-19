export type StatusType = "success" | "error" | "warning";

export interface StatusResponse {
  status: StatusType;
  message?: string;
  code?: number;
}

export interface Table {
  query: string;
  created_at?: string;
  columns: string[];
  rows: any[];
  error?: string;
}

export interface QueryResponse {
  status: StatusResponse;
  table?: Table;
}

export interface SaveTableRequest {
  table_name: string;
  query: string;
}

export interface SaveTableResponse {
  status?: StatusResponse;
  details?: StatusResponse;
}

export interface DeleteTableRequest {
  table_names: string[];
}

export interface DeleteTableResponse {
  status?: StatusResponse;
  details?: StatusResponse;
  deleted_tables?: string[];
}

export interface TableUpdateAttribute {
  attribute: string;
  value: string;
}

export interface TableUpdateConstraint {
  attribute: string;
  operator: string;
  value: string;
}

export interface UpdateQueryParams {
  table: string;
  updates: TableUpdateAttribute[];
  constraints: TableUpdateConstraint[];
}

export interface UpdateTableRequest {
  query_params: UpdateQueryParams;
}

export interface UpdateTableResponse {
  status: StatusResponse;
  rows_affected?: number;
}

export interface QueryAttribute {
  attribute: string;
  alias: string;
}

export interface QueryConstraint {
  attribute: string;
  operator: string;
  value: string;
}

export interface QueryAggregation {
  attribute: string;
  type: string;
}

export interface QueryParams {
  table: string;
  attributes: QueryAttribute[];
  constraints?: QueryConstraint[];
  group_by?: string[];
  aggregations?: QueryAggregation[];
}

export interface QueryRequest {
  query_params: QueryParams[];
  options?: {
    limit?: number;
    order_by?: Array<{
      table_name: string;
      attribute: string;
      sort: string;
    }>;
  };
}

export interface SchemaColumn {
  name: string;
  type: string;
}

export interface SchemaTable {
  table: string;
  columns: SchemaColumn[];
}

export interface UserTable {
  table_name: string;
  created_at: string;
}

export interface GetTablesResponse {
  details: StatusResponse;
  tables?: UserTable[];
}
