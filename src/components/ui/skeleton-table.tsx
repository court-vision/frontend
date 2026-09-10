import { Skeleton } from "./skeleton";
import { PendingValue } from "./pending-value";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

/**
 * One column of a loading table, mirroring the real table's own `TableHead`.
 *
 * Copy `className` verbatim from the loaded table so the widths and alignment
 * match; that is what stops the rows moving when the data lands.
 */
export interface SkeletonColumn {
  /** The real header text. Headers are static, so show them rather than a bar. */
  header?: React.ReactNode;
  /** The loaded table's `TableHead` className — widths, alignment, wrapping. */
  className?: string;
  /** Numeric cells hold their width with a placeholder instead of a bar. */
  numeric?: boolean;
  /** Placeholder glyph for numeric cells, sized to the real value ("--", "-"). */
  placeholder?: string;
}

interface SkeletonTableProps {
  rows?: number;
  /**
   * Either a column count (legacy: generic bars, no assumed alignment) or an
   * exact per-column spec, which is what makes the loading state shift-free.
   */
  columns?: number | SkeletonColumn[];
  /** Legacy count form only: leading text columns that get a shimmer bar. */
  labelColumns?: number;
}

export function SkeletonTable({
  rows = 5,
  columns = 5,
  labelColumns = 1,
}: SkeletonTableProps) {
  const spec: SkeletonColumn[] = Array.isArray(columns)
    ? columns
    : Array.from({ length: columns }, (_, i) => ({ numeric: i >= labelColumns }));

  return (
    <Table aria-busy="true">
      <TableHeader>
        <TableRow>
          {spec.map((col, index) => (
            <TableHead key={index} className={col.className}>
              {col.header ?? <Skeleton className="h-4 w-20" />}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <TableRow key={rowIndex}>
            {spec.map((col, colIndex) => (
              <TableCell key={colIndex} className={col.className}>
                {col.numeric ? (
                  <PendingValue placeholder={col.placeholder} />
                ) : (
                  <Skeleton className="h-4 w-full max-w-[180px]" />
                )}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
