import type { Table } from "@/types/sqlmate";

export function convertTableToCSV(table: Table): string {
  if (!table || !table.columns || !table.rows) {
    return "";
  }

  const headerRow = table.columns
    .map((column) => `"${column.replace(/"/g, '""')}"`)
    .join(",");

  const dataRows = table.rows.map((row) => {
    return table.columns
      .map((column) => {
        const value = row[column];

        if (value === null || value === undefined) {
          return "";
        }

        if (typeof value === "string") {
          return `"${value.replace(/"/g, '""')}"`;
        }

        return value;
      })
      .join(",");
  });

  return [headerRow, ...dataRows].join("\n");
}

export function downloadTableAsCSV(table: Table, filename: string): void {
  const csv = convertTableToCSV(table);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
