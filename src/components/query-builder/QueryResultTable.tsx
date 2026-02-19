import React, { useMemo, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Table } from "@/types/sqlmate";

type Props = {
  data: Table;
  itemsPerPage?: number;
};

export function QueryResultTable({ data, itemsPerPage = 20 }: Props) {
  const { columns, rows, error } = data;
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil((rows?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentRows = useMemo(() => {
    return rows?.slice(startIndex, endIndex) || [];
  }, [rows, startIndex, endIndex]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [data]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const goToPreviousPage = () => {
    setCurrentPage((previous) => Math.max(1, previous - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((previous) => Math.min(totalPages, previous + 1));
  };

  if (error) {
    return (
      <div className="p-4 rounded-md border border-red-500/50 text-red-500">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span className="font-medium">Query Error:</span>
          <span className="ml-1">{error}</span>
        </div>
      </div>
    );
  }

  if (!columns || !rows || !columns.length || !rows.length) {
    return <p className="text-muted-foreground">No results found.</p>;
  }

  const getPageNumbers = () => {
    const pages: Array<number | "..."> = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i += 1) {
        pages.push(i);
      }
      return pages;
    }

    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + maxVisiblePages - 1);

    if (start > 1) {
      pages.push(1);
      if (start > 2) {
        pages.push("...");
      }
    }

    for (let i = start; i <= end; i += 1) {
      pages.push(i);
    }

    if (end < totalPages) {
      if (end < totalPages - 1) {
        pages.push("...");
      }
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Showing {startIndex + 1}-{Math.min(endIndex, rows.length)} of {rows.length} results
        </div>
        <div>
          Page {currentPage} of {totalPages}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-muted border-b border-border">
            <tr>
              {columns.map((column, index) => (
                <th key={`col-${index}`} className="px-4 py-2 font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentRows.map((row, i) => (
              <tr key={`${startIndex}-${i}`} className={i % 2 === 0 ? "" : "bg-muted/40"}>
                {(row as unknown[]).map((value, j) => (
                  <td
                    key={`${startIndex + i}-${j}`}
                    className="px-4 py-2 border-b border-border text-foreground"
                  >
                    {String(value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 pt-4 pb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousPage}
            disabled={currentPage === 1}
          >
            <ChevronLeft size={16} />
            Previous
          </Button>

          <div className="flex items-center space-x-1">
            {getPageNumbers().map((page, index) => (
              <React.Fragment key={`${page}-${index}`}>
                {page === "..." ? (
                  <span className="px-2 text-muted-foreground">...</span>
                ) : (
                  <Button
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => goToPage(page)}
                  >
                    {page}
                  </Button>
                )}
              </React.Fragment>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={goToNextPage}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}
