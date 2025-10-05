import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";
import { useState } from "react";
import * as path from "node:path";
import { useForm } from "@tanstack/react-form";
import { loadSchemaCache } from "../utils/load-schema-cache";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildElectroDBKey } from "../utils/electrodb-keys";
import { EntityQueryResultsTable } from "../components/EntityQueryResultsTable";

// Load config from current working directory or CLI environment
const getConfig = async () => {
  // Use CLI config path if available, otherwise use current working directory
  const configPath =
    process.env.ELECTRO_VIEWER_CONFIG_PATH ||
    path.resolve(process.cwd(), "electro-viewer-config.ts");
  const configModule = await import(/* @vite-ignore */ configPath);
  return configModule.config;
};

const getEntitySchema = createServerFn({
  method: "GET",
})
  .validator((entityName: string) => entityName)
  .handler(async ({ data: entityName }) => {
    const cache = loadSchemaCache();
    const schema = cache.entities.find((e) => e.name === entityName);
    if (!schema) {
      throw new Error(`Entity '${entityName}' not found in schema cache`);
    }
    return schema;
  });

// Server function to query DynamoDB
const queryDynamoDB = createServerFn({
  method: "POST",
})
  .validator(
    (params: {
      pk: string;
      sk?: string;
      pkField: string;
      skField?: string;
      indexName?: string;
      entityName?: string;
      tableName: string;
    }) => params,
  )
  .handler(async ({ data }) => {
    const { pk, sk, pkField, skField, indexName, entityName, tableName } = data;

    try {
      // Load config from current working directory
      const config = await getConfig();

      // Use AWS SDK's fromIni credential provider for SSO profiles
      const client = new DynamoDBClient({
        region: config.region,
        credentials: fromIni({ profile: config.profile }),
      });

      const docClient = DynamoDBDocumentClient.from(client);

      if (sk && skField) {
        // Use GetItem for exact match
        const command = new GetCommand({
          TableName: tableName,
          Key: {
            [pkField]: pk,
            [skField]: sk,
          },
        });

        const result = await docClient.send(command);
        return {
          success: true,
          data: result.Item ? [result.Item] : [],
          count: result.Item ? 1 : 0,
        };
      } else {
        // Use Query for PK-only queries with entity filter
        const queryParams: any = {
          TableName: tableName,
          IndexName: indexName,
          KeyConditionExpression: `${pkField} = :pk`,
          ExpressionAttributeValues: {
            ":pk": pk,
          },
        };

        // Add entity filter when entityName is provided
        // This is to filter for relevant results when the PK contains other items
        if (entityName) {
          queryParams.FilterExpression = "#edb_e = :entityName";
          queryParams.ExpressionAttributeNames = { "#edb_e": "__edb_e__" };
          queryParams.ExpressionAttributeValues[":entityName"] = entityName;
        }

        const command = new QueryCommand(queryParams);

        const result = await docClient.send(command);
        return {
          success: true,
          data: result.Items || [],
          count: result.Count || 0,
        };
      }
    } catch (error: any) {
      console.error("DynamoDB query error:", error);
      return {
        success: false,
        error: error.message || "Unknown error occurred",
        errorType: error.name || "UnknownError",
      };
    }
  });

export const Route = createFileRoute("/tables/$tableName/entity/$entityName")({
  component: EntityDetail,
  pendingComponent: EntityDetailPending,
  ssr: "data-only",
  staleTime: 60_000, // Cache for 1 minute
  loader: async ({ params }) => {
    const schema = await getEntitySchema({ data: params.entityName });
    return {
      entityName: params.entityName,
      tableName: params.tableName,
      schema,
    };
  },
});

function EntityDetailPending() {
  return (
    <div>
      <div className="mb-2">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      </div>
      <div className="mb-2">
        <div className="h-4 w-96 animate-pulse rounded bg-muted" />
      </div>
      <div className="mb-5">
        <div className="h-4 w-64 animate-pulse rounded bg-muted" />
      </div>

      <div className="mb-5">
        <h3 className="text-base font-semibold mb-2">Select Index:</h3>
        <div className="h-10 w-48 animate-pulse rounded bg-muted" />
      </div>

      <div className="mb-5 rounded border bg-muted/50 p-4">
        <h3 className="text-base font-bold mb-4">Build Query Keys</h3>
        <div className="space-y-3">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-10 w-80 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-10 w-80 animate-pulse rounded bg-muted" />
          <div className="h-10 w-32 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

function EntityDetail() {
  const { entityName, tableName, schema } = Route.useLoaderData();
  const [selectedIndex, setSelectedIndex] = useState(
    Object.keys(schema.indexes)[0] || "primary",
  );
  const [queryResult, setQueryResult] = useState<any>(null);
  const [isQuerying, setIsQuerying] = useState(false);

  const currentIndex = schema.indexes[selectedIndex];
  const isPrimaryIndex = currentIndex?.pk?.field === "pk";

  const form = useForm({
    defaultValues: {
      pkValues: {} as Record<string, string>,
      skValues: {} as Record<string, string>,
    },
    onSubmit: async ({ value }) => {
      setIsQuerying(true);
      setQueryResult(null);

      try {
        // Build PK using ElectroDB logic
        let pk = buildElectroDBKey(
          true,
          currentIndex.pk.composite,
          value.pkValues,
          schema,
        );

        // Build SK if present using ElectroDB logic
        let sk: string | undefined = undefined;
        if (currentIndex.sk) {
          const skKey = buildElectroDBKey(
            false,
            currentIndex.sk.composite,
            value.skValues,
            schema,
          );
          // Only include SK if it has meaningful values (not just the static template)
          // Check if any SK values were actually provided
          const hasSkValues = currentIndex.sk.composite.some(
            (field) => value.skValues[field] && value.skValues[field].trim() !== "",
          );
          if (hasSkValues || currentIndex.sk.composite.length === 0) {
            sk = skKey;
          }
        }

        const result = await queryDynamoDB({
          data: {
            pk,
            sk,
            pkField: currentIndex.pk.field,
            skField: currentIndex.sk?.field,
            indexName: isPrimaryIndex ? undefined : currentIndex.indexName,
            entityName: schema.name,
            tableName,
          },
        });

        // Add the actual query keys to the result for display
        setQueryResult({
          ...result,
          queryKeys: {
            pk,
            sk,
            indexName: isPrimaryIndex ? undefined : currentIndex.indexName,
          },
        });
      } catch (error) {
        console.error("Query error:", error);
        setQueryResult({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          queryKeys: {
            pk: buildElectroDBKey(
              true,
              currentIndex.pk.composite,
              value.pkValues,
              schema,
            ),
            sk: currentIndex.sk
              ? buildElectroDBKey(
                  false,
                  currentIndex.sk.composite,
                  value.skValues,
                  schema,
                )
              : undefined,
            indexName: isPrimaryIndex ? undefined : currentIndex.indexName,
          },
        });
      } finally {
        setIsQuerying(false);
      }
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold">Entity: {entityName}</h1>
        <Link
          to="/tables/$tableName/entity/$entityName/insert"
          params={{ tableName, entityName }}
        >
          <Button>Insert Record</Button>
        </Link>
      </div>
      <p className="mb-2 text-muted-foreground">
        Version: {schema.version} | Service: {schema.service} | Table: {tableName}
      </p>
      <p className="mb-5 text-sm text-muted-foreground">
        Source:{" "}
        <code className="rounded bg-muted px-1 py-0.5">{schema.sourceFile}</code>
      </p>

      <div className="mb-5">
        <h3 className="text-base font-semibold mb-2">Select Index:</h3>
        <select
          value={selectedIndex}
          onChange={(e) => {
            setSelectedIndex(e.target.value);
            form.reset();
            setQueryResult(null);
          }}
          className="rounded border bg-background p-2 text-sm"
        >
          {Object.keys(schema.indexes).map((indexName) => {
            const isGSI = schema.indexes[indexName].pk.field !== "pk";
            return (
              <option key={indexName} value={indexName}>
                {indexName} {isGSI && "(GSI)"}
              </option>
            );
          })}
        </select>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <div className="mb-5 rounded border bg-muted/50 p-4">
          <h3 className="text-base font-bold mb-4">Build Query Keys</h3>

          <div className="mb-4">
            <h4 className="text-sm font-semibold mb-3">
              Partition Key ({currentIndex.pk.field})
            </h4>
            {currentIndex.pk.composite.length === 0 ? (
              <div>
                <p className="mb-2 text-xs text-muted-foreground">
                  No composite attributes (static key)
                </p>
                <div className="mb-2">
                  <span className="text-xs font-medium">Key Pattern:</span>{" "}
                  <code className="rounded border bg-card p-1 text-xs">
                    ${"{service}"}
                  </code>
                </div>
                <div>
                  <span className="text-xs font-medium">Constructed Key:</span>{" "}
                  <form.Subscribe
                    selector={(state) => state.values.pkValues}
                    children={(pkValues) => (
                      <code className="rounded border border-green-500 bg-green-500/10 p-1 text-xs font-semibold text-green-600 dark:border-green-400 dark:bg-green-400/10 dark:text-green-400">
                        {buildElectroDBKey(
                          true,
                          currentIndex.pk.composite,
                          pkValues,
                          schema,
                        )}
                      </code>
                    )}
                  />
                </div>
              </div>
            ) : (
              <>
                {currentIndex.pk.composite.map((field) => (
                  <form.Field
                    key={field}
                    name={`pkValues.${field}`}
                    children={(fieldApi) => (
                      <div className="mb-2">
                        <label
                          htmlFor={`pk-${field}`}
                          className="block mb-1 text-xs font-medium"
                        >
                          {field}:
                        </label>
                        <Input
                          id={`pk-${field}`}
                          type="text"
                          value={fieldApi.state.value || ""}
                          onChange={(e) => fieldApi.handleChange(e.target.value)}
                          placeholder={`Enter ${field}`}
                          className="w-80"
                        />
                      </div>
                    )}
                  />
                ))}
                <div className="mb-2 mt-3">
                  <span className="text-xs font-medium">Key Pattern:</span>{" "}
                  <code className="rounded border bg-card p-1 text-xs">
                    ${"{service}"}#
                    {currentIndex.pk.composite.map((c) => `{${c}}`).join("#")}
                  </code>
                </div>
                <div>
                  <span className="text-xs font-medium">Constructed Key:</span>{" "}
                  <form.Subscribe
                    selector={(state) => state.values.pkValues}
                    children={(pkValues) => (
                      <code className="rounded border border-green-500 bg-green-500/10 p-1 text-xs font-semibold text-green-600 dark:border-green-400 dark:bg-green-400/10 dark:text-green-400">
                        {buildElectroDBKey(
                          true,
                          currentIndex.pk.composite,
                          pkValues,
                          schema,
                        ) || "(Enter values to see constructed key)"}
                      </code>
                    )}
                  />
                </div>
              </>
            )}
          </div>

          {currentIndex.sk && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-3">
                Sort Key ({currentIndex.sk.field})
              </h4>
              {currentIndex.sk.composite.length === 0 ? (
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">
                    No composite attributes
                  </p>
                  <div className="mb-2">
                    <span className="text-xs font-medium">Key Pattern:</span>{" "}
                    <code className="rounded border bg-card p-1 text-xs">
                      ${"{entity}"}_{"{version}"}
                    </code>
                  </div>
                  <div>
                    <span className="text-xs font-medium">Constructed Key:</span>{" "}
                    <form.Subscribe
                      selector={(state) => state.values.skValues}
                      children={(skValues) => (
                        <code className="rounded border border-green-500 bg-green-500/10 p-1 text-xs font-semibold text-green-600 dark:border-green-400 dark:bg-green-400/10 dark:text-green-400">
                          {buildElectroDBKey(
                            false,
                            currentIndex.sk.composite,
                            skValues,
                            schema,
                          )}
                        </code>
                      )}
                    />
                  </div>
                </div>
              ) : (
                <>
                  {currentIndex.sk.composite.map((field) => (
                    <form.Field
                      key={field}
                      name={`skValues.${field}`}
                      children={(fieldApi) => (
                        <div className="mb-2">
                          <label
                            htmlFor={`sk-${field}`}
                            className="block mb-1 text-xs font-medium"
                          >
                            {field}:
                          </label>
                          <Input
                            id={`sk-${field}`}
                            type="text"
                            value={fieldApi.state.value || ""}
                            onChange={(e) => fieldApi.handleChange(e.target.value)}
                            placeholder={`Enter ${field}`}
                            className="w-80"
                          />
                        </div>
                      )}
                    />
                  ))}
                  <div className="mb-2 mt-3">
                    <span className="text-xs font-medium">Key Pattern:</span>{" "}
                    <code className="rounded border bg-card p-1 text-xs">
                      ${"{entity}"}_{"{version}"}#
                      {currentIndex.sk.composite.map((c) => `{${c}}`).join("#")}
                    </code>
                  </div>
                  <div>
                    <span className="text-xs font-medium">Constructed Key:</span>{" "}
                    <form.Subscribe
                      selector={(state) => state.values.skValues}
                      children={(skValues) => (
                        <code className="rounded border border-green-500 bg-green-500/10 p-1 text-xs font-semibold text-green-600 dark:border-green-400 dark:bg-green-400/10 dark:text-green-400">
                          {buildElectroDBKey(
                            false,
                            currentIndex.sk.composite,
                            skValues,
                            schema,
                          ) || "(Enter values to see constructed key)"}
                        </code>
                      )}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <Button type="submit" disabled={isQuerying}>
            {isQuerying ? "Querying..." : "Query DynamoDB"}
          </Button>
        </div>
      </form>

      {queryResult && (
        <div className="mt-5 rounded border p-4">
          <h3 className="text-base font-semibold mb-3">Query Result</h3>

          {/* Show the actual query keys used */}
          <div className="mb-4 rounded border border-border bg-muted p-3">
            <h4 className="m-0 mb-2 text-sm font-semibold">Query Keys Used:</h4>
            <div className="font-mono text-xs">
              <div className="mb-1">
                <strong>PK:</strong>
                <code className="ml-2 rounded border bg-card p-1 text-xs">
                  {queryResult.queryKeys?.pk}
                </code>
              </div>
              {queryResult.queryKeys?.sk && (
                <div className="mb-1">
                  <strong>SK:</strong>
                  <code className="ml-2 rounded border bg-card p-1 text-xs">
                    {queryResult.queryKeys.sk}
                  </code>
                </div>
              )}
              {queryResult.queryKeys?.indexName && (
                <div>
                  <strong>Index:</strong>
                  <code className="ml-2 rounded border bg-card p-1 text-xs">
                    {queryResult.queryKeys.indexName}
                  </code>
                </div>
              )}
            </div>
          </div>

          {queryResult.success ? (
            <>
              <p>Found {queryResult.count} item(s)</p>
              {queryResult.data.length > 0 ? (
                <EntityQueryResultsTable data={queryResult.data} />
              ) : (
                <p className="text-muted-foreground">No items found with these keys</p>
              )}
            </>
          ) : (
            <div>
              <p className="text-red-500">
                <strong>Error:</strong> {queryResult.error}
              </p>
              {queryResult.errorType && (
                <p className="text-xs text-muted-foreground">
                  Type: {queryResult.errorType}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
