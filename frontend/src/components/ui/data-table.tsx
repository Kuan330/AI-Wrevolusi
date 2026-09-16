import * as React from "react";

import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type DataTableColumn<T> = {
  key: string;
  title: React.ReactNode;
  width?: string | number;
  align?: "left" | "center" | "right";
  className?: string;
  headerClassName?: string;
  render: (row: T, index: number) => React.ReactNode;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T, index: number) => string;
  empty?: React.ReactNode;
  className?: string;
  tableClassName?: string;
  size?: "default" | "middle" | "small";
  bordered?: boolean;
};

function alignClass(align?: "left" | "center" | "right") {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
}

function DataTable<T>(props: DataTableProps<T>) {
  const {
    columns,
    data,
    rowKey,
    empty,
    className,
    tableClassName,
    size = "middle",
    bordered = true,
  } = props;

  const sizeClasses = {
    small: {
      head: "h-10 px-3 text-[13px]",
      cell: "px-3 py-2 text-[13px]",
    },
    middle: {
      head: "h-12 px-4 text-sm",
      cell: "px-4 py-3 text-sm",
    },
    default: {
      head: "h-14 px-4 text-sm",
      cell: "px-4 py-4 text-sm",
    },
  }[size];

  if (!data.length && empty) {
    return <div className={cn("w-full", className)}>{empty}</div>;
  }

  return (
    <div
      className={cn(
        "data-table w-full overflow-hidden bg-white",
        bordered && "rounded-lg border border-[#f0f0f0]",
        className,
      )}
    >
      <Table className={cn("data-table__table border-separate border-spacing-0", tableClassName)}>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-0">
            {columns.map((column) => (
              <TableHead
                key={column.key}
                style={column.width ? { width: column.width } : undefined}
                className={cn(
                  "border-b border-[#f0f0f0] bg-[#fafafa] font-semibold text-[rgba(0,0,0,0.88)]",
                  sizeClasses.head,
                  alignClass(column.align),
                  column.headerClassName,
                )}
              >
                {column.title}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => (
            <TableRow
              key={rowKey(row, index)}
              className="border-0 transition-colors hover:bg-[#fafafa]"
            >
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  style={column.width ? { width: column.width } : undefined}
                  className={cn(
                    "border-b border-[#f0f0f0] text-[rgba(0,0,0,0.88)]",
                    sizeClasses.cell,
                    alignClass(column.align),
                    column.className,
                  )}
                >
                  {column.render(row, index)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export { DataTable };
