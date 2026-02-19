import React, { useEffect, useMemo, useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface TableColumn {
  name: string;
  type: string;
}

export interface Column {
  name: string;
  type: string;
  alias: string;
  constraint: {
    operator: string;
    value: string;
  };
  groupBy: boolean;
  aggregate: string;
  orderBy: "NONE" | "ASC" | "DESC";
  id: string;
}

interface TableCustomizationPanelProps {
  tableName: string;
  columns: TableColumn[];
  allTables: Array<{ name: string; columns: TableColumn[] }>;
  onClose: () => void;
  onGroupByChange: (hasGroupBy: boolean) => void;
  onColumnsChange: (columns: Column[]) => void;
  initialCustomColumns?: Column[];
  showAggregation?: boolean;
  isAggregationEnabled?: boolean;
}

const VALID_ALIAS_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function buildColumnId(tableName: string, columnName: string): string {
  return `${tableName}-${columnName}-${Math.random().toString(36).slice(2, 11)}`;
}

export function TableCustomizationPanel({
  tableName,
  columns: initialColumns,
  allTables,
  onClose,
  onGroupByChange,
  onColumnsChange,
  initialCustomColumns,
  showAggregation = true,
  isAggregationEnabled = false,
}: TableCustomizationPanelProps) {
  const isInitialRender = React.useRef(true);

  const [columns, setColumns] = useState<Column[]>(() => {
    if (initialCustomColumns && initialCustomColumns.length > 0) {
      return initialCustomColumns;
    }

    return initialColumns.map((col) => ({
      ...col,
      alias: "",
      constraint: { operator: "", value: "" },
      groupBy: false,
      aggregate: "",
      orderBy: "NONE",
      id: buildColumnId(tableName, col.name),
    }));
  });

  const [showAddMode, setShowAddMode] = useState(false);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, boolean>>({});
  const [aliasErrors, setAliasErrors] = useState<Record<string, boolean>>({});

  const allTableColumns = useMemo(() => {
    const tableData = allTables.find((table) => table.name === tableName);
    return tableData ? tableData.columns : [];
  }, [allTables, tableName]);

  const availableColumns = useMemo(() => {
    const currentColumnNames = columns.map((col) => col.name);
    return allTableColumns.filter((col) => !currentColumnNames.includes(col.name));
  }, [allTableColumns, columns]);

  useEffect(() => {
    onGroupByChange(columns.some((col) => col.groupBy));
  }, [columns, onGroupByChange]);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    onColumnsChange(columns);
  }, [columns, onColumnsChange]);

  const handleAliasChange = (id: string, alias: string) => {
    const isValid = alias === "" || VALID_ALIAS_PATTERN.test(alias);

    setAliasErrors((prev) => ({
      ...prev,
      [id]: !isValid,
    }));

    if (!isValid) {
      return;
    }

    setColumns((current) =>
      current.map((column) => (column.id === id ? { ...column, alias } : column))
    );
  };

  const handleConstraintOperatorChange = (id: string, operator: string) => {
    setColumns((current) =>
      current.map((column) =>
        column.id === id
          ? { ...column, constraint: { ...column.constraint, operator } }
          : column
      )
    );
  };

  const handleConstraintValueChange = (id: string, value: string) => {
    setColumns((current) =>
      current.map((column) =>
        column.id === id
          ? { ...column, constraint: { ...column.constraint, value } }
          : column
      )
    );
  };

  const handleGroupByChange = (id: string, checked: boolean) => {
    setColumns((current) =>
      current.map((column) => (column.id === id ? { ...column, groupBy: checked } : column))
    );
  };

  const handleAggregateChange = (id: string, aggregate: string) => {
    setColumns((current) =>
      current.map((column) => (column.id === id ? { ...column, aggregate } : column))
    );
  };

  const handleOrderByChange = (id: string) => {
    const nextState = (current: "NONE" | "ASC" | "DESC"): "NONE" | "ASC" | "DESC" => {
      if (current === "NONE") {
        return "ASC";
      }

      if (current === "ASC") {
        return "DESC";
      }

      return "NONE";
    };

    setColumns((current) =>
      current.map((column) =>
        column.id === id ? { ...column, orderBy: nextState(column.orderBy) } : column
      )
    );
  };

  const toggleAddMode = () => {
    if (showAddMode) {
      setShowAddMode(false);
      setSelectedAttributes({});
      return;
    }

    const initialSelection: Record<string, boolean> = {};
    availableColumns.forEach((column) => {
      initialSelection[column.name] = false;
    });

    setSelectedAttributes(initialSelection);
    setShowAddMode(true);
  };

  const toggleAttributeSelection = (columnName: string) => {
    setSelectedAttributes((previous) => ({
      ...previous,
      [columnName]: !previous[columnName],
    }));
  };

  const addSelectedAttributes = () => {
    const selectedColumns = availableColumns.filter((col) => selectedAttributes[col.name]);

    setColumns((current) => [
      ...current,
      ...selectedColumns.map((column) => ({
        name: column.name,
        type: column.type,
        alias: "",
        constraint: { operator: "", value: "" },
        groupBy: false,
        aggregate: "",
        orderBy: "NONE" as const,
        id: buildColumnId(tableName, column.name),
      })),
    ]);

    setShowAddMode(false);
    setSelectedAttributes({});
  };

  const removeColumn = (id: string) => {
    setColumns((current) => current.filter((column) => column.id !== id));
  };

  const hasSelectedNewColumns = Object.values(selectedAttributes).some(Boolean);

  return (
    <Card className="mb-4 p-2">
      <div className="flex justify-between items-center border-b border-border pb-2 mb-2">
        <h3 className="text-sm font-medium">{tableName}</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0 text-red-500 hover:text-red-400"
        >
          ×
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-1 pr-4 text-muted-foreground">Attribute</th>
              <th className="text-left py-1 pr-4 text-muted-foreground">Type</th>
              <th className="text-left py-1 pr-4 text-muted-foreground" colSpan={2}>
                Constraint
              </th>
              <th className="text-left py-1 pr-4 text-muted-foreground">Group By</th>
              {showAggregation && (
                <th className="text-left py-1 pr-4 w-[160px] text-muted-foreground">
                  <div className="flex items-center">
                    <span>Aggregate</span>
                    {!isAggregationEnabled && (
                      <span className="text-xs text-muted-foreground ml-1 whitespace-nowrap">
                        (disabled)
                      </span>
                    )}
                  </div>
                </th>
              )}
              <th className="text-left py-1 pr-4 text-center text-muted-foreground">Order</th>
              <th className="text-left py-1 pr-4 w-8" />
            </tr>
          </thead>
          <tbody>
            {columns.map((column) => (
              <tr key={column.id} className="border-b border-border/60 hover:bg-accent/20">
                <td className="py-1 px-2 w-[140px]">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium">{column.name}</span>
                    <div className="flex flex-col">
                      <input
                        type="text"
                        value={column.alias}
                        onChange={(event) => handleAliasChange(column.id, event.target.value)}
                        placeholder="AS..."
                        className={`bg-background border border-input px-1 py-0.5 text-xs w-full rounded ${
                          aliasErrors[column.id]
                            ? "border-red-500 focus:ring-red-500"
                            : "focus:ring-primary"
                        }`}
                      />
                      {aliasErrors[column.id] && (
                        <span className="text-xs text-red-500 mt-0.5">Invalid format</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-1 px-2 w-[80px]">
                  <span className="text-xs text-muted-foreground">{column.type}</span>
                </td>
                <td className="py-1 px-2 w-[100px]">
                  <select
                    className="bg-background border border-input px-1 py-0.5 text-xs w-full rounded"
                    value={column.constraint.operator}
                    onChange={(event) =>
                      handleConstraintOperatorChange(column.id, event.target.value)
                    }
                  >
                    <option value="">-</option>
                    <option value="=">=</option>
                    <option value="<">{"<"}</option>
                    <option value=">">{">"}</option>
                    <option value="<=">{"<="}</option>
                    <option value=">=">{">="}</option>
                    <option value="!=">{"!="}</option>
                    <option value="PREFIX">PREFIX</option>
                    <option value="SUFFIX">SUFFIX</option>
                    <option value="SUBSTRING">SUBSTRING</option>
                  </select>
                </td>
                <td className="py-1 px-2 w-[200px]">
                  <input
                    type="text"
                    className="bg-background border border-input px-1 py-0.5 text-xs w-full rounded"
                    placeholder="Value"
                    value={column.constraint.value}
                    onChange={(event) => handleConstraintValueChange(column.id, event.target.value)}
                    disabled={!column.constraint.operator}
                  />
                </td>
                <td className="py-1 px-2 w-[60px] text-center">
                  <input
                    type="checkbox"
                    className="h-3 w-3"
                    checked={column.groupBy}
                    onChange={(event) => handleGroupByChange(column.id, event.target.checked)}
                  />
                </td>
                {showAggregation && (
                  <td className="py-1 px-2 w-[160px]">
                    <select
                      className="bg-background border border-input px-1 py-0.5 text-xs w-full rounded"
                      value={column.aggregate}
                      onChange={(event) => handleAggregateChange(column.id, event.target.value)}
                      disabled={!isAggregationEnabled}
                    >
                      <option value="">-</option>
                      <option value="sum">sum</option>
                      <option value="avg">avg</option>
                      <option value="min">min</option>
                      <option value="max">max</option>
                      <option value="count">count</option>
                    </select>
                  </td>
                )}
                <td className="py-1 pr-2 w-[60px] text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOrderByChange(column.id)}
                    title={
                      column.orderBy === "NONE"
                        ? "No ordering"
                        : column.orderBy === "ASC"
                        ? "Sort ascending"
                        : "Sort descending"
                    }
                    className="h-6 w-6 p-0"
                  >
                    {column.orderBy === "NONE" && <MinusIcon size={14} />}
                    {column.orderBy === "ASC" && <ArrowUpIcon size={14} />}
                    {column.orderBy === "DESC" && <ArrowDownIcon size={14} />}
                  </Button>
                </td>
                <td className="py-1 px-2 w-[40px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeColumn(column.id)}
                    className="h-5 w-5 p-0"
                  >
                    <Trash2Icon size={12} />
                  </Button>
                </td>
              </tr>
            ))}

            {showAddMode &&
              availableColumns.map((column) => (
                <tr
                  key={`add-${column.name}`}
                  className={`border-b border-border/60 cursor-pointer ${
                    selectedAttributes[column.name] ? "bg-primary/10" : "opacity-70"
                  }`}
                  onClick={() => toggleAttributeSelection(column.name)}
                >
                  <td className="py-1 px-2 w-[140px]">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedAttributes[column.name] || false}
                        onChange={() => toggleAttributeSelection(column.name)}
                        onClick={(event) => event.stopPropagation()}
                      />
                      <span className="text-xs font-medium text-muted-foreground">
                        {column.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-1 px-2 w-[80px]">
                    <span className="text-xs text-muted-foreground">{column.type}</span>
                  </td>
                  <td className="py-1 px-2 w-[100px]">
                    <span className="text-xs text-muted-foreground opacity-50">-</span>
                  </td>
                  <td className="py-1 px-2 w-[200px]">
                    <span className="text-xs text-muted-foreground opacity-50">-</span>
                  </td>
                  <td className="py-1 px-2 w-[60px] text-center">
                    <span className="text-xs text-muted-foreground opacity-50">-</span>
                  </td>
                  {showAggregation && (
                    <td className="py-1 px-2 w-[160px]">
                      <span className="text-xs text-muted-foreground opacity-50">-</span>
                    </td>
                  )}
                  <td className="py-1 pr-2 w-[60px] text-center">
                    <span className="text-xs text-muted-foreground opacity-50">-</span>
                  </td>
                  <td className="py-1 px-2 w-[40px]">
                    <span className="text-xs text-muted-foreground opacity-50">-</span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex justify-end gap-2">
        {showAddMode ? (
          <>
            <Button variant="ghost" size="sm" onClick={toggleAddMode} className="text-xs h-6">
              Cancel
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={addSelectedAttributes}
              disabled={!hasSelectedNewColumns}
              className="text-xs h-6"
            >
              <PlusIcon size={12} /> Add Selected
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleAddMode}
            disabled={availableColumns.length === 0}
            className="text-xs h-6"
          >
            <PlusIcon size={12} /> Add attribute
          </Button>
        )}
      </div>
    </Card>
  );
}
