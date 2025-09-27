import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";

interface EntityQueryResultsTableProps {
  data: Record<string, any>[];
  pageSize?: number;
}

export function EntityQueryResultsTable({ data, pageSize = 20 }: EntityQueryResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Create dynamic columns based on data
  const columns = useMemo(() => {
    if (!data?.length) return [];

    const firstItem = data[0];
    const columnHelper = createColumnHelper<any>();

    return Object.keys(firstItem).map((key) =>
      columnHelper.accessor(key, {
        header: key,
        cell: (info) => {
          const value = info.getValue();
          if (value === null || value === undefined) {
            return <span style={{ color: "#999" }}>null</span>;
          }
          if (typeof value === "object") {
            return (
              <pre
                style={{
                  margin: 0,
                  fontSize: "11px",
                  maxWidth: "300px",
                  overflow: "auto",
                  backgroundColor: "#f5f5f5",
                  padding: "4px",
                  borderRadius: "2px",
                }}
              >
                {JSON.stringify(value, null, 2)}
              </pre>
            );
          }
          return (
            <span style={{ fontSize: "12px", fontFamily: "monospace" }}>
              {String(value)}
            </span>
          );
        },
      })
    );
  }, [data]);

  const table = useReactTable({
    data: data || [],
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });

  if (!data?.length) {
    return <p style={{ color: "#666" }}>No data to display</p>;
  }

  return (
    <>
      <div style={{ marginBottom: "10px" }}>
        <input
          type="text"
          placeholder="Filter all columns..."
          onChange={(e) => {
            table.setGlobalFilter(e.target.value);
          }}
          style={{
            padding: "8px",
            width: "300px",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        />
      </div>
      <div
        style={{
          maxHeight: "600px",
          overflow: "auto",
          border: "1px solid #ddd",
          borderRadius: "4px",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "12px",
          }}
        >
          <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                style={{ backgroundColor: "#f5f5f5" }}
              >
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{
                      padding: "8px",
                      border: "1px solid #ddd",
                      textAlign: "left",
                      cursor: header.column.getCanSort()
                        ? "pointer"
                        : "default",
                      userSelect: "none",
                      backgroundColor: "#f5f5f5",
                    }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {{
                        asc: " ↑",
                        desc: " ↓",
                      }[header.column.getIsSorted() as string] ?? ""}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                style={{
                  backgroundColor:
                    row.index % 2 === 0 ? "#fff" : "#fafafa",
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{
                      padding: "8px",
                      border: "1px solid #ddd",
                      verticalAlign: "top",
                    }}
                  >
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginTop: "10px",
          fontSize: "14px",
        }}
      >
        <button
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
          style={{
            padding: "4px 8px",
            cursor: table.getCanPreviousPage()
              ? "pointer"
              : "not-allowed",
            opacity: table.getCanPreviousPage() ? 1 : 0.5,
          }}
        >
          {"<<"}
        </button>
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          style={{
            padding: "4px 8px",
            cursor: table.getCanPreviousPage()
              ? "pointer"
              : "not-allowed",
            opacity: table.getCanPreviousPage() ? 1 : 0.5,
          }}
        >
          {"<"}
        </button>
        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          style={{
            padding: "4px 8px",
            cursor: table.getCanNextPage() ? "pointer" : "not-allowed",
            opacity: table.getCanNextPage() ? 1 : 0.5,
          }}
        >
          {">"}
        </button>
        <button
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
          style={{
            padding: "4px 8px",
            cursor: table.getCanNextPage() ? "pointer" : "not-allowed",
            opacity: table.getCanNextPage() ? 1 : 0.5,
          }}
        >
          {">>"}
        </button>
        <span>
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </span>
        <select
          value={table.getState().pagination.pageSize}
          onChange={(e) => {
            table.setPageSize(Number(e.target.value));
          }}
          style={{
            padding: "4px",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        >
          {[10, 20, 30, 50, 100].map((pageSize) => (
            <option key={pageSize} value={pageSize}>
              Show {pageSize}
            </option>
          ))}
        </select>
        <span style={{ marginLeft: "auto", color: "#666" }}>
          Showing {table.getRowModel().rows.length} of {data.length} rows
        </span>
      </div>
    </>
  );
}