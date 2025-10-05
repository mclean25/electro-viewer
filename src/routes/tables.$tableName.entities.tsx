import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { loadSchemaCache } from "../utils/load-schema-cache";
import type { EntitySchema } from "../utils/build-schema-cache";
import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const getEntitySchemas = createServerFn({
  method: "GET",
}).handler(async () => {
  const cache = loadSchemaCache();
  return cache.entities;
});

// Helper function to format key patterns for display
function formatKeyPattern(
  composite: string[],
  template: string | undefined,
  prefix: string,
): string {
  if (composite.length === 0) {
    return template || prefix;
  }
  const fields = composite.map((f) => `\${${f}}`).join("#");
  return template ? `${template}#${fields}` : `${prefix}#${fields}`;
}

export const Route = createFileRoute("/tables/$tableName/entities")({
  component: EntitiesViewer,
  pendingComponent: EntitiesViewerPending,
  ssr: "data-only",
  staleTime: 60_000, // Cache for 1 minute
  loader: async ({ params }) => {
    const schemas = await getEntitySchemas();
    return { schemas, tableName: params.tableName };
  },
});

function EntitiesViewerPending() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">ElectroDB Entity Definitions</h1>
      <p className="mb-6 text-sm text-muted-foreground">Loading...</p>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entity Name</TableHead>
              <TableHead>Service Name</TableHead>
              <TableHead>Source File</TableHead>
              <TableHead>PK Pattern</TableHead>
              <TableHead>SK Pattern</TableHead>
              <TableHead>No. of Fields</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: ignore
              <TableRow key={i}>
                <TableCell>
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-8 animate-pulse rounded bg-muted" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function EntitiesViewer() {
  const { schemas, tableName } = Route.useLoaderData();
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);

  const columnHelper = createColumnHelper<EntitySchema>();

  const columns = [
    columnHelper.accessor("name", {
      header: "Entity Name",
      enableSorting: true,
      cell: (info) => (
        <Link
          to="/tables/$tableName/entity/$entityName"
          params={{ tableName, entityName: info.getValue() }}
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          {info.getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor("service", {
      header: "Service Name",
      enableSorting: true,
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("sourceFile", {
      header: "Source File",
      enableSorting: true,
      cell: (info) => <span className="font-mono">{info.getValue()}</span>,
    }),
    columnHelper.display({
      id: "pkPattern",
      header: "PK Pattern",
      enableSorting: false,
      cell: (info) => {
        const schema = info.row.original;
        const firstIndex = schema.indexes[Object.keys(schema.indexes)[0]];
        if (!firstIndex) return "N/A";
        return (
          <code>
            {formatKeyPattern(
              firstIndex.pk.composite,
              firstIndex.pk.template,
              `$\{${schema.service}}`,
            )}
          </code>
        );
      },
    }),
    columnHelper.display({
      id: "skPattern",
      header: "SK Pattern",
      enableSorting: false,
      cell: (info) => {
        const schema = info.row.original;
        const firstIndex = schema.indexes[Object.keys(schema.indexes)[0]];
        if (!firstIndex?.sk) return "N/A";
        return (
          <code>
            {formatKeyPattern(
              firstIndex.sk.composite,
              firstIndex.sk.template,
              `$\{${schema.name}}_$\{${schema.version}}`,
            )}
          </code>
        );
      },
    }),
    columnHelper.accessor("attributes", {
      header: "No. of Fields",
      enableSorting: true,
      cell: (info) => Object.keys(info.getValue()).length,
    }),
  ];

  const table = useReactTable({
    data: schemas || [],
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">
        ElectroDB Entity Definitions for {tableName}
      </h1>
      {!schemas && (
        <div className="text-muted-foreground">Didn't load any schemas...</div>
      )}
      <p className="mb-6 text-sm text-muted-foreground">
        Total entities: {schemas?.length}
      </p>

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
                      {header.column.getCanSort() && (
                        <span className="text-muted-foreground">
                          {{
                            asc: "↑",
                            desc: "↓",
                          }[header.column.getIsSorted() as string] ?? "⇅"}
                        </span>
                      )}
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
    </div>
  );
}
