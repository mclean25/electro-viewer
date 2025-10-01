#!/usr/bin/env node

import { spawn } from 'child_process';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

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

// Start the Vite dev server with environment variables
const viteProcess = spawn('pnpm', [
  'dev',
  '--port', port,
  '--host', '0.0.0.0'
], {
  cwd: packageRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRO_VIEWER_CONFIG_PATH: resolvedConfigPath,
    ELECTRO_VIEWER_CWD: process.cwd()
  }
});

// Handle process termination
process.on('SIGINT', () => {
  viteProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  viteProcess.kill('SIGTERM');
});

viteProcess.on('exit', (code) => {
  process.exit(code);
});