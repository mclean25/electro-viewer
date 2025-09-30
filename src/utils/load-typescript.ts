/**
 * Loads a TypeScript file with path alias resolution using esbuild
 *
 * This utility bundles the TypeScript file with all dependencies resolved,
 * then imports the bundle. This ensures path aliases are properly handled.
 */
import { build } from "esbuild";
import { resolve, dirname } from "node:path";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config as loadDotenv } from "dotenv";

export async function loadTypeScriptFile(
	filePath: string,
	tsconfigPath?: string,
	configEnv?: Record<string, string>,
): Promise<any> {
	// Use the project root (where electro-viewer was invoked from)
	const projectRoot = process.env.ELECTRO_VIEWER_CWD || process.cwd();

	// Resolve tsconfig path relative to project root
	const tsconfig = tsconfigPath
		? resolve(projectRoot, tsconfigPath)
		: resolve(projectRoot, "tsconfig.json");

	console.log("Using tsconfig.json from:", tsconfig);
	console.log("Project root:", projectRoot);
	console.log("Loading file:", filePath);

	// Apply environment variables from config first
	if (configEnv && Object.keys(configEnv).length > 0) {
		console.log("Applying env variables from config:", Object.keys(configEnv));
		for (const [key, value] of Object.entries(configEnv)) {
			process.env[key] = value;
		}
	}

	// Load .env file from project root if it exists
	const envPath = resolve(projectRoot, ".env");
	if (existsSync(envPath)) {
		console.log("Loading .env from:", envPath);
		loadDotenv({ path: envPath });
	} else {
		console.log("No .env file found at:", envPath);
	}

	// Create a temporary directory for the bundle
	const tempDir = mkdtempSync(join(tmpdir(), "electro-viewer-"));
	const outfile = join(tempDir, "bundle.mjs");

	try {
		// Bundle the file with esbuild, which will resolve path aliases from tsconfig
		// Use CommonJS format to handle dynamic requires
		const cjsOutfile = join(tempDir, "bundle.cjs");

		// Create define object for environment variables
		// This replaces process.env.VAR references with actual values or undefined
		const define: Record<string, string> = {};
		for (const [key, value] of Object.entries(process.env)) {
			if (value !== undefined) {
				define[`process.env.${key}`] = JSON.stringify(value);
			}
		}

		await build({
			entryPoints: [filePath],
			bundle: true,
			platform: "node",
			format: "cjs",
			outfile: cjsOutfile,
			tsconfig,
			logLevel: "warning",
			// Set the working directory so relative imports resolve correctly
			absWorkingDir: projectRoot,
			// Keep Node.js built-ins external
			external: [
				"node:*",
				"fs",
				"path",
				"crypto",
				"http",
				"https",
				"stream",
				"url",
				"util",
				"zlib",
				"buffer",
				"events",
				"os",
				"child_process",
			],
			// Inject environment variables into the bundle
			define,
		});

		// Import the CommonJS bundle
		const { createRequire } = await import("node:module");
		const require = createRequire(import.meta.url);
		const module = require(cjsOutfile);
		return module;
	} finally {
		// Clean up the temporary directory
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch (err) {
			console.warn("Failed to clean up temp directory:", err);
		}
	}
}