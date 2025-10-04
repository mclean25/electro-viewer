/**
 * Schema Cache Builder
 *
 * Parses ElectroDB entity files and writes a JSON schema cache
 * This avoids expensive TypeScript parsing on every request
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadTypeScriptFiles } from "./load-typescript";

export interface EntitySchema {
  name: string;
  version: string;
  service: string;
  sourceFile: string;
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

export interface SchemaCache {
  entities: EntitySchema[];
  generatedAt: string;
  config: {
    entityConfigPaths: string[];
    tsconfigPath?: string;
  };
}

/**
 * Build schema cache from entity config files
 */
export async function buildSchemaCache(
  entityConfigPaths: string[],
  tsconfigPath?: string,
  configEnv?: Record<string, string>,
): Promise<SchemaCache> {
  const _projectRoot = process.env.ELECTRO_VIEWER_CWD || process.cwd();

  console.log("\n🔨 Building entity schema cache...");
  console.log(`   Entity patterns: ${entityConfigPaths.join(", ")}`);

  // Load all entity files using the existing TypeScript loader
  const serviceModule = await loadTypeScriptFiles(
    entityConfigPaths,
    tsconfigPath,
    configEnv,
  );

  const schemas: EntitySchema[] = [];

  // Parse each entity's schema
  for (const [_name, entityData] of Object.entries(serviceModule)) {
    const entity = entityData.module;
    const sourceFile = entityData.sourceFile;

    if (entity && typeof entity === "object" && "model" in entity) {
      const model = (entity as any).model;
      const indexes: EntitySchema["indexes"] = {};

      // Extract primary index
      let primaryIndex = model.indexes?.primary;
      let primaryIndexName = "primary";

      // If no "primary" index, find the index without an "index" property
      if (!primaryIndex && model.indexes) {
        for (const [indexName, indexDef] of Object.entries(model.indexes)) {
          const idx = indexDef as any;
          if (!idx.index) {
            primaryIndex = idx;
            primaryIndexName = indexName;
            break;
          }
        }
      }

      if (primaryIndex) {
        indexes.primary = {
          pk: {
            field: primaryIndex.pk.field || "pk",
            composite:
              primaryIndex.pk.facets?.map((f: any) => f.name) ||
              primaryIndex.pk.composite ||
              [],
            template:
              model.prefixes?.[primaryIndexName]?.pk?.prefix ||
              model.prefixes?.[""]?.pk?.prefix ||
              "",
          },
        };

        if (primaryIndex.sk) {
          indexes.primary.sk = {
            field: primaryIndex.sk.field || "sk",
            composite:
              primaryIndex.sk.facets?.map((f: any) => f.name) ||
              primaryIndex.sk.composite ||
              [],
            template:
              model.prefixes?.[primaryIndexName]?.sk?.prefix ||
              model.prefixes?.[""]?.sk?.prefix ||
              "",
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
                composite:
                  idx.pk?.facets?.map((f: any) => f.name) || idx.pk?.composite || [],
                template: "",
              },
            };

            if (idx.sk) {
              indexes[indexName].sk = {
                field: idx.sk?.field || `${indexName}sk`,
                composite:
                  idx.sk?.facets?.map((f: any) => f.name) || idx.sk?.composite || [],
                template: "",
              };
            }
          }
        }
      }

      // Extract attributes
      const attributes: string[] = [];
      if (model.schema?.attributes) {
        attributes.push(...Object.keys(model.schema.attributes));
      }

      schemas.push({
        name: model.entity,
        version: model.version,
        service: model.service,
        sourceFile,
        indexes,
        attributes,
      });
    }
  }

  console.log(`   ✅ Parsed ${schemas.length} entities`);

  const schemaCache: SchemaCache = {
    entities: schemas,
    generatedAt: new Date().toISOString(),
    config: {
      entityConfigPaths,
      tsconfigPath,
    },
  };

  return schemaCache;
}

/**
 * Write schema cache to disk
 */
export function writeSchemaCache(schemaCache: SchemaCache): string {
  const projectRoot = process.env.ELECTRO_VIEWER_CWD || process.cwd();
  const cacheDir = join(projectRoot, ".electro-viewer");
  const cacheFile = join(cacheDir, "schema.json");

  // Create cache directory if it doesn't exist
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }

  // Write schema cache
  writeFileSync(cacheFile, JSON.stringify(schemaCache, null, 2), "utf-8");

  console.log(`   💾 Schema cache written to: ${cacheFile}\n`);

  return cacheFile;
}

/**
 * Build and write schema cache in one step
 */
export async function buildAndWriteSchemaCache(
  entityConfigPaths: string[],
  tsconfigPath?: string,
  configEnv?: Record<string, string>,
): Promise<SchemaCache> {
  const schemaCache = await buildSchemaCache(
    entityConfigPaths,
    tsconfigPath,
    configEnv,
  );
  writeSchemaCache(schemaCache);
  return schemaCache;
}
