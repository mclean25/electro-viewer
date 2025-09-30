/**
 * Loads a TypeScript file with path alias resolution using tsx and tsconfig-paths
 *
 * This utility automatically:
 * - Transpiles TypeScript on-the-fly
 * - Reads the tsconfig.json from the specified path or project root
 * - Resolves path aliases defined in tsconfig.json paths
 * - Works with both ESM and CommonJS
 */
import { register } from "tsx/esm/api";
import { register as registerPaths } from "tsconfig-paths";
import { resolve, dirname } from "node:path";
import { readFileSync } from "node:fs";

export async function loadTypeScriptFile(
	filePath: string,
	tsconfigPath?: string,
): Promise<any> {
	// Use the project root (where electro-viewer was invoked from)
	// This is important for monorepos where the root tsconfig.json contains the path aliases
	const projectRoot = process.env.ELECTRO_VIEWER_CWD || process.cwd();

	// Resolve tsconfig path relative to project root
	const tsconfig = tsconfigPath
		? resolve(projectRoot, tsconfigPath)
		: resolve(projectRoot, "tsconfig.json");

	console.log("Using tsconfig.json from:", tsconfig);
	console.log("Project root:", projectRoot);

	// Read and parse the tsconfig to get the path mappings
	const tsconfigContent = JSON.parse(readFileSync(tsconfig, "utf-8"));
	const baseUrl = tsconfigContent.compilerOptions?.baseUrl || ".";
	const paths = tsconfigContent.compilerOptions?.paths || {};

	console.log("TypeScript paths:", paths);
	console.log("Base URL:", baseUrl);

	// Register tsconfig-paths to resolve path aliases
	const pathsCleanup = registerPaths({
		baseUrl: resolve(dirname(tsconfig), baseUrl),
		paths,
	});

	// Register tsx for TypeScript transpilation
	const unregister = register({
		namespace: projectRoot,
		tsconfig,
	});

	try {
		const module = await import(/* @vite-ignore */ filePath);
		return module;
	} finally {
		unregister();
		pathsCleanup();
	}
}