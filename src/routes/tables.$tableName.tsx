import * as path from "node:path";
import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { SideNav } from "../components/SideNav";
import { loadSchemaCache } from "../utils/load-schema-cache";

const getConfig = async () => {
  const configPath =
    process.env.ELECTRO_VIEWER_CONFIG_PATH ||
    path.resolve(process.cwd(), "electro-viewer-config.ts");
  const configModule = await import(/* @vite-ignore */ configPath);
  return configModule.config;
};

const listTables = createServerFn({
  method: "GET",
}).handler(async () => {
  const config = await getConfig();
  const client = new DynamoDBClient({
    region: config.region,
    credentials: fromIni({ profile: config.profile }),
  });
  const command = new ListTablesCommand({});
  const result = await client.send(command);
  return result.TableNames || [];
});

const getEntitySchemas = createServerFn({
  method: "GET",
}).handler(async () => {
  const cache = loadSchemaCache();
  return cache.entities.map((e) => ({
    name: e.name,
    version: e.version,
    service: e.service,
    sourceFile: e.sourceFile,
  }));
});

const getConfigInfo = createServerFn({
  method: "GET",
}).handler(async () => {
  const config = await getConfig();
  return {
    region: config.region,
    profile: config.profile,
  };
});

export const Route = createFileRoute("/tables/$tableName")({
  component: TableLayout,
  pendingComponent: TableLayoutPending,
  ssr: "data-only",
  staleTime: 60_000, // Cache for 1 minute
  loader: async ({ params }) => {
    const [tables, entities, configInfo] = await Promise.all([
      listTables(),
      getEntitySchemas(),
      getConfigInfo(),
    ]);
    return { tables, entities, tableName: params.tableName, configInfo };
  },
});

function TableLayoutPending() {
  return (
    <div className="flex">
      <div className="fixed left-0 top-0 h-screen w-64 border-r bg-background p-4">
        <h2 className="mb-4 text-lg font-bold">Tables</h2>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`table-${i}`}
              className="h-8 w-full animate-pulse rounded bg-muted"
            />
          ))}
        </div>
        <h2 className="mb-4 mt-8 text-lg font-bold">Entities</h2>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={`entity-${i}`}
              className="h-8 w-full animate-pulse rounded bg-muted"
            />
          ))}
        </div>
      </div>
      <div className="ml-64 flex-1">
        <div className="container mx-auto py-8 px-8 font-mono">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

function TableLayout() {
  const { tables, entities, tableName, configInfo } = Route.useLoaderData();
  const [sidebarWidth, setSidebarWidth] = useState(256);

  return (
    <div className="flex">
      <SideNav
        currentTable={tableName}
        tables={tables}
        entities={entities}
        region={configInfo.region}
        profile={configInfo.profile}
        width={sidebarWidth}
        onWidthChange={setSidebarWidth}
      />
      <div className="flex-1" style={{ marginLeft: `${sidebarWidth}px` }}>
        <div className="container mx-auto pt-6 pb-8 px-8 font-mono">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
