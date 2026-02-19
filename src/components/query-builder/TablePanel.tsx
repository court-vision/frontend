import { useEffect, useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SchemaTable } from "@/types/sqlmate";

import type { Column } from "./TableCustomizationPanel";

interface TableColumn {
  name: string;
  type: string;
}

export interface TableItem {
  id: string;
  name: string;
  columns: TableColumn[];
  customColumns?: Column[];
}

interface TablePanelProps {
  schema: SchemaTable[];
  onTablesLoaded?: (tables: TableItem[]) => void;
}

function DraggableTableItem({
  table,
  isPanelExpanded,
}: {
  table: TableItem;
  isPanelExpanded: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: table.id,
    data: table,
  });

  return (
    <Card
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.3 : 1, cursor: "grab" }}
      className="cursor-grab p-3"
      {...listeners}
      {...attributes}
    >
      <div className="font-medium text-sm">
        {isPanelExpanded ? table.name : table.name.substring(0, 1)}
      </div>
      {isPanelExpanded && (
        <div className="mt-2 text-xs text-muted-foreground">
          {table.columns.length} columns
        </div>
      )}
    </Card>
  );
}

export function TablePanel({ schema, onTablesLoaded }: TablePanelProps) {
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);

  const tables = useMemo<TableItem[]>(() => {
    return schema.map((table) => ({
      id: `${table.table}-table`,
      name: table.table,
      columns: table.columns.map((column) => ({
        name: column.name,
        type: column.type,
      })),
    }));
  }, [schema]);

  useEffect(() => {
    onTablesLoaded?.(tables);
  }, [tables, onTablesLoaded]);

  return (
    <div
      className={`border-r border-border transition-all duration-200 flex flex-col ${
        isPanelExpanded ? "w-64" : "w-16"
      }`}
      style={{ zIndex: 10 }}
    >
      <div className="p-4 border-b border-border flex justify-between items-center">
        <h2 className={`font-medium ${isPanelExpanded ? "block" : "hidden"}`}>
          Tables
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsPanelExpanded(!isPanelExpanded)}
          className="h-8 w-8"
        >
          {isPanelExpanded ? "←" : "→"}
        </Button>
      </div>

      <div className="overflow-y-auto p-3 flex flex-col gap-2 flex-1">
        {tables.length === 0 ? (
          <div className="text-center p-4 text-sm text-muted-foreground">
            No tables found.
          </div>
        ) : (
          tables.map((table) => (
            <DraggableTableItem
              key={table.id}
              table={table}
              isPanelExpanded={isPanelExpanded}
            />
          ))
        )}
      </div>
    </div>
  );
}
