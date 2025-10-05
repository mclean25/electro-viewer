/**
 * Schema Cache Builder
 *
 * Parses ElectroDB entity files and writes a JSON schema cache
 * This avoids expensive TypeScript parsing on every request
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadTypeScriptFiles } from "./load-typescript";

export interface AttributeDefinition {
  type: string; // 'string', 'number', 'boolean', 'map', 'list', 'set', etc.
  required?: boolean;
  readonly?: boolean;
  default?: any;
  properties?: Record<string, AttributeDefinition>; // For map types
  items?: string | AttributeDefinition; // For list/set types
}

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
  attributes: Record<string, AttributeDefinition>;
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

      // Extract all indexes uniformly
      if (model.indexes) {
        for (const [indexName, indexDef] of Object.entries(model.indexes)) {
          const idx = indexDef as any;
          indexes[indexName] = {
            pk: {
              field: idx.pk?.field || "pk",
              composite:
                idx.pk?.facets ||
                idx.pk?.composite ||
                [],
              template:
                model.prefixes?.[indexName]?.pk?.prefix ||
                model.prefixes?.[""]?.pk?.prefix ||
                "",
            },
          };

          if (idx.sk) {
            indexes[indexName].sk = {
              field: idx.sk?.field || "sk",
              composite:
                idx.sk?.facets ||
                idx.sk?.composite ||
                [],
              template:
                model.prefixes?.[indexName]?.sk?.prefix ||
                model.prefixes?.[""]?.sk?.prefix ||
                "",
            };
          }
        }
      }

      // Extract attributes with full metadata
      const attributes: Record<string, AttributeDefinition> = {};
      if (model.schema?.attributes) {
        for (const [attrName, attrDef] of Object.entries(
          model.schema.attributes,
        )) {
          const def = attrDef as any;
          const attributeDef: AttributeDefinition = {
            type: def.type || "string",
            required: def.required,
            readonly: def.readonly || def.readOnly,
          };

          // Include default value if present
          if (def.default !== undefined) {
            attributeDef.default = def.default;
          }

          // Handle map types with nested properties
          // ElectroDB stores map properties in properties.attributes
          if (def.type === "map" && def.properties?.attributes) {
            attributeDef.properties = {};
            for (const [propName, propDef] of Object.entries(def.properties.attributes)) {
              const prop = propDef as any;
              attributeDef.properties[propName] = {
                type: prop.type || "string",
                required: prop.required,
                readonly: prop.readOnly || prop.readonly,
              };
            }
          }

          // Handle list/set types
          if ((def.type === "list" || def.type === "set") && def.items) {
            // ElectroDB may store items as a type string or as an object
            if (typeof def.items === "string") {
              attributeDef.items = def.items;
            } else if (def.items.type) {
              attributeDef.items = def.items.type;
            }
          }

          attributes[attrName] = attributeDef;
        }
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
