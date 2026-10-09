export type DevView = "overview" | "reference" | "playground" | "keys" | "query";

export const VIEWS: ReadonlyArray<{ id: DevView; label: string; title: string }> = [
  { id: "overview", label: "OVERVIEW", title: "Status, where things are, the first call" },
  { id: "reference", label: "REFERENCE", title: "Every public route, from the live OpenAPI document" },
  { id: "playground", label: "PLAYGROUND", title: "Fill a route in and send it" },
  { id: "keys", label: "KEYS", title: "Your API keys" },
  { id: "query", label: "QUERY", title: "SQLMate, the visual query builder" },
];

export function isView(v: unknown): v is DevView {
  return typeof v === "string" && VIEWS.some((x) => x.id === v);
}

export function nextView(view: DevView, step: 1 | -1): DevView {
  const i = VIEWS.findIndex((v) => v.id === view);
  return VIEWS[(i + step + VIEWS.length) % VIEWS.length].id;
}

export interface DevInitial {
  view: DevView;
  op: string | null;
  guide: string | null;
}

/** What the URL asks the desk to open: `?view=`, `?op=<method:path>`, `?g=<guide>`. */
export function devInitial(params: Record<string, string | string[] | undefined>): DevInitial {
  const view = isView(params.view) ? params.view : "overview";
  return {
    view,
    op: typeof params.op === "string" && params.op ? params.op : null,
    guide: typeof params.g === "string" && params.g ? params.g : null,
  };
}
