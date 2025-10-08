// src/routes/index.tsx

import * as path from "node:path";
import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

// Load config from environment variable (set by bin script)
const getConfig = () => {
  const configJson = process.env.ELECTRO_VIEWER_CONFIG;
  if (!configJson) {
    throw new Error('ELECTRO_VIEWER_CONFIG environment variable not set');
  }
  return JSON.parse(configJson);
};

// Server function to list DynamoDB tables
const listTables = createServerFn({
  method: "GET",
}).handler(async () => {
  try {
    // Load config from environment variable
    const config = getConfig();

    const client = new DynamoDBClient({
      region: config.region,
      credentials: fromIni({ profile: config.profile }),
    });

    const command = new ListTablesCommand({});
    const result = await client.send(command);

    return {
      success: true,
      tables: result.TableNames || [],
      config,
    };
  } catch (error: any) {
    console.error("Error listing tables:", error);
    return {
      success: false,
      error: error.message || "Unknown error occurred",
      tables: [],
      config: null,
    };
  }
});

export const Route = createFileRoute("/")({
  component: Home,
  loader: async () => await listTables(),
});

function Home() {
  const _router = useRouter();
  const data = Route.useLoaderData();

  return (
    <div className="container mx-auto py-8 font-mono">
      <h1 className="mb-5 text-xl font-bold">Electro Viewer</h1>

      <div className="mb-8">
        <h2 className="mb-2 text-base font-semibold">AWS Configuration</h2>
        <div className="rounded bg-muted p-3 text-sm">
          <div>
            <span className="font-bold">Region:</span> {data.config?.region}
          </div>
          <div>
            <span className="font-bold">Profile:</span> {data.config?.profile}
          </div>
        </div>
      </div>

      {data.success ? (
        <div className="mb-8">
          <h2 className="mb-2 text-base font-semibold">
            Available DynamoDB Tables ({data.tables.length})
          </h2>
          {data.tables.length > 0 ? (
            <div className="space-y-2">
              {data.tables.map((tableName: string) => (
                <Link
                  key={tableName}
                  to={`/tables/$tableName/entities`}
                  params={{ tableName }}
                  className="block rounded border border-border bg-card p-3 text-sm transition-colors hover:bg-muted"
                >
                  {tableName}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">
              No DynamoDB tables found in this region/profile.
            </p>
          )}
        </div>
      ) : (
        <div className="mb-8">
          <h2 className="mb-2 text-base font-semibold text-red-500 dark:text-red-400">
            Error Loading Tables
          </h2>
          <div className="rounded border border-red-500 bg-red-500/10 p-3 text-red-600 dark:border-red-400 dark:bg-red-400/10 dark:text-red-400">
            {data.error}
          </div>
        </div>
      )}
    </div>
  );
}
