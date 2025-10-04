# Electro Viewer

Electro Viewer is a tool to help you quickly browse your ElectroDB enties by reading the configuration
files in your project.

## Features

- 🔍 **Browse ElectroDB Entities** - Automatically discovers and displays your ElectroDB entity definitions
- 🎯 **Interactive Querying** - Build and execute queries with a visual interface
- 🔑 **Key Builder** - Helps construct partition and sort keys using ElectroDB's patterns
- 📊 **Entity Explorer** - View entity schemas, indexes, and attributes
- 🔐 **AWS SSO Support** - Works with AWS profiles and SSO authentication

## Roadmap

- [x] Read support
- [ ] Delete Support
- [ ] Edit support
- [ ] Add support
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

  // Path to your ElectroDB entities file (relative to project root)
  serviceConfigPath: "./path/to/your/entities.ts",

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

## Usage

From your project directory:

```bash
electro-viewer
```

Or with a custom config:

```bash
electro-viewer --config ./custom-config.ts
```

Or with a custom port:

```bash
electro-viewer --port 4000
```

The viewer will start at `http://localhost:3030` (or your specified port).

## How It Works

Electro Viewer reads your ElectroDB entities configuration files to understand the PK/SK structure
of your entities. When running, we'll use the AWS SDK along with the AWS CLI to query DynamoDB
to make it easier to query entities.

Make sure your AWS profile has permissions to:
- `dynamodb:Query`
- `dynamodb:GetItem`
- Access to the tables you want to query

## Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `profile` | string | Yes | - | AWS profile name |
| `region` | string | No | Profile default | AWS region |
| `serviceConfigPath` | string | Yes | - | Path to entities file |
| `tsconfigPath` | string | No | `"./tsconfig.json"` | Path to tsconfig.json |
| `env` | Record<string, string> | No | `{}` | Environment variables |

## Troubleshooting

### "Cannot find module '@core/...'"

Add the missing path alias to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@core/*": ["packages/core/*"]
    }
  }
}
```

### "Variable X is undefined"

Add the required environment variable to your config:

```typescript
export const config = {
  // ... other config
  env: {
    X: "value",
  },
};
```

Or add it to your `.env` file.

### "Could not find service config file"

Make sure `serviceConfigPath` points to the correct file relative to your project root.

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Lint and format
npx biome check --write .

# Type check
npx tsc --noEmit
```

## License

ISC
