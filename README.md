# Electro Viewer

> **⚠️ Under Development**: This package is currently under active development. Some bugs and breaking changes can be expected.

Electro Viewer is a tool to help you quickly browse your ElectroDB enties by reading the configuration
files in your project.

<img width="3466" height="2748" alt="CleanShot 2025-10-26 at 12 21 19@2x" src="https://github.com/user-attachments/assets/e61d503f-11a9-47e2-80b0-51dd59ea91f5" />

## Features

- 🔍 **Browse ElectroDB Entities** - Automatically discovers and displays your ElectroDB entity definitions
- 🎯 **Interactive Querying** - Build and execute queries with a visual interface
- 🔑 **Key Builder** - Helps construct partition and sort keys using ElectroDB's patterns
- 📊 **Entity Explorer** - View entity schemas, indexes, and attributes
- 🔐 **AWS SSO Support** - Works with AWS profiles and SSO authentication

## Roadmap

- [x] Read support
- [x] Add support
- [ ] Delete support
- [ ] Update support
- [ ] Custom Template String support
- [ ] Scan support
- [ ] Run arbitrary queries
- [ ] Query read units used statistics

## Installation

### Global Installation (Recommended)

```bash
pnpm link --global
```

Or in your project:

```bash
pnpm add -D electro-viewer
```

## Configuration

Create an `electro-viewer-config.ts` file in your project root:

```typescript
export const config = {
  // AWS profile name from ~/.aws/credentials or ~/.aws/config
  profile: "your-aws-profile",

  // AWS region (optional - uses profile's default if not specified)
  region: "us-east-1",

  // Paths or glob patterns to your ElectroDB entity files
  // Relative paths from your project root
  // Examples:
  //   ["./entities.ts"] - Single file
  //   ["./packages/*/entities.ts"] - Glob pattern
  //   ["./entities.ts", "./custom/*.ts"] - Mix of direct paths and globs
  entityConfigPaths: ["./path/to/your/entities.ts"],

  // Optional: Path to tsconfig.json (defaults to "./tsconfig.json")
  tsconfigPath: "./tsconfig.json",

  // Optional: Environment variables needed by your entities file
  env: {
    IS_PERMISSIONED_ENV: "false",
    NODE_ENV: "development",
  },
} as const;

export type ElectroViewerConfig = typeof config;
```

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `profile` | string | Yes | - | AWS profile name |
| `region` | string | No | Profile default | AWS region |
| `entityConfigPaths` | string[] | Yes | - | Paths or glob patterns to entity files |
| `tsconfigPath` | string | No | `"./tsconfig.json"` | Path to tsconfig.json |
| `env` | Record<string, string> | No | `{}` | Environment variables |

## Usage

### SST

If you're using [SST](https://sst.dev/), you can add a custom commmand to the multiplexer to
automatically start Electro Viewer when you run `sst start`:

```typescript
new sst.x.DevCommand("ElectroViewer", {
  link: [myTable],
  dev: {
    autostart: true,
    command: "pnpm electro-viewer",
  },
});
```

## How It Works

Electro Viewer reads your ElectroDB entities configuration files to understand the PK/SK structure
of your entities. When running, we'll use the AWS SDK along with the AWS CLI to query DynamoDB
to make it easier to query entities.

Make sure your AWS profile has permissions to:
- `dynamodb:Query`
- `dynamodb:GetItem`
- Access to the tables you want to query
