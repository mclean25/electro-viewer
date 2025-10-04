import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { schemaCachePlugin } from "./src/plugins/schema-cache-plugin";
import * as path from "node:path";
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Load electro-viewer config using esbuild
const getConfig = async () => {
  const configPath = process.env.ELECTRO_VIEWER_CONFIG_PATH ||
    path.resolve(process.cwd(), "electro-viewer-config.ts");

  // Create a temporary directory for the bundle
  const tempDir = mkdtempSync(join(tmpdir(), "electro-viewer-config-"));
  const outfile = join(tempDir, "config.mjs");

  try {
    // Bundle the config file with esbuild
    await build({
      entryPoints: [configPath],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile,
      logLevel: "error",
    });

    // Import the bundled config
    const configModule = await import(outfile);
    return configModule.config;
  } finally {
    // Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  }
};

export default defineConfig(async () => {
  const config = await getConfig();

  return {
    server: {
      port: 3000,
    },
    plugins: [
      // Build entity schema cache on startup and watch for changes
      schemaCachePlugin({
        entityConfigPaths: config.entityConfigPaths,
        tsconfigPath: config.tsconfigPath,
        env: config.env,
      }),
      tsConfigPaths(),
      tailwindcss(),
      tanstackStart({ customViteReactPlugin: true }),
      viteReact(),
    ],
  };
});
