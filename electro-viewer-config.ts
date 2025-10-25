/**
 * Configuration for Electro Viewer
 *
 * Update these values to match your AWS environment and ElectroDB service
 */
export const config = {
  // AWS profile name to use for authentication
  // This should match a profile in your ~/.aws/credentials file
  profile: "playground",

  // AWS region (optional - will use profile's default if not specified)
  region: "us-west-1",

  // Paths or glob patterns to your ElectroDB entity files
  // Relative paths from your project root
  // Examples:
  //   ["./entities.ts"] - Single file
  //   ["./packages/*/entities.ts"] - Glob pattern
  //   ["./entities.ts", "./custom/*.ts"] - Mix of direct paths and globs
  entityConfigPaths: ["./test/dynamo/entities/*.ts"],

  // Optional: Path to tsconfig.json for resolving TypeScript path aliases
  // Relative path from your project root
  // If not specified, will look for tsconfig.json in the project root
  tsconfigPath: "./tsconfig.json",

  // Optional: Environment variables to set when loading the entities file
  // Useful for variables that your entities file depends on
  // Example: { NODE_ENV: "development" }
  env: {
    NODE_ENV: "development",
  },
} as const;

export type ElectroViewerConfig = typeof config;
