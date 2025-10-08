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

// Path to the built server
const serverPath = join(packageRoot, 'dist', 'server', 'server.js');

if (!existsSync(serverPath)) {
  console.error(`❌ Built server not found at: ${serverPath}`);
  console.error('The package may not be built correctly.');
  process.exit(1);
}

// Start the built server
const serverProcess = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRO_VIEWER_CONFIG_PATH: resolvedConfigPath,
    ELECTRO_VIEWER_CWD: process.cwd(),
    PORT: port,
    HOST: '0.0.0.0'
  }
});

// Handle process termination
process.on('SIGINT', () => {
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  serverProcess.kill('SIGTERM');
});

serverProcess.on('exit', (code) => {
  process.exit(code);
});