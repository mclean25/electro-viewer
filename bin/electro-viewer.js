#!/usr/bin/env node

import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { build } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the electro-viewer package root
const packageRoot = resolve(__dirname, '..');

// Parse CLI arguments
const args = process.argv.slice(2);
const configFlag = args.indexOf('--config');
const portFlag = args.indexOf('--port');

// Determine config file path
let configPath = 'electro-viewer-config.ts';
if (configFlag !== -1 && args[configFlag + 1]) {
  configPath = args[configFlag + 1];
}

// Resolve config path relative to current working directory
const resolvedConfigPath = resolve(process.cwd(), configPath);

// Check if config file exists
if (!existsSync(resolvedConfigPath)) {
  console.error(`❌ Config file not found: ${resolvedConfigPath}`);
  console.error('');
  console.error('Please create an electro-viewer-config.ts file in your project root, or specify one with --config');
  console.error('');
  console.error('Example config:');
  console.error('export const config = {');
  console.error('  profile: "your-aws-profile",');
  console.error('  region: "us-east-1",');
  console.error('  entityConfigPaths: ["./path/to/your/entities.ts"]');
  console.error('} as const;');
  process.exit(1);
}

// Determine port
let port = '3030';
if (portFlag !== -1 && args[portFlag + 1]) {
  port = args[portFlag + 1];
}

console.log('🚀 Starting Electro Viewer...');
console.log(`📁 Config: ${resolvedConfigPath}`);
console.log(`🌐 Port: ${port}`);
console.log('');

// Set environment variables for the viewer
process.env.ELECTRO_VIEWER_CONFIG_PATH = resolvedConfigPath;
process.env.ELECTRO_VIEWER_CWD = process.cwd();

// Load config using esbuild
let config;
const tempDir = mkdtempSync(join(tmpdir(), 'electro-viewer-config-'));
const outfile = join(tempDir, 'config.mjs');

try {
  // Bundle the config file with esbuild
  await build({
    entryPoints: [resolvedConfigPath],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    logLevel: 'error',
  });

  // Import the bundled config
  const configModule = await import(outfile);
  config = configModule.config;
} catch (error) {
  console.error('❌ Failed to load config:', error.message);
  process.exit(1);
} finally {
  // Clean up temp directory
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch (_err) {
    // Ignore cleanup errors
  }
}

// Build schema cache before starting server
try {
  // Import the schema cache builder from the built package
  const { buildAndWriteSchemaCache } = await import(join(packageRoot, 'dist', 'build-cache.js'));

  await buildAndWriteSchemaCache(
    config.entityConfigPaths,
    config.tsconfigPath,
    config.env
  );
} catch (error) {
  console.error('❌ Failed to build schema cache:', error.message);
  console.error(error.stack);
  process.exit(1);
}

// Path to the server runtime
const serverPath = join(packageRoot, 'server-runtime.js');

if (!existsSync(serverPath)) {
  console.error(`❌ Server runtime not found at: ${serverPath}`);
  console.error('The package may not be built correctly.');
  process.exit(1);
}

console.log('🚀 Starting server...');
console.log('');

// Start the server runtime
const serverProcess = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRO_VIEWER_CONFIG_PATH: resolvedConfigPath,
    ELECTRO_VIEWER_CONFIG: JSON.stringify(config), // Pass the loaded config as JSON
    ELECTRO_VIEWER_CWD: process.cwd(),
    PORT: port,
    HOST: '0.0.0.0',
    NODE_ENV: 'production'
  }
});

// Handle spawn errors
serverProcess.on('error', (err) => {
  console.error('❌ Failed to start server process:', err);
  process.exit(1);
});

// Server started successfully
serverProcess.on('spawn', () => {
  console.log(`✅ Server running at http://localhost:${port}`);
  console.log('');
  console.log('Press Ctrl+C to stop');
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down...');
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  serverProcess.kill('SIGTERM');
});

serverProcess.on('exit', (code, signal) => {
  if (code !== 0 && code !== null) {
    console.error(`\n❌ Server process exited with code ${code}`);
  }
  if (signal) {
    console.error(`\n❌ Server process killed with signal ${signal}`);
  }
  process.exit(code || 0);
});