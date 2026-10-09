/**
 * The query desk's model: a canvas of tables, the columns picked from them,
 * filters, ordering and a limit, and the `POST /v1/sqlmate/query` request it
 * becomes. SQLMate joins the tables itself along foreign keys. Pure.
 */
import type { QueryRequest, SchemaTable, Table } from "@/types/sqlmate";

export const OPERATORS = ["=", "!=", "<", "<=", ">", ">=", "LIKE", "SUBSTRING", "PREFIX", "SUFFIX"] as const;
export type Operator = (typeof OPERATORS)[number];

export const AGGREGATES = ["SUM", "COUNT", "AVG", "MIN", "MAX"] as const;
export type Aggregate = (typeof AGGREGATES)[number];

export const SORTS = ["ASC", "DESC"] as const;
export type Sort = (typeof SORTS)[number];

/** The server's ceiling (utils/guard.py MAX_LIMIT) and what a first run asks for. */
export const MAX_LIMIT = 10_000;
export const DEFAULT_LIMIT = 100;

export const OPERATOR_HELP: Record<Operator, string> = {
  "=": "equals",
  "!=": "is not",
  "<": "less than",
  "<=": "at most",
  ">": "greater than",
  ">=": "at least",
  LIKE: "SQL LIKE pattern (% and _)",
  SUBSTRING: "contains the text",
  PREFIX: "starts with the text",
  SUFFIX: "ends with the text",
};

export interface CanvasColumn {
  name: string;
  type: string;
  selected: boolean;
  alias: string;
  aggregate: Aggregate | "";
  groupBy: boolean;
}

export interface CanvasTable {
  table: string;
  columns: CanvasColumn[];
}

export interface CanvasConstraint {
  id: number;
  table: string;
  attribute: string;
  operator: Operator;
  value: string;
}

export interface CanvasOrder {
  id: number;
  table: string;
  attribute: string;
  sort: Sort;
}

export interface Canvas {
  tables: CanvasTable[];
  constraints: CanvasConstraint[];
  order: CanvasOrder[];
  limit: number;
  nextId: number;
}

export const EMPTY_CANVAS: Canvas = { tables: [], constraints: [], order: [], limit: DEFAULT_LIMIT, nextId: 1 };

/** "nba.players" → "players". */
export function shortTable(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? name : name.slice(i + 1);
}

/** "nba.players" → "nba". */
export function schemaOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(0, i);
}

export function hasTable(canvas: Canvas, table: string): boolean {
  return canvas.tables.some((t) => t.table === table);
}

export function addTable(canvas: Canvas, schema: SchemaTable): Canvas {
  if (hasTable(canvas, schema.table)) return canvas;
  return {
    ...canvas,
    tables: [
      ...canvas.tables,
      { table: schema.table, columns: schema.columns.map((c) => ({ name: c.name, type: c.type, selected: false, alias: "", aggregate: "", groupBy: false })) },
    ],
  };
}

export function removeTable(canvas: Canvas, table: string): Canvas {
  return {
    ...canvas,
    tables: canvas.tables.filter((t) => t.table !== table),
    constraints: canvas.constraints.filter((c) => c.table !== table),
    order: canvas.order.filter((o) => o.table !== table),
  };
}

function mapColumn(canvas: Canvas, table: string, column: string, fn: (c: CanvasColumn) => CanvasColumn): Canvas {
  return {
    ...canvas,
    tables: canvas.tables.map((t) => (t.table === table ? { ...t, columns: t.columns.map((c) => (c.name === column ? fn(c) : c)) } : t)),
  };
}

export function toggleColumn(canvas: Canvas, table: string, column: string): Canvas {
  return mapColumn(canvas, table, column, (c) => ({ ...c, selected: !c.selected, aggregate: c.selected ? "" : c.aggregate, groupBy: c.selected ? false : c.groupBy }));
}

export function selectAll(canvas: Canvas, table: string, selected: boolean): Canvas {
  return {
    ...canvas,
    tables: canvas.tables.map((t) => (t.table === table ? { ...t, columns: t.columns.map((c) => ({ ...c, selected, ...(selected ? {} : { aggregate: "", groupBy: false }) })) } : t)),
  };
}

export function setAlias(canvas: Canvas, table: string, column: string, alias: string): Canvas {
  return mapColumn(canvas, table, column, (c) => ({ ...c, alias: alias.replace(/[^A-Za-z0-9_]/g, "_").replace(/^(\d)/, "_$1") }));
}

export function setAggregate(canvas: Canvas, table: string, column: string, aggregate: Aggregate | ""): Canvas {
  return mapColumn(canvas, table, column, (c) => ({ ...c, aggregate, selected: true, groupBy: aggregate ? false : c.groupBy }));
}

export function toggleGroupBy(canvas: Canvas, table: string, column: string): Canvas {
  return mapColumn(canvas, table, column, (c) => ({ ...c, groupBy: !c.groupBy, selected: true, aggregate: c.groupBy ? c.aggregate : "" }));
}

export function addConstraint(canvas: Canvas, table: string, attribute: string, operator: Operator = "="): Canvas {
  return { ...canvas, constraints: [...canvas.constraints, { id: canvas.nextId, table, attribute, operator, value: "" }], nextId: canvas.nextId + 1 };
}

export function updateConstraint(canvas: Canvas, id: number, patch: Partial<Omit<CanvasConstraint, "id">>): Canvas {
  return { ...canvas, constraints: canvas.constraints.map((c) => (c.id === id ? { ...c, ...patch } : c)) };
}

export function removeConstraint(canvas: Canvas, id: number): Canvas {
  return { ...canvas, constraints: canvas.constraints.filter((c) => c.id !== id) };
}

export function addOrder(canvas: Canvas, table: string, attribute: string, sort: Sort = "DESC"): Canvas {
  if (canvas.order.some((o) => o.table === table && o.attribute === attribute)) return canvas;
  return { ...canvas, order: [...canvas.order, { id: canvas.nextId, table, attribute, sort }], nextId: canvas.nextId + 1 };
}

export function updateOrder(canvas: Canvas, id: number, patch: Partial<Omit<CanvasOrder, "id">>): Canvas {
  return { ...canvas, order: canvas.order.map((o) => (o.id === id ? { ...o, ...patch } : o)) };
}

export function removeOrder(canvas: Canvas, id: number): Canvas {
  return { ...canvas, order: canvas.order.filter((o) => o.id !== id) };
}

export function moveOrder(canvas: Canvas, id: number, step: -1 | 1): Canvas {
  const i = canvas.order.findIndex((o) => o.id === id);
  const j = i + step;
  if (i < 0 || j < 0 || j >= canvas.order.length) return canvas;
  const order = [...canvas.order];
  [order[i], order[j]] = [order[j], order[i]];
  return { ...canvas, order };
}

export function setLimit(canvas: Canvas, limit: number): Canvas {
  const n = Number.isFinite(limit) ? Math.round(limit) : DEFAULT_LIMIT;
  return { ...canvas, limit: Math.max(1, Math.min(MAX_LIMIT, n)) };
}

/** Why the canvas cannot run yet, or null. */
export function validate(canvas: Canvas): string | null {
  if (canvas.tables.length === 0) return "Add a table from the schema.";
  if (!canvas.tables.some((t) => t.columns.some((c) => c.selected))) return "Pick at least one column.";
  const blank = canvas.constraints.find((c) => c.value.trim() === "");
  if (blank) return `Give the filter on ${shortTable(blank.table)}.${blank.attribute} a value.`;
  const aggregated = canvas.tables.some((t) => t.columns.some((c) => c.selected && c.aggregate));
  if (aggregated) {
    const loose = canvas.tables.flatMap((t) => t.columns.filter((c) => c.selected && !c.aggregate && !c.groupBy).map((c) => `${shortTable(t.table)}.${c.name}`));
    if (loose.length) return `With an aggregate, every other column needs Group: ${loose.join(", ")}.`;
  }
  return null;
}

/** The request SQLMate runs; what the canvas says, nothing inferred. */
export function toRequest(canvas: Canvas): QueryRequest {
  return {
    query_params: canvas.tables.map((t) => ({
      table: t.table,
      attributes: t.columns.filter((c) => c.selected).map((c) => ({ attribute: c.name, alias: c.alias })),
      constraints: canvas.constraints.filter((c) => c.table === t.table).map((c) => ({ attribute: c.attribute, operator: c.operator, value: c.value })),
      group_by: t.columns.filter((c) => c.selected && c.groupBy).map((c) => c.name),
      aggregations: t.columns.filter((c) => c.selected && c.aggregate).map((c) => ({ attribute: c.name, type: c.aggregate })),
    })),
    options: {
      limit: canvas.limit,
      ...(canvas.order.length ? { order_by: canvas.order.map((o) => ({ table_name: o.table, attribute: o.attribute, sort: o.sort })) } : {}),
    },
  };
}

/** "players × player_game_stats · 5 columns · 2 filters · top 100". */
export function describe(canvas: Canvas): string {
  if (canvas.tables.length === 0) return "Nothing on the canvas";
  const cols = canvas.tables.reduce((n, t) => n + t.columns.filter((c) => c.selected).length, 0);
  const bits = [canvas.tables.map((t) => shortTable(t.table)).join(" × "), `${cols} column${cols === 1 ? "" : "s"}`];
  if (canvas.constraints.length) bits.push(`${canvas.constraints.length} filter${canvas.constraints.length === 1 ? "" : "s"}`);
  if (canvas.order.length) bits.push(`by ${canvas.order.map((o) => `${o.attribute} ${o.sort.toLowerCase()}`).join(", ")}`);
  bits.push(`top ${canvas.limit.toLocaleString("en-US")}`);
  return bits.join(" · ");
}

/** Whether a column type takes quoted text (SQLMate's STR/DATE) rather than a number. */
export function isTextType(type: string): boolean {
  const t = type.toUpperCase();
  return t === "STR" || t === "BOOL" || t.includes("DATE") || t.includes("TIME") || t.includes("CHAR") || t.includes("TEXT");
}

export function valuePlaceholder(type: string, operator: Operator): string {
  if (operator === "LIKE") return "%jok%";
  if (operator === "SUBSTRING" || operator === "PREFIX" || operator === "SUFFIX") return "text";
  const t = type.toUpperCase();
  if (t.includes("DATE") || t.includes("TIME")) return "2026-10-20";
  if (t === "BOOL") return "true";
  return isTextType(type) ? "text" : "0";
}

/** Schema tables grouped by schema name, each group's tables in name order. */
export function groupSchema(tables: readonly SchemaTable[]): Array<{ schema: string; tables: SchemaTable[] }> {
  const groups = new Map<string, SchemaTable[]>();
  for (const t of tables) {
    const key = schemaOf(t.table);
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([schema, list]) => ({ schema, tables: [...list].sort((a, b) => a.table.localeCompare(b.table)) }));
}

export function matchTables(q: string, tables: readonly SchemaTable[]): SchemaTable[] {
  const s = q.trim().toLowerCase();
  if (!s) return [...tables];
  return tables.filter((t) => t.table.toLowerCase().includes(s) || t.columns.some((c) => c.name.toLowerCase().includes(s)));
}

/** A result's cell as text: numbers tabular, nulls as a dash, dates trimmed. */
export function cellText(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  if (typeof v === "boolean") return v ? "true" : "false";
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}T00:00:00/.test(s) ? s.slice(0, 10) : s;
}

export function isResultTable(t: Table | null | undefined): t is Table {
  return !!t && Array.isArray(t.columns) && Array.isArray(t.rows);
}

/** A result as CSV. Rows arrive as arrays in column order (objects keyed by column are read too). */
export function tableToCsv(table: Table): string {
  const cell = (v: unknown): string => {
    if (v == null) return "";
    const text = typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const head = table.columns.map(cell).join(",");
  const body = table.rows.map((row) =>
    table.columns.map((c, i) => cell(Array.isArray(row) ? row[i] : (row as Record<string, unknown>)[c])).join(",")
  );
  return [head, ...body].join("\n");
}
