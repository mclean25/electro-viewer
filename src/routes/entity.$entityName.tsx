import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";
import { useState } from "react";
import { config } from "../../electro-viewer-config";
import { buildElectroDBKey } from "../utils/electrodb-keys";

interface EntitySchema {
  name: string;
  version: string;
  service: string;
  indexes: {
    [key: string]: {
      pk: {
        field: string;
        composite: string[];
        template?: string;
      };
      sk?: {
        field: string;
        composite: string[];
        template?: string;
      };
    };
  };
  attributes: string[];
}

// Server function to get entity schema by name
const getEntitySchema = createServerFn({
  method: "GET",
})
  .validator((entityName: string) => entityName)
  .handler(async ({ data: entityName }) => {
    try {
      const localEntitiesPath = "/Users/alex/dev/electro-viewer/test/dynamo/service.ts";
      const entitiesModule = await import(localEntitiesPath);

      for (const [name, entity] of Object.entries(entitiesModule)) {
        if (entity && typeof entity === "object" && "model" in entity) {
          const model = (entity as any).model;
          if (model.entity === entityName) {
            const indexes: EntitySchema["indexes"] = {};

            // Extract primary index
            if (model.indexes && model.indexes.primary) {
              const primary = model.indexes.primary;
              indexes.primary = {
                pk: {
                  field: primary.pk.field || "pk",
                  composite: primary.pk.facets || primary.pk.composite || [],
                },
              };

              if (primary.sk) {
                indexes.primary.sk = {
                  field: primary.sk.field || "sk",
                  composite: primary.sk.facets || primary.sk.composite || [],
                };
              }
            }

            // Extract GSI indexes
            if (model.indexes) {
              for (const [indexName, indexDef] of Object.entries(model.indexes)) {
                if (indexName !== "primary") {
                  const idx = indexDef as any;
                  indexes[indexName] = {
                    pk: {
                      field: idx.pk?.field || `${indexName}pk`,
                      composite: idx.pk?.facets || idx.pk?.composite || [],
                    },
                  };

                  if (idx.sk) {
                    indexes[indexName].sk = {
                      field: idx.sk?.field || `${indexName}sk`,
                      composite: idx.sk?.facets || idx.sk?.composite || [],
                    };
                  }
                }
              }
            }

            const attributes: string[] = [];
            if (model.schema?.attributes) {
              attributes.push(...Object.keys(model.schema.attributes));
            }

            return {
              name: model.entity,
              version: model.version,
              service: model.service,
              indexes,
              attributes,
            } as EntitySchema;
          }
        }
      }
      throw new Error(`Entity ${entityName} not found`);
    } catch (error) {
      console.error("Error loading entity schema:", error);
      throw error;
    }
  });

// Server function to query DynamoDB
const queryDynamoDB = createServerFn({
  method: "POST",
})
  .validator((params: { pk: string; sk?: string; indexName?: string }) => params)
  .handler(async ({ data }) => {
    const { pk, sk, indexName } = data;

    try {
      // Use AWS SDK's fromIni credential provider for SSO profiles
      const client = new DynamoDBClient({
        region: config.region,
        credentials: fromIni({ profile: config.profile }),
      });

      const docClient = DynamoDBDocumentClient.from(client);

      if (sk) {
        // Use GetItem for exact match
        const command = new GetCommand({
          TableName: config.table,
          Key: {
            pk,
            sk,
          },
        });

        const result = await docClient.send(command);
        return {
          success: true,
          data: result.Item ? [result.Item] : [],
          count: result.Item ? 1 : 0,
        };
      } else {
        // Use Query for PK-only queries
        const command = new QueryCommand({
          TableName: config.table,
          IndexName: indexName,
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: {
            ":pk": pk,
          },
        });

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

export const Route = createFileRoute("/entity/$entityName")({
  component: EntityDetail,
  loader: async ({ params }) => {
    const schema = await getEntitySchema({ data: params.entityName });
    return { entityName: params.entityName, schema };
  },
});

function EntityDetail() {
  const { entityName, schema } = Route.useLoaderData();
  const [selectedIndex, setSelectedIndex] = useState("primary");
  const [pkValues, setPkValues] = useState<Record<string, string>>({});
  const [skValues, setSkValues] = useState<Record<string, string>>({});
  const [queryResult, setQueryResult] = useState<any>(null);
  const [isQuerying, setIsQuerying] = useState(false);

  const currentIndex = schema.indexes[selectedIndex];

  const handleQuery = async () => {
    setIsQuerying(true);
    setQueryResult(null);

    try {
      // Build PK using ElectroDB logic
      let pk = buildElectroDBKey(true, currentIndex.pk.composite, pkValues, schema);

      // Build SK if present using ElectroDB logic
      let sk = undefined;
      if (currentIndex.sk) {
        sk = buildElectroDBKey(false, currentIndex.sk.composite, skValues, schema);
      }

      const result = await queryDynamoDB({
        data: {
          pk,
          sk,
          indexName: selectedIndex === "primary" ? undefined : selectedIndex,
        },
      });

      // Add the actual query keys to the result for display
      setQueryResult({
        ...result,
        queryKeys: {
          pk,
          sk,
          indexName: selectedIndex === "primary" ? undefined : selectedIndex,
        },
      });
    } catch (error) {
      console.error("Query error:", error);
      setQueryResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        queryKeys: {
          pk: buildElectroDBKey(true, currentIndex.pk.composite, pkValues, schema),
          sk: currentIndex.sk ? buildElectroDBKey(false, currentIndex.sk.composite, skValues, schema) : undefined,
          indexName: selectedIndex === "primary" ? undefined : selectedIndex,
        },
      });
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h1>Entity: {entityName}</h1>
      <p style={{ color: "#666" }}>
        Version: {schema.version} | Service: {schema.service}
      </p>

      <div style={{ marginBottom: "20px" }}>
        <h3>Select Index:</h3>
        <select
          value={selectedIndex}
          onChange={(e) => {
            setSelectedIndex(e.target.value);
            setPkValues({});
            setSkValues({});
            setQueryResult(null);
          }}
          style={{
            padding: "8px",
            fontSize: "14px",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        >
          {Object.keys(schema.indexes).map((indexName) => (
            <option key={indexName} value={indexName}>
              {indexName} {indexName !== "primary" && "(GSI)"}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          marginBottom: "20px",
          padding: "15px",
          backgroundColor: "#f5f5f5",
          borderRadius: "5px",
        }}
      >
        <h3>Build Query Keys</h3>

        <div style={{ marginBottom: "15px" }}>
          <h4>Partition Key ({currentIndex.pk.field})</h4>
          {currentIndex.pk.composite.length === 0 ? (
            <div>
              <p style={{ color: "#666", fontSize: "12px" }}>
                No composite attributes (static key)
              </p>
              <div style={{ marginTop: "10px" }}>
                <strong>Key Pattern:</strong>{" "}
                <code
                  style={{
                    backgroundColor: "#fff",
                    padding: "4px 8px",
                    border: "1px solid #ddd",
                  }}
                >
${"{service}"}
                </code>
              </div>
              <div style={{ marginTop: "8px" }}>
                <strong>Constructed Key:</strong>{" "}
                <code
                  style={{
                    backgroundColor: "#e8f5e8",
                    padding: "4px 8px",
                    border: "1px solid #4caf50",
                    color: "#2e7d32",
                    fontWeight: "bold",
                  }}
                >
                  {buildElectroDBKey(true, currentIndex.pk.composite, pkValues, schema)}
                </code>
              </div>
            </div>
          ) : (
            <>
              {currentIndex.pk.composite.map((field) => (
                <div key={field} style={{ marginBottom: "10px" }}>
                  <label style={{ display: "block", marginBottom: "5px" }}>
                    {field}:
                  </label>
                  <input
                    type="text"
                    value={pkValues[field] || ""}
                    onChange={(e) =>
                      setPkValues({ ...pkValues, [field]: e.target.value })
                    }
                    placeholder={`Enter ${field}`}
                    style={{
                      padding: "8px",
                      width: "300px",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                    }}
                  />
                </div>
              ))}
              <div style={{ marginTop: "10px" }}>
                <strong>Key Pattern:</strong>{" "}
                <code
                  style={{
                    backgroundColor: "#fff",
                    padding: "4px 8px",
                    border: "1px solid #ddd",
                  }}
                >
                  ${"{service}"}#{currentIndex.pk.composite.map(c => `{${c}}`).join("#")}
                </code>
              </div>
              <div style={{ marginTop: "8px" }}>
                <strong>Constructed Key:</strong>{" "}
                <code
                  style={{
                    backgroundColor: "#e8f5e8",
                    padding: "4px 8px",
                    border: "1px solid #4caf50",
                    color: "#2e7d32",
                    fontWeight: "bold",
                  }}
                >
                  {buildElectroDBKey(true, currentIndex.pk.composite, pkValues, schema) || "(Enter values to see constructed key)"}
                </code>
              </div>
            </>
          )}
        </div>

        {currentIndex.sk && (
          <div style={{ marginBottom: "15px" }}>
            <h4>Sort Key ({currentIndex.sk.field})</h4>
            {currentIndex.sk.composite.length === 0 ? (
              <div>
                <p style={{ color: "#666", fontSize: "12px" }}>
                  No composite attributes
                </p>
                <div style={{ marginTop: "10px" }}>
                  <strong>Key Pattern:</strong>{" "}
                  <code
                    style={{
                      backgroundColor: "#fff",
                      padding: "4px 8px",
                      border: "1px solid #ddd",
                    }}
                  >
                    ${"{entity}"}_{"{version}"}
                  </code>
                </div>
                <div style={{ marginTop: "8px" }}>
                  <strong>Constructed Key:</strong>{" "}
                  <code
                    style={{
                      backgroundColor: "#e8f5e8",
                      padding: "4px 8px",
                      border: "1px solid #4caf50",
                      color: "#2e7d32",
                      fontWeight: "bold",
                    }}
                  >
                    {buildElectroDBKey(false, currentIndex.sk.composite, skValues, schema)}
                  </code>
                </div>
              </div>
            ) : (
              <>
                {currentIndex.sk.composite.map((field) => (
                  <div key={field} style={{ marginBottom: "10px" }}>
                    <label style={{ display: "block", marginBottom: "5px" }}>
                      {field}:
                    </label>
                    <input
                      type="text"
                      value={skValues[field] || ""}
                      onChange={(e) =>
                        setSkValues({ ...skValues, [field]: e.target.value })
                      }
                      placeholder={`Enter ${field}`}
                      style={{
                        padding: "8px",
                        width: "300px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                ))}
                <div style={{ marginTop: "10px" }}>
                  <strong>Key Pattern:</strong>{" "}
                  <code
                    style={{
                      backgroundColor: "#fff",
                      padding: "4px 8px",
                      border: "1px solid #ddd",
                    }}
                  >
                    ${"{entity}"}_{"{version}"}#{currentIndex.sk.composite.map(c => `{${c}}`).join("#")}
                  </code>
                </div>
                <div style={{ marginTop: "8px" }}>
                  <strong>Constructed Key:</strong>{" "}
                  <code
                    style={{
                      backgroundColor: "#e8f5e8",
                      padding: "4px 8px",
                      border: "1px solid #4caf50",
                      color: "#2e7d32",
                      fontWeight: "bold",
                    }}
                  >
                    {buildElectroDBKey(false, currentIndex.sk.composite, skValues, schema) || "(Enter values to see constructed key)"}
                  </code>
                </div>
              </>
            )}
          </div>
        )}

        <button
          onClick={handleQuery}
          disabled={isQuerying}
          style={{
            padding: "10px 20px",
            backgroundColor: isQuerying ? "#ccc" : "#0066cc",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isQuerying ? "not-allowed" : "pointer",
            fontSize: "14px",
          }}
        >
          {isQuerying ? "Querying..." : "Query DynamoDB"}
        </button>
      </div>

      {queryResult && (
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            backgroundColor: queryResult.success ? "#f0f9f0" : "#fff0f0",
            border: `1px solid ${queryResult.success ? "#4caf50" : "#f44336"}`,
            borderRadius: "5px",
          }}
        >
          <h3>Query Result</h3>
          
          {/* Show the actual query keys used */}
          <div style={{ 
            marginBottom: "15px", 
            padding: "10px", 
            backgroundColor: "#f8f8f8", 
            borderRadius: "3px",
            border: "1px solid #ddd"
          }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#333" }}>
              Query Keys Used:
            </h4>
            <div style={{ fontSize: "12px", fontFamily: "monospace" }}>
              <div style={{ marginBottom: "4px" }}>
                <strong>PK:</strong> 
                <code style={{ 
                  marginLeft: "8px", 
                  padding: "2px 4px", 
                  backgroundColor: "#fff", 
                  border: "1px solid #ccc",
                  borderRadius: "2px"
                }}>
                  {queryResult.queryKeys?.pk}
                </code>
              </div>
              {queryResult.queryKeys?.sk && (
                <div style={{ marginBottom: "4px" }}>
                  <strong>SK:</strong> 
                  <code style={{ 
                    marginLeft: "8px", 
                    padding: "2px 4px", 
                    backgroundColor: "#fff", 
                    border: "1px solid #ccc",
                    borderRadius: "2px"
                  }}>
                    {queryResult.queryKeys.sk}
                  </code>
                </div>
              )}
              {queryResult.queryKeys?.indexName && (
                <div>
                  <strong>Index:</strong> 
                  <code style={{ 
                    marginLeft: "8px", 
                    padding: "2px 4px", 
                    backgroundColor: "#fff", 
                    border: "1px solid #ccc",
                    borderRadius: "2px"
                  }}>
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
                <div
                  style={{
                    maxHeight: "400px",
                    overflow: "auto",
                    marginTop: "10px",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "12px",
                    }}
                  >
                    <thead>
                      <tr style={{ backgroundColor: "#f5f5f5" }}>
                        {Object.keys(queryResult.data[0]).map((key) => (
                          <th
                            key={key}
                            style={{
                              padding: "8px",
                              border: "1px solid #ddd",
                              textAlign: "left",
                            }}
                          >
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryResult.data.map((item: any, index: number) => (
                        <tr key={index}>
                          {Object.entries(item).map(([key, value]) => (
                            <td
                              key={key}
                              style={{
                                padding: "8px",
                                border: "1px solid #ddd",
                                verticalAlign: "top",
                              }}
                            >
                              <pre
                                style={{
                                  margin: 0,
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                }}
                              >
                                {typeof value === "object"
                                  ? JSON.stringify(value, null, 2)
                                  : String(value)}
                              </pre>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: "#666" }}>No items found with these keys</p>
              )}
            </>
          ) : (
            <div>
              <p style={{ color: "#f44336" }}>
                <strong>Error:</strong> {queryResult.error}
              </p>
              {queryResult.errorType && (
                <p style={{ color: "#666", fontSize: "12px" }}>
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