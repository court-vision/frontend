import { useState } from "react";
import { AlertCircle, ChevronRightIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { saveTable } from "@/lib/sqlmateClient";
import type { Table } from "@/types/sqlmate";

import { QueryResultTable } from "./QueryResultTable";

interface ConsolePanelProps {
  token: string;
  consoleOutput: Table | null;
  queryOutput: string | null;
  onTableSaved?: () => void;
  onCollapse?: () => void;
  canCollapse?: boolean;
}

export function ConsolePanel({
  token,
  consoleOutput,
  queryOutput,
  onTableSaved,
  onCollapse,
  canCollapse = false,
}: ConsolePanelProps) {
  const [activeTab, setActiveTab] = useState<"results" | "query">("results");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [tableName, setTableName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveTable = async () => {
    if (!queryOutput) {
      setSaveError("No query results to save");
      return;
    }

    if (!tableName.trim()) {
      setSaveError("Please enter a valid table name");
      return;
    }

    setSaveError(null);
    setSaveSuccess(null);
    setIsSaving(true);

    try {
      await saveTable(token, {
        table_name: tableName.trim(),
        query: queryOutput,
      });

      setSaveSuccess(`Table "${tableName}" saved successfully.`);
      setTableName("");
      onTableSaved?.();

      toast.success("Table saved successfully");

      setTimeout(() => {
        setShowSaveDialog(false);
        setSaveSuccess(null);
      }, 800);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save table";
      toast.error(message);
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col border-t border-border">
      <div className="flex items-center justify-between px-4 h-10 flex-shrink-0">
        <div className="flex items-center space-x-4">
          {canCollapse && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={onCollapse}
              title="Collapse results panel"
            >
              <ChevronRightIcon size={14} />
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            className={`text-sm px-3 py-1 h-auto ${
              activeTab === "results"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent"
            }`}
            onClick={() => setActiveTab("results")}
          >
            Results
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className={`text-sm px-3 py-1 h-auto ${
              activeTab === "query"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent"
            }`}
            onClick={() => setActiveTab("query")}
          >
            Query
          </Button>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-sm px-3 py-1 h-auto flex items-center gap-1"
                onClick={() => setShowSaveDialog(true)}
                disabled={!consoleOutput || !queryOutput}
              >
                <SaveIcon size={14} /> Save Table
              </Button>
            </TooltipTrigger>
            {!queryOutput && (
              <TooltipContent>
                <p>Run a query first to save a table</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex-1 min-h-0 p-4 overflow-auto">
        {activeTab === "results" ? (
          <div className="font-mono text-sm p-3 rounded border border-border min-h-full">
            {consoleOutput?.error ? (
              <div className="p-4 rounded-md border border-red-500/50 text-red-500">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  <span className="font-medium">Query Error:</span>
                  <span className="ml-1">{consoleOutput.error}</span>
                </div>
              </div>
            ) : consoleOutput ? (
              <QueryResultTable data={consoleOutput} itemsPerPage={10} />
            ) : (
              <p className="text-muted-foreground">No results to display</p>
            )}
          </div>
        ) : (
          <div className="font-mono text-sm p-3 rounded border border-border h-full">
            {queryOutput ? (
              <pre className="whitespace-pre-wrap break-words">{queryOutput}</pre>
            ) : (
              <p className="text-muted-foreground">No query to display</p>
            )}
          </div>
        )}
      </div>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Save Table</DialogTitle>
            <DialogDescription>
              Enter a name for your table. It will be saved to your account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="tableName" className="text-sm font-medium">
                Table Name
              </label>
              <Input
                id="tableName"
                placeholder="my_custom_table"
                value={tableName}
                onChange={(event) => {
                  setTableName(event.target.value);
                  setSaveError(null);
                }}
                className={saveError ? "border-red-500 focus:ring-red-500" : ""}
              />
              {saveError && <p className="text-sm text-red-500">{saveError}</p>}
              {saveSuccess && (
                <p className="text-sm text-green-500">{saveSuccess}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isSaving}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={handleSaveTable}
              disabled={isSaving || !tableName.trim()}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
