/**
 * Schema Cache Loader
 *
 * Fast loading of pre-built entity schemas from JSON cache
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { SchemaCache, EntitySchema } from "./build-schema-cache";

/**
 * Load schema cache from disk
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
			`Check your electro-viewer-config.ts file and ensure entityConfigPaths is correct.`
		);
	}

	const cacheContent = readFileSync(cacheFile, "utf-8");
	const schemaCache: SchemaCache = JSON.parse(cacheContent);

	return schemaCache;
}

/**
 * Get all entity schemas
 */
export function getAllEntitySchemas(): EntitySchema[] {
	const cache = loadSchemaCache();
	return cache.entities;
}

/**
 * Get a single entity schema by name
 */
export function getEntitySchemaByName(entityName: string): EntitySchema | null {
	const cache = loadSchemaCache();
	return cache.entities.find(e => e.name === entityName) || null;
}

/**
 * Get simplified entity schemas (just name, version, service, sourceFile)
 * Used by the side nav
 */
export function getSimpleEntitySchemas(): Array<{
	name: string;
	version: string;
	service: string;
	sourceFile: string;
}> {
	const cache = loadSchemaCache();
	return cache.entities.map(e => ({
		name: e.name,
		version: e.version,
		service: e.service,
		sourceFile: e.sourceFile,
	}));
}
