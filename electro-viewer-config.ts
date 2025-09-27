/**
 * Configuration for Electro Viewer
 *
 * Update these values to match your AWS environment and DynamoDB table
 */
export const config = {
  // AWS profile name to use for authentication
  // This should match a profile in your ~/.aws/credentials file
  profile: "main",

  // DynamoDB table name to query
  // This should be the name of your ElectroDB single-table
  table: "alex-app-main",

  // AWS region (optional - will use profile's default if not specified)
  region: "us-east-1",
} as const;

export type ElectroViewerConfig = typeof config;

