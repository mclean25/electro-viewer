import {
  type ColumnFiltersState,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import JsonView from "@uiw/react-json-view";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface EntityQueryResultsTableProps {
  data: Record<string, any>[];
  pageSize?: number;
}

function JsonCellValue({ value, columnKey }: { value: object; columnKey: string }) {
  const isEmpty =
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0;

  if (isEmpty) {
    return <span className="font-mono text-xs text-muted-foreground">{"{}"}</span>;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs hover:bg-muted cursor-pointer border border-border/50"
        >
          <span className="text-muted-foreground">{"{ JSON"}</span>
          <Search className="size-3 text-muted-foreground" />
          <span className="text-muted-foreground">{"}"}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">{columnKey}</DialogTitle>
        </DialogHeader>
        <div className="overflow-auto p-6 pt-4">
          <JsonView
            value={value}
            style={
              {
                "--w-rjv-background-color": "transparent",
                "--w-rjv-color": "#e2e8f0",
                "--w-rjv-key-string": "#7dd3fc",
                "--w-rjv-quotes-color": "#7dd3fc",
                "--w-rjv-type-string-color": "#86efac",
                "--w-rjv-quotes-string-color": "#86efac",
                "--w-rjv-type-int-color": "#fbbf24",
                "--w-rjv-type-float-color": "#fbbf24",
                "--w-rjv-type-bigint-color": "#fbbf24",
                "--w-rjv-type-boolean-color": "#f472b6",
                "--w-rjv-type-null-color": "#f87171",
                "--w-rjv-type-nan-color": "#f87171",
                "--w-rjv-type-undefined-color": "#94a3b8",
                "--w-rjv-curlybraces-color": "#cbd5e1",
                "--w-rjv-brackets-color": "#cbd5e1",
                "--w-rjv-colon-color": "#cbd5e1",
                "--w-rjv-line-color": "#334155",
                "--w-rjv-info-color": "#64748b",
                "--w-rjv-arrow-color": "#94a3b8",
              } as React.CSSProperties
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EntityQueryResultsTable({
  data,
  pageSize = 20,
}: EntityQueryResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Create dynamic columns based on data
  const columns = useMemo(() => {
    if (!data?.length) return [];

    const firstItem = data[0];
    const columnHelper = createColumnHelper<any>();

    // Filter out ElectroDB internal metadata columns when querying a specific entity
    // and version since these are not useful if they're provided in the query keys
    const allKeys = Object.keys(firstItem).filter(
      (key) => key !== "__edb_e__" && key !== "__edb_v__",
    );

    // Put pk/sk first, then all other keys in their original order
    const pkSkKeys = ["pk", "sk"].filter((k) => allKeys.includes(k));
    const remainingKeys = allKeys.filter((k) => k !== "pk" && k !== "sk");
    const columnsToDisplay = [...pkSkKeys, ...remainingKeys];

    return columnsToDisplay.map((key) =>
      columnHelper.accessor(key, {
        header: key,
        enableSorting: true,
        cell: (info) => {
          const value = info.getValue();
          if (value === null || value === undefined) {
            return <span className="text-muted-foreground">null</span>;
          }
          if (typeof value === "object") {
            return <JsonCellValue value={value} columnKey={key} />;
          }
          return <span className="font-mono text-xs">{String(value)}</span>;
        },
      }),
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
    return <p className="text-muted-foreground">No data to display</p>;
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Filter all columns..."
        onChange={(e) => table.setGlobalFilter(e.target.value)}
        className="max-w-sm"
      />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={
                      header.column.getCanSort()
                        ? "cursor-pointer select-none hover:bg-muted/50"
                        : ""
                    }
                  >
                    <div className="flex items-center gap-2">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <span className="text-muted-foreground">
                        {{
                          asc: "↑",
                          desc: "↓",
                        }[header.column.getIsSorted() as string] ?? "⇅"}
                      </span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            {"<<"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {"<"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {">"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            {">>"}
          </Button>
          <span className="text-sm">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => {
              table.setPageSize(Number(e.target.value));
            }}
            className="h-8 rounded-md border px-2"
          >
            {[10, 20, 30, 50, 100].map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                Show {pageSize}
              </option>
            ))}
          </select>
        </div>
        <span className="text-sm text-muted-foreground">
          Showing {table.getRowModel().rows.length} of {data.length} rows
        </span>
      </div>
    </div>
  );
}
