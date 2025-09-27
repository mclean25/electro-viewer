# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TanStack Start application using React Router for full-stack React development with server functions and file-based routing.

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

### Code Style
- 2 spaces indentation
- Line width limit: 88 characters
- Biome handles all formatting and linting
- Strict TypeScript with `strictNullChecks` enabled