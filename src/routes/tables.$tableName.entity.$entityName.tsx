import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";
import { useState } from "react";
import * as path from "node:path";
import { useForm } from "@tanstack/react-form";
import { loadSchemaCache } from "../utils/load-schema-cache";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildElectroDBKey } from "../utils/electrodb-keys";
import { EntityQueryResultsTable } from "../components/EntityQueryResultsTable";

// Load config from current working directory or CLI environment
const getConfig = async () => {
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
      const config = await getConfig();

      const client = new DynamoDBClient({
        region: config.region,
        credentials: fromIni({ profile: config.profile }),
      });

      const docClient = DynamoDBDocumentClient.from(client);

      if (sk && skField) {
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
        const queryParams: any = {
          TableName: tableName,
          IndexName: indexName,
          KeyConditionExpression: `${pkField} = :pk`,
          ExpressionAttributeValues: {
            ":pk": pk,
          },
        };

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

// Server function to insert record
const insertRecord = createServerFn({
  method: "POST",
})
  .validator(
    (params: { item: Record<string, any>; entityName: string; tableName: string }) =>
      params,
  )
  .handler(async ({ data }) => {
    const { item, entityName, tableName } = data;

    try {
      const config = await getConfig();
      const cache = loadSchemaCache();
      const schema = cache.entities.find((e) => e.name === entityName);

      if (!schema) {
        throw new Error(`Entity '${entityName}' not found in schema cache`);
      }

      const itemToInsert: Record<string, any> = {
        ...item,
        __edb_e__: schema.name,
        __edb_v__: schema.version,
      };

      for (const [indexName, indexDef] of Object.entries(schema.indexes)) {
        const pkValue = buildElectroDBKey(true, indexDef.pk.composite, item, schema);
        itemToInsert[indexDef.pk.field] = pkValue;

        if (indexDef.sk) {
          const skValue = buildElectroDBKey(false, indexDef.sk.composite, item, schema);
          itemToInsert[indexDef.sk.field] = skValue;
        }
      }

      const client = new DynamoDBClient({
        region: config.region,
        credentials: fromIni({ profile: config.profile }),
      });

      const docClient = DynamoDBDocumentClient.from(client);

      const command = new PutCommand({
        TableName: tableName,
        Item: itemToInsert,
      });

      await docClient.send(command);

      return {
        success: true,
        item: itemToInsert,
      };
    } catch (error: any) {
      console.error("DynamoDB insert error:", error);
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
  staleTime: 60_000,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tab: (search.tab as string) || "query",
    };
  },
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
  const navigate = useNavigate();
  const search = Route.useSearch();
  const currentTab = search.tab || "query";

  const handleTabChange = (value: string) => {
    navigate({
      search: { tab: value },
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Entity</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-primary">{entityName}</span>
        </div>
      </h1>
      <div className="flex gap-4 mb-1 text-sm">
        <span>
          <span className="text-muted-foreground">Version</span> {schema.version}
        </span>
        <span>
          <span className="text-muted-foreground">Service</span> {schema.service}
        </span>
        <span>
          <span className="text-muted-foreground">Table</span> {tableName}
        </span>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        <code className="rounded bg-card px-1 py-0.5">{schema.sourceFile}</code>
      </p>

      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="query">query</TabsTrigger>
          <TabsTrigger value="insert">insert</TabsTrigger>
        </TabsList>

        <TabsContent value="query">
          <QueryTab schema={schema} tableName={tableName} entityName={entityName} />
        </TabsContent>

        <TabsContent value="insert">
          <InsertTab schema={schema} tableName={tableName} entityName={entityName} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QueryTab({
  schema,
  tableName,
  entityName,
}: {
  schema: any;
  tableName: string;
  entityName: string;
}) {
  const firstIndex = Object.keys(schema.indexes)[0];
  const [selectedIndex, setSelectedIndex] = useState(firstIndex);
  const [queryResult, setQueryResult] = useState<any>(null);
  const [isQuerying, setIsQuerying] = useState(false);

  const currentIndex = schema.indexes[selectedIndex] || schema.indexes[firstIndex];
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
        let pk = buildElectroDBKey(
          true,
          currentIndex.pk.composite,
          value.pkValues,
          schema,
        );

        let sk: string | undefined = undefined;
        if (currentIndex.sk) {
          const skKey = buildElectroDBKey(
            false,
            currentIndex.sk.composite,
            value.skValues,
            schema,
          );
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
    <div className="mt-6 rounded-lg border border-card p-6">
      <div className="mb-5">
        <h3 className="text-sm font-semibold mb-2">Select Index</h3>
        <Select
          value={selectedIndex}
          onValueChange={(value) => {
            setSelectedIndex(value);
            form.reset();
            setQueryResult(null);
          }}
        >
          <SelectTrigger className="w-64 bg-background">
            <SelectValue placeholder="Select an index" />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(schema.indexes).map((indexName) => {
              const isGSI = schema.indexes[indexName].pk.field !== "pk";
              return (
                <SelectItem key={indexName} value={indexName}>
                  {indexName} {isGSI && "(GSI)"}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <div className="mb-5">
          <h3 className="text-sm font-bold mb-4">PK</h3>

          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-3">
              {currentIndex.pk.composite.length === 0
                ? "No composite attributes (static key)"
                : ``}
            </p>
            {currentIndex.pk.composite.length > 0 && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                {currentIndex.pk.composite.map((field) => (
                  <form.Field
                    key={field}
                    name={`pkValues.${field}`}
                    children={(fieldApi) => (
                      <div>
                        <label
                          htmlFor={`pk-${field}`}
                          className="block mb-1 text-xs text-foreground"
                        >
                          <div className="flex items-center gap-2">
                            {field}
                            <span className="italic text-muted-foreground-accent">
                              string
                            </span>
                          </div>
                        </label>
                        <Input
                          id={`pk-${field}`}
                          type="text"
                          value={fieldApi.state.value || ""}
                          onChange={(e) => fieldApi.handleChange(e.target.value)}
                          placeholder={field}
                          className="bg-background"
                        />
                      </div>
                    )}
                  />
                ))}
              </div>
            )}
          </div>

          {currentIndex.sk && (
            <div className="mb-4">
              <h3 className="text-sm font-bold mb-4">SK</h3>
              <p className="text-xs text-muted-foreground mb-3">
                {currentIndex.sk.composite.length === 0
                  ? "No composite attributes"
                  : `${currentIndex.sk.field} composites`}
              </p>
              {currentIndex.sk.composite.length > 0 && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {currentIndex.sk.composite.map((field) => (
                    <form.Field
                      key={field}
                      name={`skValues.${field}`}
                      children={(fieldApi) => (
                        <div>
                          <label
                            htmlFor={`sk-${field}`}
                            className="block mb-1 text-xs text-muted-foreground"
                          >
                            {field}{" "}
                            <span className="text-muted-foreground">string</span>
                          </label>
                          <Input
                            id={`sk-${field}`}
                            type="text"
                            value={fieldApi.state.value || ""}
                            onChange={(e) => fieldApi.handleChange(e.target.value)}
                            placeholder={field}
                            className="bg-background"
                          />
                        </div>
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <Button type="submit" disabled={isQuerying}>
            {isQuerying ? "Querying..." : "Query"}
          </Button>
        </div>
      </form>

      {queryResult && (
        <div className="mt-5 rounded border p-4 bg-background">
          <h3 className="text-base font-semibold mb-3">Query Result</h3>

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

function InsertTab({
  schema,
  tableName,
  entityName,
}: {
  schema: any;
  tableName: string;
  entityName: string;
}) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);

  const primaryIndexName = Object.keys(schema.indexes)[0];
  const primaryIndex = schema.indexes[primaryIndexName];

  if (!primaryIndex) {
    return (
      <div className="mt-6 rounded-lg border bg-card p-6">
        <p className="text-red-500">Error: No indexes found for this entity</p>
      </div>
    );
  }

  const pkFields = primaryIndex.pk.composite;
  const skFields = primaryIndex.sk?.composite || [];

  const allIndexKeyFields = new Set<string>();
  for (const index of Object.values(schema.indexes)) {
    index.pk.composite.forEach((field) => allIndexKeyFields.add(field));
    index.sk?.composite.forEach((field) => allIndexKeyFields.add(field));
  }

  const primaryKeyFieldNames = new Set([...pkFields, ...skFields]);

  const otherIndexKeyFields = Array.from(allIndexKeyFields).filter(
    (field) => !primaryKeyFieldNames.has(field),
  );

  const nonKeyFields = Object.keys(schema.attributes).filter(
    (attrName) => !allIndexKeyFields.has(attrName),
  );

  const requiredOtherFields = [
    ...otherIndexKeyFields,
    ...nonKeyFields.filter((name) => schema.attributes[name].required),
  ];
  const optionalOtherFields = nonKeyFields.filter(
    (name) => !schema.attributes[name].required,
  );

  const form = useForm({
    defaultValues: {} as Record<string, any>,
    onSubmit: async ({ value: formData }) => {
      setIsSubmitting(true);
      setSubmitResult(null);

      try {
        const processedData: Record<string, any> = {};
        for (const [attrName, value] of Object.entries(formData)) {
          const attr = schema.attributes[attrName];
          if (
            attr &&
            (attr.type === "map" || attr.type === "list" || attr.type === "set")
          ) {
            if (typeof value === "string" && value.trim() !== "") {
              processedData[attrName] = JSON.parse(value);
            }
          } else if (attr && attr.type === "number") {
            processedData[attrName] = value ? Number(value) : undefined;
          } else if (attr && attr.type === "boolean") {
            processedData[attrName] = value;
          } else {
            processedData[attrName] = value;
          }
        }

        const result = await insertRecord({
          data: {
            item: processedData,
            entityName,
            tableName,
          },
        });

        setSubmitResult(result);

        if (result.success) {
          setTimeout(() => {
            navigate({
              search: { tab: "query" },
            });
          }, 2000);
        }
      } catch (error) {
        console.error("Submit error:", error);
        setSubmitResult({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  const renderField = (attrName: string, isRequired: boolean, isKeyField = false) => {
    const attr = schema.attributes[attrName];

    if (attr.readonly && !isKeyField) {
      return null;
    }

    const isEffectivelyRequired = isRequired || allIndexKeyFields.has(attrName);

    const validate = (value: any) => {
      if (isEffectivelyRequired && (!value || value === "")) {
        return allIndexKeyFields.has(attrName)
          ? "This field is required (used in index keys)"
          : "This field is required";
      }

      if (
        (attr.type === "map" || attr.type === "list" || attr.type === "set") &&
        typeof value === "string" &&
        value.trim() !== ""
      ) {
        try {
          JSON.parse(value);
        } catch (e) {
          return "Invalid JSON format";
        }
      }

      return undefined;
    };

    return (
      <form.Field
        key={attrName}
        name={attrName}
        validators={{
          onChange: ({ value }) => validate(value),
        }}
        children={(field) => (
          <div className="space-y-2">
            <Label htmlFor={attrName}>
              {attrName}
              {isEffectivelyRequired && <span className="text-red-500 ml-1">*</span>}
              <span className="text-xs text-muted-foreground ml-2">({attr.type})</span>
            </Label>
            {attr.type === "boolean" ? (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={attrName}
                  checked={field.state.value === true}
                  onCheckedChange={(checked) => field.handleChange(checked === true)}
                />
                <label
                  htmlFor={attrName}
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  {field.state.value ? "True" : "False"}
                </label>
              </div>
            ) : attr.type === "map" || attr.type === "list" || attr.type === "set" ? (
              <Textarea
                id={attrName}
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder={`Enter ${attr.type} as JSON`}
                className={field.state.meta.errors.length > 0 ? "border-red-500" : ""}
              />
            ) : attr.type === "number" ? (
              <Input
                id={attrName}
                type="number"
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value)}
                className={field.state.meta.errors.length > 0 ? "border-red-500" : ""}
              />
            ) : (
              <Input
                id={attrName}
                type="text"
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value)}
                className={field.state.meta.errors.length > 0 ? "border-red-500" : ""}
              />
            )}
            {field.state.meta.errors.length > 0 && (
              <p className="text-xs text-red-500">
                {field.state.meta.errors.join(", ")}
              </p>
            )}
          </div>
        )}
      />
    );
  };

  return (
    <div className="mt-6 rounded-lg border bg-card p-6 max-w-4xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-6"
      >
        {/* PK/SK Fields Section */}
        <div className="rounded border bg-muted/30 p-4 space-y-4">
          <h3 className="text-sm font-semibold">Primary Key Fields</h3>
          {pkFields.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No partition key composite attributes (static key)
            </p>
          ) : (
            <div className="space-y-4">
              {pkFields.map((field) =>
                renderField(field, schema.attributes[field]?.required || false, true),
              )}
            </div>
          )}

          {skFields.length > 0 && (
            <>
              <h3 className="text-sm font-semibold mt-4">Sort Key Fields</h3>
              <div className="space-y-4">
                {skFields.map((field) =>
                  renderField(field, schema.attributes[field]?.required || false, true),
                )}
              </div>
            </>
          )}
        </div>

        {/* Required Fields Section */}
        {requiredOtherFields.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold">Required Fields</h3>
            {requiredOtherFields.map((field) => renderField(field, true))}
          </div>
        )}

        {/* Optional Fields Section */}
        {optionalOtherFields.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold">Optional Fields</h3>
            {optionalOtherFields.map((field) => renderField(field, false))}
          </div>
        )}

        {/* Submit Button */}
        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Inserting..." : "Insert Record"}
          </Button>
        </div>

        {/* Submit Result */}
        {submitResult && (
          <div
            className={`rounded border p-4 ${
              submitResult.success
                ? "bg-green-500/10 border-green-500"
                : "bg-red-500/10 border-red-500"
            }`}
          >
            {submitResult.success ? (
              <div>
                <p className="font-semibold text-green-600">
                  Record inserted successfully!
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Returning to query tab...
                </p>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-red-600">Insert failed</p>
                <p className="text-sm text-red-500 mt-1">{submitResult.error}</p>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
