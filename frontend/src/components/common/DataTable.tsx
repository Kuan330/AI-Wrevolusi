import type { ReactNode } from "react";
import { useId, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

import "./DataTable.css";

export type SortDirection = "asc" | "desc";

export type DataTableColumn<Row> = {
  /** Stable identifier, reused as the sorting key. */
  id: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** Column width such as "28%". Omit to share the remaining space evenly. */
  width?: string;
  align?: "start" | "end";
  /** Supply to make this column sortable. */
  sortValue?: (row: Row) => number | string;
  headerClassName?: string;
  cellClassName?: string;
};

export type DataTableProps<Row> = {
  rows: Row[];
  columns: DataTableColumn<Row>[];
  rowKey: (row: Row) => string;
  /** Screen-reader description of the whole table. */
  caption: string;
  /** Column to sort by on first render. Omit to keep the given row order. */
  initialSort?: { columnId: string; direction: SortDirection };
  /** Summary strip pinned below the table. */
  footer?: ReactNode;
  /** Shown instead of the table when there are no rows. */
  emptyState?: ReactNode;
  className?: string;
};

/**
 * A table for the shared glass surface: sortable headers, a footer summary and
 * an empty state. Rows are static — put row actions in their own column so the
 * markup stays a plain table and every control keeps its own focus target.
 */
export default function DataTable<Row>(props: DataTableProps<Row>) {
  const {
    rows,
    columns,
    rowKey,
    caption,
    initialSort,
    footer,
    emptyState,
    className,
  } = props;

  const captionId = useId();
  const [sort, setSort] = useState<{
    columnId: string;
    direction: SortDirection;
  } | null>(initialSort ?? null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((item) => item.id === sort.columnId);
    const read = column?.sortValue;
    if (!read) return rows;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((left, right) => {
      const a = read(left);
      const b = read(right);
      if (typeof a === "number" && typeof b === "number") return (a - b) * factor;
      return String(a).localeCompare(String(b)) * factor;
    });
  }, [rows, sort, columns]);

  if (rows.length === 0 && emptyState) return <>{emptyState}</>;

  function toggleSort(columnId: string) {
    setSort((current) =>
      current?.columnId === columnId
        ? {
            columnId,
            direction: current.direction === "asc" ? "desc" : "asc",
          }
        : { columnId, direction: "asc" },
    );
  }

  return (
    <div className={cn("dt-card", className)}>
      <div className="dt-scroll">
        <table className="dt-table" aria-describedby={captionId}>
          <caption className="dt-sr" id={captionId}>
            {caption}
          </caption>
          <colgroup>
            {columns.map((column) => (
              <col key={column.id} style={{ width: column.width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((column) => {
                const active = sort?.columnId === column.id;
                const ascending = sort?.direction === "asc";
                return (
                  <th
                    key={column.id}
                    scope="col"
                    className={cn(
                      "dt-th",
                      column.align === "end" && "dt-th--end",
                      column.headerClassName,
                    )}
                    aria-sort={
                      active ? (ascending ? "ascending" : "descending") : undefined
                    }
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        className={cn("dt-sort", active && "is-active")}
                        onClick={() => toggleSort(column.id)}
                      >
                        <span>{column.header}</span>
                        <span className="dt-sort__icon" aria-hidden="true">
                          {active && !ascending ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronUp size={12} />
                          )}
                        </span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr className="dt-row" key={rowKey(row)}>
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={cn(
                      "dt-td",
                      column.align === "end" && "dt-td--end",
                      column.cellClassName,
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer ? <div className="dt-footer">{footer}</div> : null}
    </div>
  );
}
