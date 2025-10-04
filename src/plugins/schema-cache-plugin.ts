/**
 * Vite Plugin: Schema Cache Builder
 *
 * Builds entity schema cache on dev server start and watches for changes
 */
import type { Plugin } from "vite";
import { buildAndWriteSchemaCache } from "../utils/build-schema-cache";
import chokidar from "chokidar";
import fg from "fast-glob";
import * as path from "node:path";

interface SchemaCachePluginOptions {
	entityConfigPaths: string[];
	tsconfigPath?: string;
	env?: Record<string, string>;
}

export function schemaCachePlugin(options: SchemaCachePluginOptions): Plugin {
	const { entityConfigPaths, tsconfigPath, env } = options;
	let watcher: chokidar.FSWatcher | null = null;
	let isBuilding = false;

	const buildSchema = async () => {
		if (isBuilding) return;
		isBuilding = true;

		try {
			await buildAndWriteSchemaCache(entityConfigPaths, tsconfigPath, env);
		} catch (error) {
			console.error("❌ Failed to build schema cache:", error);
		} finally {
			isBuilding = false;
		}
	};

	return {
		name: "electro-viewer:schema-cache",

		async buildStart() {
			// Build schema cache when Vite starts
			await buildSchema();
		},

		async configureServer(server) {
			// Build schema on server start
			await buildSchema();

			// Set up file watching for entity config files
			const projectRoot = process.env.ELECTRO_VIEWER_CWD || process.cwd();

			// Convert glob patterns to absolute paths for chokidar
			const patternsToWatch = entityConfigPaths.map(pattern =>
				path.isAbsolute(pattern) ? pattern : path.join(projectRoot, pattern)
			);

			console.log(`\n👀 Watching entity file patterns: ${entityConfigPaths.join(", ")}`);

			// Watch entity files using glob patterns
			// Chokidar supports glob patterns directly
			watcher = chokidar.watch(patternsToWatch, {
				persistent: true,
				ignoreInitial: true,
				cwd: projectRoot,
			});

			watcher.on("change", async (filePath) => {
				const relativePath = path.relative(projectRoot, filePath);
				console.log(`\n📝 Entity file changed: ${relativePath}`);
				await buildSchema();

				// Trigger HMR to reload
				server.ws.send({
					type: "full-reload",
					path: "*",
				});
			});

			watcher.on("add", async (filePath) => {
				const relativePath = path.relative(projectRoot, filePath);
				console.log(`\n➕ Entity file added: ${relativePath}`);
				await buildSchema();

				server.ws.send({
					type: "full-reload",
					path: "*",
				});
			});

			watcher.on("unlink", async (filePath) => {
				const relativePath = path.relative(projectRoot, filePath);
				console.log(`\n➖ Entity file removed: ${relativePath}`);
				await buildSchema();

				server.ws.send({
					type: "full-reload",
					path: "*",
				});
			});
		},

		async closeBundle() {
			// Close watcher when Vite shuts down
			if (watcher) {
				await watcher.close();
				watcher = null;
			}
		},
	};
}
