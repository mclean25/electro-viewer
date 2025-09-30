/**
 * Configuration for Electro Viewer
 *
 * Update these values to match your AWS environment and ElectroDB service
 */
export const config = {
	// AWS profile name to use for authentication
	// This should match a profile in your ~/.aws/credentials file
	profile: "main",


	// AWS region (optional - will use profile's default if not specified)
	region: "us-east-1",

	// Path to your ElectroDB service configuration file
	// Relative path from your project root
	// The file should export your ElectroDB entity instances
	serviceConfigPath: "./test/dynamo/service.ts",

	// Optional: Path to tsconfig.json for resolving TypeScript path aliases
	// Relative path from your project root
	// If not specified, will look for tsconfig.json in the project root
	tsconfigPath: "./tsconfig.json",

	// Optional: Environment variables to set when loading the entities file
	// Useful for variables that your entities file depends on
	// Example: { IS_PERMISSIONED_ENV: "false", NODE_ENV: "development" }
	env: {},
} as const;

export type ElectroViewerConfig = typeof config;
