---
title: "Configuration"
description: "TypeScript vs JSON config, scan patterns, metadata schemas, and path mappings."
nav:
  order: 5
---

# Configuration

functional-examples is configured via a config file at your project root. This guide covers every config option, the two config formats, and how to use metadata schemas for validation.

## Config Formats

### TypeScript (recommended)

Create `functional-examples.config.ts`:

```typescript
import { createJavaScriptPlugin } from '@functional-examples/javascript';

export default {
  plugins: [createJavaScriptPlugin()],
  scan: {
    root: 'examples',
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
};
```

TypeScript configs can instantiate plugins directly and benefit from type checking and IDE autocompletion.

### JSON

Create `functional-examples.config.json`:

<%= example('json-config').file('functional-examples.config.json') %>

JSON configs are useful when you don't want a build step, work with non-JS tooling, or want machine-editable configuration. Plugins are auto-detected from your `package.json` dependencies.

## Scan Options

### `scan.root`

Base directory for scanning, relative to the config file. Defaults to the current directory.

```typescript
scan: {
  root: 'examples', // only scan under examples/
}
```

### `scan.include`

Glob patterns for files to include. If omitted, all files under the root are candidates.

```typescript
scan: {
  include: ['snippets/**/*', 'tutorials/**/*'],
}
```

### `scan.exclude`

Glob patterns for files to exclude. Always exclude `node_modules` and build artifacts:

```typescript
scan: {
  exclude: ['**/node_modules/**', '**/dist/**', '**/*.test.*'],
}
```

## Path Mappings

When using multiple plugins, **pathMappings** route specific file patterns to specific extractors. This prevents conflicts when two extractors might both try to claim the same file.

```typescript
pathMappings: [
  { pattern: 'src/**', extractor: 'javascript-extractor' },
  { pattern: 'tutorials/**', extractor: 'meta-yml' },
]
```

Each mapping has:
- **pattern** — a glob pattern matched against relative file paths
- **extractor** — the `extractorName` of the target extractor

Files matching a mapping are *only* sent to the specified extractor. Unmapped files are sent to all extractors.

## Metadata Schema

You can enforce metadata standards using a JSON Schema in your config. Every scanned example's metadata is validated against it:

<%= example('metadata-validation').file('functional-examples.config.json') %>

When an example's metadata doesn't match the schema, the scanner reports a validation error. Here's an example that passes validation:

<%= example('metadata-validation').file('src/valid-example.ts') %>

And one that fails because it's missing required fields:

<%= example('metadata-validation').file('src/missing-fields.ts') %>

## Config Resolution

When you call `scan()` or the CLI, functional-examples:

1. Walks up from the current directory looking for `functional-examples.config.ts` or `.json`
2. Loads the config (compiling TypeScript if needed)
3. Resolves plugin references (for JSON configs, auto-detects from dependencies)
4. Merges scan defaults with your overrides
5. Returns a fully resolved config ready for scanning

You can also pass a config object directly to `scanExamples()` for programmatic use.
