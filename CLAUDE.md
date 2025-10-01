# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TanStack Start application intended to be installed as an npm dependency into user's projects who
are using ElectroDB. The goal is to read the user's ElectroDB (dyanamoDB package) entities and give them a helpful
interface to query them.

## Commands

- `pnpm dev` - Start development server on port 3000
- `pnpm build` - Build the application for production
- `npx biome check .` - Run linting and formatting checks
- `npx biome check --write .` - Auto-fix linting and formatting issues
- `npx tsc --noEmit` - Type check the TypeScript code

## Architecture

### Core Technologies
- **TanStack Start**: Full-stack React framework with server functions
- **TanStack React Router**: File-based routing with type-safe navigation
- **Vite**: Build tool and dev server
- **Biome**: Linting and formatting tool (replaces ESLint/Prettier)
- **TypeScript**: Type safety with strict null checks enabled

### Project Structure
- `/src/routes/`: File-based routing - each `.tsx` file becomes a route
  - `__root.tsx`: Root layout component wrapping all pages
  - `index.tsx`: Home route with server functions example
- `/src/router.tsx`: Router configuration
- `/src/routeTree.gen.ts`: Auto-generated route tree (do not edit manually)

### Key Patterns

**Server Functions**: Use `createServerFn` from `@tanstack/react-start` for server-side logic:
```typescript
const myServerFn = createServerFn({
  method: "GET" | "POST"
}).handler(async () => {
  // Server-only code here
});
```

**Route Loaders**: Data fetching happens in route loaders:
```typescript
export const Route = createFileRoute("/path")({
  loader: async () => await fetchData(),
  component: MyComponent,
});
```

**File-based Routing**: Files in `/src/routes/` automatically become routes:
- `index.tsx` → `/`
- `about.tsx` → `/about`
- `users/[id].tsx` → `/users/:id` (dynamic segments)

### TypeScript Path Alias Resolution

**Problem**: Users' ElectroDB entity files often use TypeScript path aliases (e.g., `@core/*`, `@domain/*`) defined in their project's `tsconfig.json`. These need to be resolved when loading entities.

**Solution**: `/src/utils/load-typescript.ts` uses `esbuild` to bundle user entity files with full path alias resolution.

**How it works**:
1. Loads `.env` file from user's project root (if exists)
2. Applies environment variables from config (`config.env`)
3. Uses `esbuild` to bundle the entities file:
   - Resolves TypeScript path aliases from user's `tsconfig.json`
   - Bundles all npm dependencies (date-fns, @aws-sdk/*, etc.)
   - Keeps Node.js built-ins external
   - Injects environment variables into the bundle
   - Outputs CommonJS to handle dynamic requires
4. Imports the bundled file using `createRequire`

**Dependencies**:
- `esbuild`: Bundles TypeScript with path alias resolution
- `dotenv`: Loads `.env` files from user's project

**Configuration options**:
- `tsconfigPath`: Path to user's tsconfig.json (defaults to `./tsconfig.json`)
- `env`: Environment variables to set when loading entities (e.g., `{ IS_PERMISSIONED_ENV: "false" }`)

**Important**: This package is installed globally and runs in users' projects. The loader must handle:
- Monorepo structures with multiple tsconfig files
- TypeScript path aliases
- Environment variables needed by entities
- Various module formats and dependencies

### Code Style
- 2 spaces indentation
- Line width limit: 88 characters
- Biome handles all formatting and linting
- Strict TypeScript with `strictNullChecks` enabled
