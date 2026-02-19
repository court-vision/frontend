"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  Download,
  PencilIcon,
  RefreshCw,
  TrashIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { downloadTableAsCSV } from "@/lib/csvUtils";
import {
  deleteTables,
  getTableData,
  getTables,
  updateTable,
} from "@/lib/sqlmateClient";
import type {
  Table,
  TableUpdateAttribute,
  TableUpdateConstraint,
  UserTable,
} from "@/types/sqlmate";

import { QueryResultTable } from "./QueryResultTable";
import { TableUpdatePanel } from "./TableUpdatePanel";

interface MyTablesPanelProps {
  token: string;
}

export function MyTablesPanel({ token }: MyTablesPanelProps) {
  const [tables, setTables] = useState<UserTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState<string | null>(null);

  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [rowData, setRowData] = useState<Record<string, Table>>({});
  const [rowLoading, setRowLoading] = useState<Record<string, boolean>>({});

  const [editingRows, setEditingRows] = useState<Record<string, boolean>>({});
  const [rowUpdateLoading, setRowUpdateLoading] = useState<Record<string, boolean>>({});

  const selectedCount = selectedTables.length;

  const fetchTables = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getTables(token);
      setTables(data.tables || []);
      setSelectedTables([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load tables";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, [token]);

  const allSelected = useMemo(() => {
    return tables.length > 0 && selectedTables.length === tables.length;
  }, [selectedTables.length, tables.length]);

  const handleToggleSelection = (tableName: string) => {
    setSelectedTables((current) =>
      current.includes(tableName)
        ? current.filter((name) => name !== tableName)
        : [...current, tableName]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedTables([]);
      return;
    }

    setSelectedTables(tables.map((table) => table.table_name));
  };

  const handleDeleteTable = async (tableName: string) => {
    if (!window.confirm(`Delete table \"${tableName}\"?`)) {
      return;
    }

    setDeleteLoading(true);

    try {
      await deleteTables(token, [tableName]);
      setTables((current) => current.filter((table) => table.table_name !== tableName));
      setSelectedTables((current) => current.filter((name) => name !== tableName));

      setExpandedRows((current) => {
        const next = { ...current };
        delete next[tableName];
        return next;
      });

      setEditingRows((current) => {
        const next = { ...current };
        delete next[tableName];
        return next;
      });

      toast.success(`Deleted ${tableName}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete table";
      setError(message);
      toast.error(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTables.length === 0) {
      return;
    }

    if (!window.confirm(`Delete ${selectedTables.length} selected table(s)?`)) {
      return;
    }

    setDeleteLoading(true);

    try {
      const response = await deleteTables(token, selectedTables);
      const deleted = response.deleted_tables || selectedTables;

      setTables((current) =>
        current.filter((table) => !deleted.includes(table.table_name))
      );
      setSelectedTables([]);

      setExpandedRows((current) => {
        const next = { ...current };
        deleted.forEach((name) => delete next[name]);
        return next;
      });

      setEditingRows((current) => {
        const next = { ...current };
        deleted.forEach((name) => delete next[name]);
        return next;
      });

      toast.success(`Deleted ${deleted.length} table(s)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete tables";
      setError(message);
      toast.error(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const loadRowData = async (tableName: string) => {
    setRowLoading((current) => ({ ...current, [tableName]: true }));

    try {
      const response = await getTableData(token, tableName);
      if (!response.table) {
        throw new Error("No table data received");
      }

      setRowData((current) => ({ ...current, [tableName]: response.table! }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch table data";
      toast.error(message);
      setError(message);
    } finally {
      setRowLoading((current) => ({ ...current, [tableName]: false }));
    }
  };

  const handleToggleExpand = async (tableName: string) => {
    const isExpanded = Boolean(expandedRows[tableName]);
    const nextExpanded = !isExpanded;

    setExpandedRows((current) => ({ ...current, [tableName]: nextExpanded }));

    if (nextExpanded && !rowData[tableName] && !rowLoading[tableName]) {
      await loadRowData(tableName);
    }
  };

  const handleDownloadCSV = async (tableName: string) => {
    setDownloadLoading(tableName);

    try {
      const response = await getTableData(token, tableName);
      if (!response.table) {
        throw new Error("No table data received");
      }

      const source = response.table;
      const csvReadyTable: Table = {
        ...source,
        rows: source.rows.map((row) => {
          const objectRow: Record<string, unknown> = {};
          source.columns.forEach((column, index) => {
            objectRow[column] = (row as unknown[])[index];
          });
          return objectRow;
        }),
      };

      downloadTableAsCSV(csvReadyTable, tableName);
      toast.success(`${tableName}.csv downloaded`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to download table";
      setError(message);
      toast.error(message);
    } finally {
      setDownloadLoading(null);
    }
  };

  const handleToggleEdit = async (tableName: string) => {
    const isEditing = Boolean(editingRows[tableName]);
    const nextEditing = !isEditing;

    setEditingRows((current) => ({ ...current, [tableName]: nextEditing }));

    if (nextEditing && !expandedRows[tableName]) {
      await handleToggleExpand(tableName);
    }
  };

  const handleUpdateSubmit =
    (tableName: string) =>
    async (
      updates: TableUpdateAttribute[],
      constraints: TableUpdateConstraint[]
    ) => {
      setRowUpdateLoading((current) => ({ ...current, [tableName]: true }));

      try {
        const result = await updateTable(token, {
          query_params: {
            table: tableName,
            updates,
            constraints,
          },
        });

        toast.success(`${result.rows_affected || 0} row(s) updated`);
        await loadRowData(tableName);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update table";
        toast.error(message);
      } finally {
        setRowUpdateLoading((current) => ({ ...current, [tableName]: false }));
      }
    };

  return (
    <div className="h-full p-6 overflow-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Saved Tables</h1>
        <div className="flex gap-2">
          {selectedCount > 0 && (
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={deleteLoading}
              className="flex items-center gap-2"
            >
              <TrashIcon size={16} />
              Delete Selected ({selectedCount})
            </Button>
          )}
          <Button
            variant="outline"
            onClick={fetchTables}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="p-4 mb-6 border border-red-500/50 text-red-500">
          <p>{error}</p>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center p-12">
          <RefreshCw size={20} className="animate-spin" />
        </div>
      ) : tables.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground mb-2">
            You do not have any saved tables yet.
          </p>
          <p className="text-sm text-muted-foreground">
            Run a query and click Save Table to store your results.
          </p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="py-3 px-3 text-left font-medium w-10" />
                <th className="py-3 px-3 text-left font-medium w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(value) => handleSelectAll(Boolean(value))}
                    aria-label="Select all tables"
                  />
                </th>
                <th className="py-3 px-3 text-left font-medium">Table Name</th>
                <th className="py-3 px-3 text-left font-medium">Created</th>
                <th className="py-3 px-3 text-right font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {tables.map((table, index) => {
                const tableName = table.table_name;
                const isExpanded = Boolean(expandedRows[tableName]);
                const isEditing = Boolean(editingRows[tableName]);
                const isRowLoading = Boolean(rowLoading[tableName]);
                const tableResult = rowData[tableName];

                return (
                  <Fragment key={tableName}>
                    <tr
                      className={`${index % 2 === 0 ? "bg-background" : "bg-muted/20"} hover:bg-muted/30`}
                    >
                      <td className="py-3 px-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleToggleExpand(tableName)}
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </Button>
                      </td>

                      <td className="py-3 px-3">
                        <Checkbox
                          checked={selectedTables.includes(tableName)}
                          onCheckedChange={() => handleToggleSelection(tableName)}
                          aria-label={`Select ${tableName}`}
                        />
                      </td>

                      <td className="py-3 px-3 font-medium">{tableName}</td>

                      <td className="py-3 px-3 text-muted-foreground">
                        {formatDistanceToNow(new Date(`${table.created_at}Z`), {
                          addSuffix: true,
                        })}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleToggleEdit(tableName)}
                          >
                            <PencilIcon size={16} />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleDeleteTable(tableName)}
                            disabled={deleteLoading}
                          >
                            <TrashIcon size={16} />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleDownloadCSV(tableName)}
                            disabled={downloadLoading === tableName}
                          >
                            <Download size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {(isExpanded || isEditing) && (
                      <tr className="bg-card">
                        <td colSpan={5} className="py-4 px-4 border-t border-border">
                          <div className="space-y-4">
                            {isRowLoading ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <RefreshCw size={14} className="animate-spin" /> Loading table data...
                              </div>
                            ) : tableResult ? (
                              <QueryResultTable data={tableResult} itemsPerPage={10} />
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                No table data available.
                              </p>
                            )}

                            {isEditing && tableResult && (
                              <TableUpdatePanel
                                columns={tableResult.columns.map((column) => ({
                                  name: column,
                                  type: "",
                                }))}
                                onSubmit={handleUpdateSubmit(tableName)}
                                isSubmitting={Boolean(rowUpdateLoading[tableName])}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
