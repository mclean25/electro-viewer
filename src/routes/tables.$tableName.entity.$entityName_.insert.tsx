import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";
import { useState } from "react";
import * as path from "node:path";
import { loadSchemaCache } from "../utils/load-schema-cache";
import { buildElectroDBKey } from "../utils/electrodb-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

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

// Server function to insert record
const insertRecord = createServerFn({
  method: "POST",
})
  .validator(
    (params: {
      item: Record<string, any>;
      entityName: string;
      tableName: string;
    }) => params,
  )
  .handler(async ({ data }) => {
    const { item, entityName, tableName } = data;

    try {
      // Load config and entity schema
      const config = await getConfig();
      const cache = loadSchemaCache();
      const schema = cache.entities.find((e) => e.name === entityName);

      if (!schema) {
        throw new Error(`Entity '${entityName}' not found in schema cache`);
      }

      // Build PK and SK using ElectroDB logic
      const primaryIndexName = Object.keys(schema.indexes)[0];
      const primaryIndex = schema.indexes[primaryIndexName];
      const pk = buildElectroDBKey(
        true,
        primaryIndex.pk.composite,
        item,
        schema,
      );
      const sk = primaryIndex.sk
        ? buildElectroDBKey(false, primaryIndex.sk.composite, item, schema)
        : undefined;

      // Build the item to insert
      const itemToInsert: Record<string, any> = {
        ...item,
        pk,
        ...(sk && { sk }),
        __edb_e__: schema.name,
        __edb_v__: schema.version,
      };

      // Insert into DynamoDB
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

export const Route = createFileRoute(
  "/tables/$tableName/entity/$entityName_/insert",
)({
  component: InsertRecord,
  ssr: "data-only",
  loader: async ({ params }) => {
    const schema = await getEntitySchema({ data: params.entityName });
    return {
      entityName: params.entityName,
      tableName: params.tableName,
      schema,
    };
  },
});

function InsertRecord() {
  const { entityName, tableName, schema } = Route.useLoaderData();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);

  // Find the table's primary index (the one using pk/sk fields, not a GSI)
  // Default to first index
  const primaryIndexName = Object.keys(schema.indexes)[0];
  const primaryIndex = schema.indexes[primaryIndexName];

  if (!primaryIndex) {
    return (
      <div className="max-w-4xl">
        <h1 className="mb-2 text-xl font-bold">Insert Record: {entityName}</h1>
        <p className="text-red-500">Error: No indexes found for this entity</p>
      </div>
    );
  }

  // Get PK and SK fields from primary index for display
  const pkFields = primaryIndex.pk.composite;
  const skFields = primaryIndex.sk?.composite || [];

  // Collect ALL fields used in ANY index's PK or SK
  // These are required for ElectroDB to build all index keys
  const allIndexKeyFields = new Set<string>();
  for (const index of Object.values(schema.indexes)) {
    index.pk.composite.forEach((field) => allIndexKeyFields.add(field));
    index.sk?.composite.forEach((field) => allIndexKeyFields.add(field));
  }

  // Get PK/SK fields that should show in the primary key section
  const primaryKeyFieldNames = new Set([...pkFields, ...skFields]);

  // Get index key fields that aren't in primary PK/SK (these go in Required section)
  const otherIndexKeyFields = Array.from(allIndexKeyFields).filter(
    (field) => !primaryKeyFieldNames.has(field),
  );

  // Get all other fields (not used in any index)
  const nonKeyFields = Object.keys(schema.attributes).filter(
    (attrName) => !allIndexKeyFields.has(attrName),
  );

  // Separate required and optional fields (among non-key fields)
  const requiredOtherFields = [
    ...otherIndexKeyFields, // Index key fields not in primary
    ...nonKeyFields.filter((name) => schema.attributes[name].required),
  ];
  const optionalOtherFields = nonKeyFields.filter(
    (name) => !schema.attributes[name].required,
  );

  const handleChange = (name: string, value: any) => {
    setFormData({ ...formData, [name]: value });
    // Clear error for this field
    if (errors[name]) {
      setErrors({ ...errors, [name]: "" });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validate all index key fields (required for ElectroDB)
    for (const fieldName of allIndexKeyFields) {
      if (!formData[fieldName] || formData[fieldName] === "") {
        newErrors[fieldName] = "This field is required (used in index keys)";
      }
    }

    // Validate other required fields
    for (const attrName of Object.keys(schema.attributes)) {
      const attr = schema.attributes[attrName];
      if (attr.required && !allIndexKeyFields.has(attrName) && !formData[attrName]) {
        newErrors[attrName] = "This field is required";
      }
    }

    // Validate JSON fields (map, list, set)
    for (const [attrName, value] of Object.entries(formData)) {
      const attr = schema.attributes[attrName];
      if (
        attr &&
        (attr.type === "map" || attr.type === "list" || attr.type === "set")
      ) {
        if (typeof value === "string" && value.trim() !== "") {
          try {
            JSON.parse(value);
          } catch (e) {
            newErrors[attrName] = "Invalid JSON format";
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      // Parse JSON fields
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
        // Navigate back to entity detail page after 2 seconds
        setTimeout(() => {
          navigate({
            to: "/tables/$tableName/entity/$entityName",
            params: { tableName, entityName },
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
  };

  const renderField = (attrName: string, isRequired: boolean, isKeyField = false) => {
    const attr = schema.attributes[attrName];
    const value = formData[attrName] ?? "";
    const error = errors[attrName];

    // Skip readonly fields UNLESS they're key fields (PK/SK composites)
    // Key fields need to be provided for insert even if marked readonly
    if (attr.readonly && !isKeyField) {
      return null;
    }

    // All index key fields are effectively required
    const isEffectivelyRequired = isRequired || allIndexKeyFields.has(attrName);

    return (
      <div key={attrName} className="space-y-2">
        <Label htmlFor={attrName}>
          {attrName}
          {isEffectivelyRequired && <span className="text-red-500 ml-1">*</span>}
          <span className="text-xs text-muted-foreground ml-2">
            ({attr.type})
          </span>
        </Label>
        {attr.type === "boolean" ? (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={attrName}
              checked={value === true}
              onCheckedChange={(checked) =>
                handleChange(attrName, checked === true)
              }
            />
            <label
              htmlFor={attrName}
              className="text-sm text-muted-foreground cursor-pointer"
            >
              {value ? "True" : "False"}
            </label>
          </div>
        ) : attr.type === "map" || attr.type === "list" || attr.type === "set" ? (
          <Textarea
            id={attrName}
            value={value}
            onChange={(e) => handleChange(attrName, e.target.value)}
            placeholder={`Enter ${attr.type} as JSON`}
            className={error ? "border-red-500" : ""}
          />
        ) : attr.type === "number" ? (
          <Input
            id={attrName}
            type="number"
            value={value}
            onChange={(e) => handleChange(attrName, e.target.value)}
            className={error ? "border-red-500" : ""}
          />
        ) : (
          <Input
            id={attrName}
            type="text"
            value={value}
            onChange={(e) => handleChange(attrName, e.target.value)}
            className={error ? "border-red-500" : ""}
          />
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  };

  return (
    <div className="max-w-4xl">
      <h1 className="mb-2 text-xl font-bold">Insert Record: {entityName}</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Table: {tableName} | Version: {schema.version} | Service:{" "}
        {schema.service}
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
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
                  renderField(
                    field,
                    schema.attributes[field]?.required || false,
                    true,
                  ),
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

        {/* Submit/Cancel Buttons */}
        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Inserting..." : "Insert Record"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              navigate({
                to: "/tables/$tableName/entity/$entityName",
                params: { tableName, entityName },
              })
            }
          >
            Cancel
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
                  Redirecting to entity detail page...
                </p>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-red-600">Insert failed</p>
                <p className="text-sm text-red-500 mt-1">
                  {submitResult.error}
                </p>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
