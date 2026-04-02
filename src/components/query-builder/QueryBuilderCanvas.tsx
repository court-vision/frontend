import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  pointerWithin,
  useDroppable,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import { ArrowDownIcon, ArrowUpIcon, ChevronLeftIcon } from "lucide-react";
import { usePanelRef } from "react-resizable-panels";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { runVisualQuery } from "@/lib/sqlmateClient";
import type { QueryRequest, SchemaTable, Table } from "@/types/sqlmate";

import { ConsolePanel } from "./ConsolePanel";
import { TableCustomizationPanel, type Column } from "./TableCustomizationPanel";
import { TablePanel, type TableItem } from "./TablePanel";

interface OrderByItem {
  id: string;
  tableId: string;
  tableName: string;
  columnName: string;
  direction: "ASC" | "DESC";
}

interface QueryBuilderCanvasProps {
  token: string | null;
  schema: SchemaTable[];
}

const CONSOLE_PANEL_DEFAULT_SIZE = "35%";
const CONSOLE_PANEL_MIN_SIZE = "320px";
const CONSOLE_PANEL_MIN_SIZE_PX = 320;

function serializeTablesForQuery(
  droppedTables: TableItem[],
  limit?: number,
  orderByPriority?: OrderByItem[]
): QueryRequest {
  const queryParams = droppedTables.map((table) => {
    const columns = (table.customColumns || []) as Column[];
    const shouldIncludeAllOriginalColumns = columns.length === 0;

    return {
      table: table.name,
      attributes: shouldIncludeAllOriginalColumns
        ? table.columns.map((column) => ({ attribute: column.name, alias: "" }))
        : columns.map((column) => ({
            attribute: column.name,
            alias: column.alias || "",
          })),
      constraints: columns
        .filter((column) => column.constraint?.operator && column.constraint?.value)
        .map((column) => ({
          attribute: column.name,
          operator: column.constraint.operator,
          value: String(column.constraint.value),
        })),
      group_by: columns.filter((column) => column.groupBy).map((column) => column.name),
      aggregations: columns
        .filter((column) => column.aggregate)
        .map((column) => ({
          attribute: column.name,
          type: column.aggregate,
        })),
    };
  });

  const request: QueryRequest = {
    query_params: queryParams,
    options: {
      limit: limit && limit <= 1000 ? limit : 1000,
    },
  };

  if (orderByPriority && orderByPriority.length > 0) {
    request.options = {
      ...(request.options || {}),
      order_by: orderByPriority.map((item) => ({
        table_name: item.tableName,
        attribute: item.columnName,
        sort: item.direction,
      })),
    };
  }

  return request;
}

function DragPreview({ table }: { table: TableItem }) {
  return (
    <Card className="p-3 shadow-lg border-2 border-primary/40 w-64">
      <div className="font-medium text-sm">{table.name}</div>
      <div className="mt-2 text-xs text-muted-foreground">
        {table.columns.length} columns
      </div>
    </Card>
  );
}

function BuilderArea({
  droppedTables,
  setDroppedTables,
  setConsoleOutput,
  setQueryOutput,
  token,
  allTables,
}: {
  droppedTables: TableItem[];
  setDroppedTables: Dispatch<SetStateAction<TableItem[]>>;
  setConsoleOutput: (output: Table) => void;
  setQueryOutput: (output: string) => void;
  token: string | null;
  allTables: TableItem[];
}) {
  const [groupByStates, setGroupByStates] = useState<Record<string, boolean>>({});
  const [queryLimit, setQueryLimit] = useState<number | undefined>(undefined);
  const [orderByPriority, setOrderByPriority] = useState<OrderByItem[]>([]);

  const { isOver, setNodeRef } = useDroppable({ id: "studio-dropzone" });

  const anyTableHasGroupBy = useMemo(() => {
    return Object.values(groupByStates).some(Boolean);
  }, [groupByStates]);

  const handleLimitChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;

    if (value === "") {
      setQueryLimit(undefined);
      return;
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      setQueryLimit(parsed);
    }
  };

  const removeTable = useCallback((tableId: string) => {
    setGroupByStates((current) => {
      const next = { ...current };
      delete next[tableId];
      return next;
    });

    setOrderByPriority((current) => current.filter((item) => item.tableId !== tableId));

    setDroppedTables((current) => current.filter((table) => table.id !== tableId));
  }, [setDroppedTables]);

  const handleGroupByChange = useCallback((tableId: string, hasGroupBy: boolean) => {
    setGroupByStates((current) => ({
      ...current,
      [tableId]: hasGroupBy,
    }));
  }, []);

  const handleColumnsChange = useCallback((tableId: string, updatedColumns: Column[]) => {
    setDroppedTables((current) =>
      current.map((table) =>
        table.id === tableId ? { ...table, customColumns: updatedColumns } : table
      )
    );
  }, [setDroppedTables]);

  const tableCallbacks = useMemo(() => {
    return droppedTables.reduce(
      (acc, table) => {
        acc[table.id] = {
          onClose: () => removeTable(table.id),
          onGroupByChange: (hasGroupBy: boolean) =>
            handleGroupByChange(table.id, hasGroupBy),
          onColumnsChange: (columns: Column[]) =>
            handleColumnsChange(table.id, columns),
        };
        return acc;
      },
      {} as Record<
        string,
        {
          onClose: () => void;
          onGroupByChange: (hasGroupBy: boolean) => void;
          onColumnsChange: (columns: Column[]) => void;
        }
      >
    );
  }, [droppedTables, removeTable, handleGroupByChange, handleColumnsChange]);

  const handleRunVisualQuery = async () => {
    try {
      const output = await runVisualQuery(
        token,
        serializeTablesForQuery(droppedTables, queryLimit, orderByPriority)
      );

      if (!output || !output.table) {
        throw new Error("No output received from the query service");
      }

      setConsoleOutput(output.table);
      setQueryOutput(output.table.query);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "An error occurred while running the query";

      setConsoleOutput({ columns: [], rows: [], query: "" });
      setQueryOutput(`--Error: ${message}`);
    }
  };

  useEffect(() => {
    const activeItems: Record<string, OrderByItem> = {};

    droppedTables.forEach((table) => {
      if (!table.customColumns) {
        return;
      }

      table.customColumns.forEach((column) => {
        if (!column.orderBy || column.orderBy === "NONE") {
          return;
        }

        const itemId = `${table.id}-${column.name}`;
        activeItems[itemId] = {
          id: itemId,
          tableId: table.id,
          tableName: table.name,
          columnName: column.name,
          direction: column.orderBy,
        };
      });
    });

    setOrderByPriority((current) => {
      const preserved = current
        .filter((item) => activeItems[item.id])
        .map((item) => ({ ...item, direction: activeItems[item.id].direction }));

      const preservedIds = new Set(preserved.map((item) => item.id));
      const newItems = Object.values(activeItems).filter(
        (item) => !preservedIds.has(item.id)
      );

      return [...preserved, ...newItems];
    });
  }, [droppedTables]);

  const moveOrderByItemUp = (index: number) => {
    if (index <= 0) {
      return;
    }

    setOrderByPriority((current) => {
      const next = [...current];
      [next[index], next[index - 1]] = [next[index - 1], next[index]];
      return next;
    });
  };

  const moveOrderByItemDown = (index: number) => {
    if (index >= orderByPriority.length - 1) {
      return;
    }

    setOrderByPriority((current) => {
      const next = [...current];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  return (
    <div className="flex-1 p-4 h-full overflow-auto relative flex flex-col">
      <div className="flex-1 flex flex-col pb-20 relative">
        {droppedTables.length > 0 && (
          <div className="mb-4">
            {droppedTables.map((table) => (
              <TableCustomizationPanel
                key={table.id}
                tableName={table.name}
                columns={table.columns}
                allTables={allTables.map((item) => ({
                  name: item.name,
                  columns: item.columns,
                }))}
                onClose={tableCallbacks[table.id].onClose}
                onGroupByChange={tableCallbacks[table.id].onGroupByChange}
                onColumnsChange={tableCallbacks[table.id].onColumnsChange}
                initialCustomColumns={table.customColumns}
                showAggregation
                isAggregationEnabled={anyTableHasGroupBy}
              />
            ))}
          </div>
        )}

        {droppedTables.length > 0 && (
          <div className="mb-4 px-2 py-1 border border-border rounded text-xs text-muted-foreground">
            {anyTableHasGroupBy
              ? "Aggregation functions available (Group By is active)"
              : "Add Group By to enable aggregation functions"}
          </div>
        )}

        <div
          ref={setNodeRef}
          className={`flex-grow flex flex-col items-center justify-center p-8 border-2 min-h-80 rounded-lg transition-colors ${
            isOver ? "border-primary border-dashed bg-primary/10" : "border-border border-dashed"
          }`}
        >
          {isOver ? (
            <div className="text-center p-6">
              <p className="text-lg font-medium">Drop here to add to your query</p>
            </div>
          ) : (
            <div className="text-center p-6 w-full">
              <p className="mb-6 text-muted-foreground text-base">
                {droppedTables.length === 0
                  ? "Build your query by dropping tables here"
                  : "Drop more tables to add to your query"}
              </p>
            </div>
          )}
        </div>

        {orderByPriority.length > 1 && (
          <div className="absolute bottom-6 left-6 z-50">
            <div className="rounded-md p-2 max-w-md border border-border bg-card">
              <h4 className="text-xs font-medium mb-1">Order By Priority</h4>
              <div className="space-y-1">
                {orderByPriority.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-1 rounded p-1 text-xs hover:bg-accent"
                  >
                    <span className="text-muted-foreground">{index + 1}.</span>
                    <span className="font-medium">
                      {item.tableName}.{item.columnName}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      {item.direction === "ASC" ? "↑" : "↓"}
                    </span>
                    <div className="ml-auto flex">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveOrderByItemUp(index)}
                        disabled={index === 0}
                        className="h-5 w-5 p-0"
                        title="Move up in priority"
                      >
                        <ArrowUpIcon size={12} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveOrderByItemDown(index)}
                        disabled={index === orderByPriority.length - 1}
                        className="h-5 w-5 p-0"
                        title="Move down in priority"
                      >
                        <ArrowDownIcon size={12} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Use arrows to change priority (highest first)
              </p>
            </div>
          </div>
        )}

        <div className="absolute bottom-6 right-6 z-50">
          <div className="rounded-lg p-4 border border-border bg-card flex items-center gap-2">
            <div className="flex items-center">
              <label htmlFor="query-limit" className="text-sm mr-2 text-muted-foreground">
                Limit:
              </label>
              <input
                id="query-limit"
                type="number"
                min="1"
                className="w-20 px-2 py-1 text-sm border border-input rounded bg-background"
                placeholder="None"
                value={queryLimit || ""}
                onChange={handleLimitChange}
                aria-label="Query result limit"
              />
            </div>
            <Button
              className="border border-primary"
              onClick={handleRunVisualQuery}
              disabled={droppedTables.length === 0}
            >
              Run Query
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function QueryBuilderCanvas({ token, schema }: QueryBuilderCanvasProps) {
  const [consoleOutput, setConsoleOutput] = useState<Table | null>(null);
  const [queryOutput, setQueryOutput] = useState<string | null>(null);
  const [droppedTables, setDroppedTables] = useState<TableItem[]>([]);
  const [activeTable, setActiveTable] = useState<TableItem | null>(null);
  const [allTables, setAllTables] = useState<TableItem[]>([]);
  const [isConsolePanelCollapsed, setIsConsolePanelCollapsed] = useState(false);
  const [isConsolePanelAtMinSize, setIsConsolePanelAtMinSize] = useState(false);
  const consolePanelRef = usePanelRef();

  const collapseConsolePanel = useCallback(() => {
    consolePanelRef.current?.collapse();
  }, [consolePanelRef]);

  const expandConsolePanel = useCallback(() => {
    consolePanelRef.current?.expand();
  }, [consolePanelRef]);

  const schemaTables = useMemo(() => schema, [schema]);

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.data.current) {
      setActiveTable(event.active.data.current as TableItem);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTable(null);

    if (!over || over.id !== "studio-dropzone") {
      return;
    }

    const tableData = active.data.current as TableItem;
    const alreadyAdded = droppedTables.some((table) => table.id === tableData.id);

    if (!alreadyAdded) {
      setDroppedTables((current) => [...current, tableData]);
    }
  };

  const handleTablesLoaded = useCallback((tables: TableItem[]) => {
    setAllTables(tables);
  }, []);

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full w-full relative overflow-hidden">
        <TablePanel schema={schemaTables} onTablesLoaded={handleTablesLoaded} />

        <ResizablePanelGroup direction="horizontal" className="flex-1">
          <ResizablePanel className="relative">
            <BuilderArea
              droppedTables={droppedTables}
              setDroppedTables={setDroppedTables}
              setConsoleOutput={setConsoleOutput}
              setQueryOutput={setQueryOutput}
              token={token}
              allTables={allTables}
            />
            {isConsolePanelCollapsed && (
              <button
                onClick={expandConsolePanel}
                className="absolute right-2 top-4 z-50 flex items-center gap-1 bg-card border border-border rounded px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shadow-sm"
                title="Show results panel"
              >
                Results
                <ChevronLeftIcon size={12} />
              </button>
            )}
          </ResizablePanel>
          <ResizableHandle withHandle className="bg-border" />
          <ResizablePanel
            panelRef={consolePanelRef}
            defaultSize={CONSOLE_PANEL_DEFAULT_SIZE}
            minSize={CONSOLE_PANEL_MIN_SIZE}
            collapsible
            collapsedSize={0}
            onResize={(size) => {
              setIsConsolePanelCollapsed(size.asPercentage === 0);
              setIsConsolePanelAtMinSize(
                size.asPercentage > 0 && size.inPixels <= CONSOLE_PANEL_MIN_SIZE_PX + 2
              );
            }}
          >
            <ConsolePanel
              token={token}
              consoleOutput={consoleOutput}
              queryOutput={queryOutput}
              onCollapse={collapseConsolePanel}
              canCollapse={isConsolePanelAtMinSize}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <DragOverlay modifiers={[snapCenterToCursor]} dropAnimation={null}>
        {activeTable ? <DragPreview table={activeTable} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
