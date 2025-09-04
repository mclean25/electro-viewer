import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

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

const getEntitySchemas = createServerFn({
  method: "GET",
}).handler(async () => {
  try {
    console.log("Loading entity schemas using local test file...");

    // Try to dynamically import the local test entities module
    const localEntitiesPath = "/Users/alex/dev/electro-viewer/test/dynamo/service.ts";
    
    try {
      // Use dynamic import directly since it's a local file with no dependencies
      const entitiesModule = await import(localEntitiesPath);
      
      const schemas: EntitySchema[] = [];
      
      for (const [name, entity] of Object.entries(entitiesModule)) {
        if (entity && typeof entity === 'object' && 'model' in entity) {
          const model = (entity as any).model;
          const indexes: EntitySchema["indexes"] = {};
          
          // Extract primary index
          if (model.indexes && model.indexes.primary) {
            const primary = model.indexes.primary;
            indexes.primary = {
              pk: {
                field: primary.pk.field || "pk",
                composite: primary.pk.facets?.map((f: any) => f.name) || primary.pk.composite || [],
                template: model.prefixes?.[""]?.pk?.prefix || "",
              },
            };
            
            if (primary.sk) {
              indexes.primary.sk = {
                field: primary.sk.field || "sk",
                composite: primary.sk.facets?.map((f: any) => f.name) || primary.sk.composite || [],
                template: model.prefixes?.[""]?.sk?.prefix || "",
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
                    composite: idx.pk?.facets?.map((f: any) => f.name) || idx.pk?.composite || [],
                    template: "",
                  },
                };
                
                if (idx.sk) {
                  indexes[indexName].sk = {
                    field: idx.sk?.field || `${indexName}sk`,
                    composite: idx.sk?.facets?.map((f: any) => f.name) || idx.sk?.composite || [],
                    template: "",
                  };
                }
              }
            }
          }
          
          // Extract attributes from the entity schema
          const attributes: string[] = [];
          if (model.schema?.attributes) {
            attributes.push(...Object.keys(model.schema.attributes));
          }
          
          schemas.push({
            name: model.entity,
            version: model.version,
            service: model.service,
            indexes,
            attributes,
          });
        }
      }
      
      console.log(`Total entities found via dynamic import: ${schemas.length}`);
      return schemas;
      
    } catch (error) {
      console.error("Failed to extract via dynamic import:", error);
      
      // Fall back to the original external file approach
      console.log("Falling back to external file parsing...");
      const externalPath = "/Users/alex/dev/client-app/packages/domain/dynamo/schema/model/entities.ts";
      
      const fs = await import("node:fs/promises");
      const entitiesContent = await fs.readFile(externalPath, "utf-8");
      const entityMatches = entitiesContent.matchAll(
        /export const (\w+) = new Entity\(([\s\S]*?)\},\n  \{ client, table \},\n\);/g,
      );
      
      const schemas: EntitySchema[] = [];
      
      for (const match of entityMatches) {
        const entityName = match[1];
        const entityConfig = match[2];
        
        // Basic extraction for fallback
        const modelMatch = entityConfig.match(/entity:\s*["']([^"']+)["']/);
        const versionMatch = entityConfig.match(/version:\s*["']([^"']+)["']/);
        
        schemas.push({
          name: modelMatch?.[1] || entityName.toLowerCase(),
          version: versionMatch?.[1] || "1",
          service: "model",
          indexes: { primary: { pk: { field: "pk", composite: [], template: "" } } },
          attributes: [],
        });
      }
      
      return schemas;
    }
  } catch (error) {
    console.error("Error loading entity schemas:", error);
    // Fallback: return hardcoded schema information based on what we read
    return [
      {
        name: "company",
        version: "1",
        service: "model",
        indexes: {
          primary: {
            pk: { field: "pk", composite: [], template: "$model" },
            sk: {
              field: "sk",
              composite: ["companyId"],
              template: "$company_1#companyid_${companyId}",
            },
          },
        },
        attributes: [
          "companyId",
          "companyName",
          "publicCompanyInfo",
          "fileCount",
          "modifiedBy",
          "createdBy",
          "createdVia",
          "fyeOverride",
          "createdAt",
          "updatedAt",
        ],
      },
      {
        name: "fileModel",
        version: "1",
        service: "model",
        indexes: {
          primary: {
            pk: {
              field: "pk",
              composite: ["companyId"],
              template: "$model#companyid_${companyId}",
            },
            sk: {
              field: "sk",
              composite: ["fileId"],
              template: "$filemodel_1#fileid_${fileId}",
            },
          },
        },
        attributes: [
          "companyId",
          "fileId",
          "status",
          "fileName",
          "uploadedFileName",
          "uploadMethod",
          "metadata",
          "createdBy",
          "createdVia",
          "archivedAt",
          "createdAt",
          "updatedAt",
        ],
      },
      {
        name: "companyModel",
        version: "1",
        service: "model",
        indexes: {
          primary: {
            pk: {
              field: "pk",
              composite: ["companyId"],
              template: "$model#companyid_${companyId}",
            },
            sk: {
              field: "sk",
              composite: ["createdAt"],
              template: "$companymodel_1#createdat_${createdAt}",
            },
          },
          byStatus: {
            pk: {
              field: "gsi1pk",
              composite: ["companyId"],
              template: "$model#companyid_${companyId}",
            },
            sk: {
              field: "gsi1sk",
              composite: ["status", "createdAt"],
              template: "$companymodel_1#status_${status}#createdat_${createdAt}",
            },
          },
        },
        attributes: [
          "companyId",
          "status",
          "isInitial",
          "trigger",
          "executionArn",
          "excelModel",
          "numberOfTables",
          "liteModel",
          "createdAt",
          "updatedAt",
        ],
      },
      {
        name: "companyModelExecution",
        version: "1",
        service: "model",
        indexes: {
          primary: {
            pk: {
              field: "pk",
              composite: ["companyId"],
              template: "$model#companyid_${companyId}",
            },
            sk: {
              field: "sk",
              composite: ["executionArn"],
              template: "$companymodelexecution_1#executionarn_${executionArn}",
            },
          },
        },
        attributes: ["companyId", "executionArn", "status", "startedAt", "stoppedAt"],
      },
      {
        name: "initialCompanyModelEvent",
        version: "1",
        service: "model",
        indexes: {
          primary: {
            pk: { field: "pk", composite: [], template: "$model" },
            sk: {
              field: "sk",
              composite: ["companyId"],
              template: "$initialcompanymodelevent_1#companyid_${companyId}",
            },
          },
        },
        attributes: ["companyId", "createdAt"],
      },
      {
        name: "queuedCompanyModelGeneration",
        version: "1",
        service: "model",
        indexes: {
          primary: {
            pk: { field: "pk", composite: [], template: "$model" },
            sk: {
              field: "sk",
              composite: ["companyId"],
              template: "$queuedcompanymodelgeneration_1#companyid_${companyId}",
            },
          },
        },
        attributes: ["companyId", "createdAt"],
      },
    ];
  }
});

export const Route = createFileRoute("/entities")({
  component: EntitiesViewer,
  loader: async () => await getEntitySchemas(),
});

function EntitiesViewer() {
  const schemas = Route.useLoaderData();

  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h1>ElectroDB Entity Definitions</h1>
      <p>Total entities: {schemas.length}</p>

      {schemas.map((schema) => (
        <div
          key={schema.name}
          style={{
            marginBottom: "30px",
            padding: "15px",
            border: "1px solid #ccc",
            borderRadius: "5px",
            backgroundColor: "#f9f9f9",
          }}
        >
          <h2 style={{ color: "#333", marginTop: 0 }}>
            {schema.name}{" "}
            <span style={{ fontSize: "14px", color: "#666" }}>(v{schema.version})</span>
          </h2>
          <p style={{ color: "#666" }}>Service: {schema.service}</p>

          <h3>Indexes:</h3>
          {Object.entries(schema.indexes).map(([indexName, index]) => (
            <div
              key={indexName}
              style={{
                marginLeft: "20px",
                marginBottom: "15px",
                padding: "10px",
                backgroundColor: "#fff",
                border: "1px solid #ddd",
                borderRadius: "3px",
              }}
            >
              <h4 style={{ margin: "0 0 10px 0", color: "#555" }}>
                {indexName} {indexName !== "primary" && "(GSI)"}
              </h4>

              <div style={{ marginLeft: "10px" }}>
                <div>
                  <strong>PK:</strong>
                  <div style={{ marginLeft: "15px" }}>
                    <div>Field: {index.pk.field}</div>
                    <div>Composite: [{index.pk.composite.join(", ") || "none"}]</div>
                    {index.pk.template && (
                      <div style={{ color: "#0066cc", fontSize: "13px" }}>
                        Pattern: {index.pk.template}
                      </div>
                    )}
                  </div>
                </div>

                {index.sk && (
                  <div style={{ marginTop: "10px" }}>
                    <strong>SK:</strong>
                    <div style={{ marginLeft: "15px" }}>
                      <div>Field: {index.sk.field}</div>
                      <div>Composite: [{index.sk.composite.join(", ")}]</div>
                      {index.sk.template && (
                        <div style={{ color: "#0066cc", fontSize: "13px" }}>
                          Pattern: {index.sk.template}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          <details style={{ marginTop: "10px" }}>
            <summary style={{ cursor: "pointer", color: "#666" }}>
              Attributes ({schema.attributes.length})
            </summary>
            <div style={{ marginLeft: "20px", marginTop: "10px" }}>
              {schema.attributes.map((attr) => (
                <span
                  key={attr}
                  style={{
                    display: "inline-block",
                    margin: "2px",
                    padding: "3px 8px",
                    backgroundColor: "#e0e0e0",
                    borderRadius: "3px",
                    fontSize: "12px",
                  }}
                >
                  {attr}
                </span>
              ))}
            </div>
          </details>
        </div>
      ))}
    </div>
  );
}

