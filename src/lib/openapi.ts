/**
 * The API reference's model: the live OpenAPI document (`GET /openapi.json`)
 * reduced to the public operations, with `$ref`s resolved into trees the
 * sheet can draw, sample values for a request, and the snippets that call
 * it. Pure: no React, no fetching.
 */

export interface Schema {
  $ref?: string;
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  anyOf?: Schema[];
  oneOf?: Schema[];
  allOf?: Schema[];
  enum?: Array<string | number | null>;
  default?: unknown;
  format?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  additionalProperties?: Schema | boolean;
  nullable?: boolean;
  const?: unknown;
}

interface RawParam {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: Schema;
}

interface RawOp {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: RawParam[];
  requestBody?: { content?: Record<string, { schema?: Schema }>; required?: boolean };
  responses?: Record<string, { description?: string; content?: Record<string, { schema?: Schema }> }>;
  security?: Array<Record<string, string[]>>;
}

export interface OpenApiDoc {
  openapi?: string;
  info?: { title?: string; version?: string; description?: string };
  paths: Record<string, Record<string, RawOp>>;
  components?: { schemas?: Record<string, Schema>; securitySchemes?: Record<string, unknown> };
}

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiParam {
  name: string;
  in: "path" | "query" | "header";
  required: boolean;
  schema: Schema;
  description: string | null;
}

export interface ApiResponse {
  status: string;
  description: string;
  schema: Schema | null;
}

export interface ApiOp {
  /** "get:/v1/players/{player_id}/stats" — stable, URL-safe enough for `?op=`. */
  id: string;
  method: Method;
  path: string;
  tag: string;
  summary: string;
  description: string | null;
  params: ApiParam[];
  body: Schema | null;
  responses: ApiResponse[];
  auth: "none" | "api-key";
  /** The scope an API key needs, read from the description ("'analytics' scope"). */
  scope: string | null;
  rateLimit: string;
}

const METHODS: Method[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

/** The order the reference lists tags in; anything else follows alphabetically. */
const TAG_ORDER = ["Players", "Rankings", "Teams", "Games", "Schedule", "Live", "Ownership", "Analytics", "SQLMate", "Meta"];

const HIDDEN_PATHS = new Set(["/", "/ping"]);

export function opId(method: string, path: string): string {
  return `${method.toLowerCase()}:${path}`;
}

/** The rate limit a route runs under; mirrors core/rate_limit.py. */
export function rateLimitFor(path: string, auth: "none" | "api-key"): string {
  if (path.startsWith("/v1/sqlmate/query")) return "30 / min per IP";
  if (auth === "api-key") return "1,000 / min per key";
  if (path === "/health") return "unlimited";
  return "100 / min per IP";
}

export function scopeFor(description: string | null | undefined): string | null {
  const m = /['"]([a-z_]+)['"] scope/i.exec(description ?? "");
  return m ? m[1] : null;
}

/** Every public operation in the document, grouped order by tag then path. */
export function publicOps(doc: OpenApiDoc): ApiOp[] {
  const ops: ApiOp[] = [];
  for (const [path, methods] of Object.entries(doc.paths ?? {})) {
    if (path.startsWith("/v1/internal") || HIDDEN_PATHS.has(path)) continue;
    for (const [m, raw] of Object.entries(methods)) {
      const method = m.toUpperCase() as Method;
      if (!METHODS.includes(method)) continue;
      const auth = raw.security && raw.security.length > 0 ? "api-key" : "none";
      const body = raw.requestBody?.content?.["application/json"]?.schema ?? null;
      const responses = Object.entries(raw.responses ?? {}).map(([status, r]) => ({
        status,
        description: r.description ?? "",
        schema: r.content?.["application/json"]?.schema ?? null,
      }));
      ops.push({
        id: opId(method, path),
        method,
        path,
        tag: raw.tags?.[0] ?? (path === "/health" ? "Meta" : "Other"),
        summary: raw.summary ?? path,
        description: raw.description ?? null,
        params: (raw.parameters ?? [])
          .filter((p): p is RawParam & { in: "path" | "query" | "header" } => p.in !== "cookie")
          .map((p) => ({
            name: p.name,
            in: p.in,
            required: p.required ?? p.in === "path",
            schema: p.schema ?? {},
            description: p.description ?? p.schema?.description ?? null,
          })),
        body,
        responses,
        auth,
        scope: auth === "api-key" ? scopeFor(raw.description) : null,
        rateLimit: rateLimitFor(path, auth),
      });
    }
  }
  const rank = (tag: string) => {
    const i = TAG_ORDER.indexOf(tag);
    return i === -1 ? TAG_ORDER.length : i;
  };
  return ops.sort((a, b) => rank(a.tag) - rank(b.tag) || a.tag.localeCompare(b.tag) || a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

export interface TagGroup {
  tag: string;
  ops: ApiOp[];
}

export function groupByTag(ops: ApiOp[]): TagGroup[] {
  const groups: TagGroup[] = [];
  for (const op of ops) {
    const g = groups.find((x) => x.tag === op.tag);
    if (g) g.ops.push(op);
    else groups.push({ tag: op.tag, ops: [op] });
  }
  return groups;
}

/** Operations whose path, summary or tag contains the query. */
export function matchOps(q: string, ops: readonly ApiOp[]): ApiOp[] {
  const s = q.trim().toLowerCase();
  if (!s) return [...ops];
  const score = (op: ApiOp): number => {
    const path = op.path.toLowerCase();
    if (path.includes(s)) return path.indexOf(s);
    if (op.summary.toLowerCase().includes(s)) return 100;
    if (op.tag.toLowerCase().includes(s)) return 200;
    if ((op.description ?? "").toLowerCase().includes(s)) return 300;
    return -1;
  };
  return ops
    .map((op) => ({ op, s: score(op) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s)
    .map((x) => x.op);
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export function refName(ref: string | undefined): string | null {
  if (!ref) return null;
  const m = /^#\/components\/schemas\/(.+)$/.exec(ref);
  return m ? m[1] : null;
}

/** The schema a `$ref` points at (the input when it is not a ref, {} when the ref is dangling). */
export function resolve(doc: OpenApiDoc, schema: Schema | null | undefined): Schema {
  if (!schema) return {};
  const name = refName(schema.$ref);
  if (!name) return schema;
  return doc.components?.schemas?.[name] ?? {};
}

function unwrapNullable(schema: Schema): { inner: Schema; nullable: boolean } {
  const alts = schema.anyOf ?? schema.oneOf;
  if (alts && alts.length) {
    const nonNull = alts.filter((a) => a.type !== "null");
    const nullable = nonNull.length < alts.length || !!schema.nullable;
    if (nonNull.length === 1) return { inner: nonNull[0], nullable };
    return { inner: { ...schema, anyOf: nonNull, oneOf: undefined }, nullable };
  }
  if (schema.allOf && schema.allOf.length === 1) return { inner: schema.allOf[0], nullable: !!schema.nullable };
  if (Array.isArray(schema.type)) {
    const types = schema.type.filter((t) => t !== "null");
    return { inner: { ...schema, type: types.length === 1 ? types[0] : types }, nullable: types.length < schema.type.length };
  }
  return { inner: schema, nullable: !!schema.nullable };
}

/** "integer", "string (date)", "PlayerStatsResp", "GameLog[]", "number | null", "\"up\" | \"down\"". */
export function typeLabel(doc: OpenApiDoc, schema: Schema | null | undefined, depth: number = 0): string {
  if (!schema) return "any";
  const { inner, nullable } = unwrapNullable(schema);
  const suffix = nullable ? " | null" : "";
  const name = refName(inner.$ref);
  if (name) return `${name}${suffix}`;
  if (inner.anyOf && inner.anyOf.length > 1) return inner.anyOf.map((a) => typeLabel(doc, a, depth + 1)).join(" | ") + suffix;
  if (inner.enum && inner.enum.length) return inner.enum.map((e) => (typeof e === "string" ? `"${e}"` : String(e))).join(" | ") + suffix;
  if (inner.const !== undefined) return `"${String(inner.const)}"${suffix}`;
  const type = Array.isArray(inner.type) ? inner.type.join(" | ") : inner.type;
  if (type === "array") return `${typeLabel(doc, inner.items, depth + 1)}[]${suffix}`;
  if (type === "object") {
    if (inner.properties && Object.keys(inner.properties).length) return `object${suffix}`;
    if (inner.additionalProperties && typeof inner.additionalProperties === "object") return `Record<string, ${typeLabel(doc, inner.additionalProperties, depth + 1)}>${suffix}`;
    return `object${suffix}`;
  }
  if (type === "string" && inner.format) return `string (${inner.format})${suffix}`;
  return `${type ?? "any"}${suffix}`;
}

export interface TreeNode {
  name: string;
  type: string;
  required: boolean;
  description: string | null;
  children: TreeNode[];
  /** The named schema this node is, so it can be linked or collapsed. */
  ref: string | null;
  constraints: string | null;
}

function constraintsText(s: Schema): string | null {
  const bits: string[] = [];
  if (s.default !== undefined && s.default !== null) bits.push(`default ${JSON.stringify(s.default)}`);
  if (s.minimum !== undefined) bits.push(`≥ ${s.minimum}`);
  if (s.maximum !== undefined) bits.push(`≤ ${s.maximum}`);
  if (s.minLength !== undefined) bits.push(`min ${s.minLength}`);
  if (s.maxLength !== undefined) bits.push(`max ${s.maxLength}`);
  if (s.pattern) bits.push(`/${s.pattern}/`);
  return bits.length ? bits.join(" · ") : null;
}

/**
 * A schema as a tree of fields, three levels deep at most, with a named
 * schema expanded once (the second time it is a leaf that names itself).
 */
export function schemaTree(doc: OpenApiDoc, schema: Schema | null | undefined, depth: number = 0, seen: ReadonlySet<string> = new Set()): TreeNode[] {
  if (!schema || depth > 4) return [];
  const { inner } = unwrapNullable(schema);
  const name = refName(inner.$ref);
  const resolved = name ? resolve(doc, inner) : inner;
  if (name && seen.has(name)) return [];
  const nextSeen = name ? new Set([...seen, name]) : seen;
  const type = Array.isArray(resolved.type) ? resolved.type[0] : resolved.type;
  if (type === "array" || (!type && resolved.items)) {
    return schemaTree(doc, resolved.items, depth, nextSeen);
  }
  const props = resolved.properties ?? {};
  const required = new Set(resolved.required ?? []);
  return Object.entries(props).map(([key, prop]) => {
    const { inner: pInner } = unwrapNullable(prop);
    const pName = refName(pInner.$ref) ?? (pInner.type === "array" ? refName(unwrapNullable(pInner.items ?? {}).inner.$ref) : null);
    const pResolved = resolve(doc, pInner);
    return {
      name: key,
      type: typeLabel(doc, prop),
      required: required.has(key),
      description: prop.description ?? pResolved.description ?? null,
      children: depth < 3 ? schemaTree(doc, prop, depth + 1, nextSeen) : [],
      ref: pName,
      constraints: constraintsText(prop),
    };
  });
}

/** A value that satisfies a schema, for the playground's first request body. */
export function sampleValue(doc: OpenApiDoc, schema: Schema | null | undefined, depth: number = 0): unknown {
  if (!schema || depth > 4) return null;
  const { inner } = unwrapNullable(schema);
  const resolved = resolve(doc, inner);
  if (resolved.default !== undefined) return resolved.default;
  if (resolved.enum && resolved.enum.length) return resolved.enum[0];
  if (resolved.const !== undefined) return resolved.const;
  const type = Array.isArray(resolved.type) ? resolved.type[0] : resolved.type;
  switch (type) {
    case "integer":
      return resolved.minimum ?? 1;
    case "number":
      return resolved.minimum ?? 1;
    case "boolean":
      return false;
    case "string":
      if (resolved.format === "date") return "2026-10-20";
      if (resolved.format === "date-time") return "2026-10-20T00:00:00Z";
      return "";
    case "array":
      return [];
    case "object": {
      const out: Record<string, unknown> = {};
      for (const [k, p] of Object.entries(resolved.properties ?? {})) out[k] = sampleValue(doc, p, depth + 1);
      return out;
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/** What to put in a path parameter when nothing better is known: a real id a reader will recognise. */
const PATH_EXAMPLES: Record<string, string> = {
  player_id: "203999",
  team_abbrev: "DEN",
  game_date: "",
  date: "",
};

export function paramDefaults(op: ApiOp, today: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of op.params) {
    if (p.in === "path") {
      const ex = PATH_EXAMPLES[p.name];
      out[p.name] = ex === "" ? today : (ex ?? "");
    } else {
      const d = p.schema.default;
      out[p.name] = d === undefined || d === null ? "" : String(d);
    }
  }
  return out;
}

/** The URL for an operation with its parameters filled; query params left blank are not sent. */
export function buildUrl(base: string, op: ApiOp, values: Record<string, string>): string {
  let path = op.path.replace(/\{([^}]+)\}/g, (_, name: string) => encodeURIComponent(values[name] ?? ""));
  const q = new URLSearchParams();
  for (const p of op.params) {
    if (p.in !== "query") continue;
    const v = values[p.name];
    if (v !== undefined && v !== "") q.set(p.name, v);
  }
  const qs = q.toString();
  if (qs) path += `?${qs}`;
  return `${base}${path}`;
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

export function curlFor(url: string, method: Method, key: string | null, body: string | null): string {
  const lines = [`curl ${method === "GET" ? "" : `-X ${method} `}${shellQuote(url)}`];
  lines.push(`  -H 'Accept: application/json'`);
  if (key) lines.push(`  -H 'X-API-Key: ${key}'`);
  if (body != null && method !== "GET") {
    lines.push(`  -H 'Content-Type: application/json'`);
    lines.push(`  -d ${shellQuote(body)}`);
  }
  return lines.join(" \\\n");
}

export function fetchSnippet(url: string, method: Method, key: string | null, body: string | null): string {
  const headers: string[] = [`"Accept": "application/json"`];
  if (key) headers.push(`"X-API-Key": "${key}"`);
  if (body != null && method !== "GET") headers.push(`"Content-Type": "application/json"`);
  const opts = [`method: "${method}"`, `headers: { ${headers.join(", ")} }`];
  if (body != null && method !== "GET") opts.push(`body: JSON.stringify(${body})`);
  return `const res = await fetch("${url}", {\n  ${opts.join(",\n  ")},\n});\nconst { status, data } = await res.json();`;
}

/** JSON text as a Python literal: true/false/null become True/False/None; non-JSON passes through. */
export function pythonLiteral(json: string): string {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return json;
  }
  const py = (v: unknown, depth: number): string => {
    if (v === null) return "None";
    if (v === true) return "True";
    if (v === false) return "False";
    if (typeof v === "number") return String(v);
    if (typeof v === "string") return JSON.stringify(v);
    const pad = "  ".repeat(depth + 1);
    const end = "  ".repeat(depth);
    if (Array.isArray(v)) return v.length ? `[\n${v.map((x) => pad + py(x, depth + 1)).join(",\n")}\n${end}]` : "[]";
    const entries = Object.entries(v as Record<string, unknown>);
    return entries.length ? `{\n${entries.map(([k, x]) => `${pad}${JSON.stringify(k)}: ${py(x, depth + 1)}`).join(",\n")}\n${end}}` : "{}";
  };
  return py(value, 0);
}

export function pythonSnippet(url: string, method: Method, key: string | null, body: string | null): string {
  const headers: string[] = [`"Accept": "application/json"`];
  if (key) headers.push(`"X-API-Key": "${key}"`);
  const call = method === "GET" ? "get" : method.toLowerCase();
  const args = [`"${url}"`, `headers={${headers.join(", ")}}`];
  if (body != null && method !== "GET") args.push(`json=${pythonLiteral(body)}`);
  return `import requests\n\nres = requests.${call}(${args.join(", ")})\nres.raise_for_status()\ndata = res.json()["data"]`;
}

/** The pretty JSON a playground shows, or the raw text when it is not JSON. */
export function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

/** "1.2 KB", "834 B". */
export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
