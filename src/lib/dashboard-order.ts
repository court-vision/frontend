import type { DashboardWidgetItem } from "@/types/dashboard";

type Orderable = Pick<DashboardWidgetItem, "definitionId" | "x" | "y">;

/**
 * Orders dashboard widgets for the single-column phone stack.
 *
 * Widgets whose definition appears in `order` come first, in that order;
 * everything else (widgets added from the catalog, ids a template doesn't
 * know) follows in grid reading order (`y`, then `x`). Ties keep their input
 * order. Pure — never mutates `widgets`.
 */
export function orderForMobile<T extends Orderable>(
  widgets: readonly T[],
  order: readonly string[]
): T[] {
  const rank = new Map(order.map((id, index) => [id, index]));
  const known: T[] = [];
  const rest: T[] = [];
  for (const widget of widgets) {
    (rank.has(widget.definitionId) ? known : rest).push(widget);
  }
  known.sort(
    (a, b) =>
      rank.get(a.definitionId)! - rank.get(b.definitionId)! ||
      a.y - b.y ||
      a.x - b.x
  );
  rest.sort((a, b) => a.y - b.y || a.x - b.x);
  return [...known, ...rest];
}
