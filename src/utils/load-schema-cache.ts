/**
 * Schema Cache Loader
 *
 * Fast loading of pre-built entity schemas from JSON cache
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type SchemaCache, schemaCacheSchema } from "./parsedEntitiesSchema";

/**
 * Load schema cache from disk (server-side only)
 * This is MUCH faster than parsing TypeScript files on every request
 */
export function loadSchemaCache(): SchemaCache {
  const projectRoot = process.env.ELECTRO_VIEWER_CWD || process.cwd();
  const cacheFile = join(projectRoot, ".electro-viewer", "schema.json");

  if (!existsSync(cacheFile)) {
    throw new Error(
      `Schema cache not found at ${cacheFile}\n\n` +
        `The schema cache should be built automatically when the dev server starts.\n` +
        `If you're seeing this error, the schema build may have failed.\n` +
        `Check your electro-viewer-config.ts file and ensure entityConfigPaths is correct.`,
    );
  }

  const cacheContent = readFileSync(cacheFile, "utf-8");
  const parsedContent = JSON.parse(cacheContent);

  // Validate schema after loading
  const validationResult = schemaCacheSchema.safeParse(parsedContent);
  if (!validationResult.success) {
    throw new Error(
      `Schema validation failed after loading from ${cacheFile}:\n${validationResult.error.message}`,
    );
  }

  return validationResult.data;
}
