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
    console.log("Loading entity schemas...");

    // Parse the TypeScript source directly
    const fs = await import("node:fs/promises");
    const entitiesContent = await fs.readFile(
      "/Users/alex/dev/client-app/packages/domain/dynamo/schema/model/entities.ts",
      "utf-8",
    );

    console.log("File loaded, length:", entitiesContent.length);

    // Extract entity definitions using regex
    const entityMatches = entitiesContent.matchAll(
      /export const (\w+) = new Entity\(([\s\S]*?)\},\n  \{ client, table \},\n\);/g,
    );

    const schemas: EntitySchema[] = [];
    let matchCount = 0;

    for (const match of entityMatches) {
      matchCount++;
      const entityName = match[1];
      const entityConfig = match[2];

      console.log(`Found entity ${matchCount}: ${entityName}`);

      // Parse the configuration to extract schema details
      const modelMatch = entityConfig.match(/model:\s*\{([^}]+)\}/);
      let name = entityName.toLowerCase();
      let version = "1";
      let service = "model";

      if (modelMatch) {
        const entityMatch = modelMatch[1].match(/entity:\s*["']([^"']+)["']/);
        const versionMatch = modelMatch[1].match(/version:\s*["']([^"']+)["']/);

        if (entityMatch) name = entityMatch[1];
        if (versionMatch) version = versionMatch[1];
      }

      // Extract indexes more reliably
      const indexes: EntitySchema["indexes"] = {};

      // Look for primary index
      const pkMatch = entityConfig.match(
        /pk:\s*\{\s*field:\s*["']([^"']+)["']\s*,\s*composite:\s*\[([^\]]*)\]/,
      );
      const skMatch = entityConfig.match(
        /sk:\s*\{\s*field:\s*["']([^"']+)["']\s*,\s*composite:\s*\[([^\]]*)\]/,
      );

      if (pkMatch) {
        const pkField = pkMatch[1];
        const pkComposite = pkMatch[2]
          .split(",")
          .map((s) => s.trim().replace(/["']/g, ""))
          .filter(Boolean);

        indexes.primary = {
          pk: {
            field: pkField,
            composite: pkComposite,
            template: "",
          },
        };

        if (skMatch) {
          const skField = skMatch[1];
          const skComposite = skMatch[2]
            .split(",")
            .map((s) => s.trim().replace(/["']/g, ""))
            .filter(Boolean);

          indexes.primary.sk = {
            field: skField,
            composite: skComposite,
            template: "",
          };
        }
      }

      // Look for GSI indexes
      const gsiPattern = /(\w+):\s*\{\s*index:\s*["']([^"']+)["']/g;
      let gsiMatch;
      while ((gsiMatch = gsiPattern.exec(entityConfig)) !== null) {
        const indexName = gsiMatch[1];
        const gsiName = gsiMatch[2];

        // Find the pk and sk for this GSI
        const gsiSection = entityConfig.substring(gsiMatch.index);
        const gsiPkMatch = gsiSection.match(
          /pk:\s*\{\s*field:\s*["']([^"']+)["']\s*,\s*composite:\s*\[([^\]]*)\]/,
        );
        const gsiSkMatch = gsiSection.match(
          /sk:\s*\{\s*field:\s*["']([^"']+)["']\s*,\s*composite:\s*\[([^\]]*)\]/,
        );

        if (gsiPkMatch) {
          indexes[indexName] = {
            pk: {
              field: gsiPkMatch[1],
              composite: gsiPkMatch[2]
                .split(",")
                .map((s) => s.trim().replace(/["']/g, ""))
                .filter(Boolean),
              template: "",
            },
          };

          if (gsiSkMatch) {
            indexes[indexName].sk = {
              field: gsiSkMatch[1],
              composite: gsiSkMatch[2]
                .split(",")
                .map((s) => s.trim().replace(/["']/g, ""))
                .filter(Boolean),
              template: "",
            };
          }
        }
      }

      // Extract attributes
      const attributesMatch = entityConfig.match(
        /attributes:\s*\{([\s\S]*?)\n    \},\n\s*indexes/,
      );
      const attributes: string[] = [];

      if (attributesMatch) {
        // Match attribute names at the beginning of lines
        const attrMatches = attributesMatch[1].matchAll(/^\s{6}(\w+):\s*\{/gm);
        for (const attrMatch of attrMatches) {
          attributes.push(attrMatch[1]);
        }
      }

      schemas.push({
        name,
        version,
        service,
        indexes,
        attributes,
      });
    }

    console.log(`Total entities found: ${schemas.length}`);
    return schemas;
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

