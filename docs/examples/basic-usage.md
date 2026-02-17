---
generated: true
---

# Getting Started

Minimal setup demonstrating CLI usage and simple programmatic scanning.
This is the first example new users should explore.


# Getting Started

This example demonstrates the most basic use case: scanning for examples using the CLI and programmatic API.

## CLI Usage

```bash
# Scan for examples
functional-examples scan

# Output as JSON
functional-examples scan -f json
```

## Programmatic Usage

The `scan.ts` file demonstrates the simplest programmatic entry point:

```bash
# Scan for examples and display results
npx functional-examples scan
```

The `scan()` function auto-discovers your config file and installed plugins, then returns:
- `examples` — Array of extracted examples
- `errors` — Array of any errors encountered during scanning
- `stats` — Timing and count information

## Key Concepts

### JSON Configuration

This example uses a JSON config (`functional-examples.config.json`) which is the simplest way to configure scanning. Plugins are auto-detected from your `package.json` dependencies.

### `scan()`

The convenience function wraps config discovery, loading, resolution, and scanning in a single call. For most use cases, this is all you need.


## `functional-examples.config.json`

```json
{
  "$schema": "./.functional-examples/schema.json",
  "scan": {
    "include": ["examples/**/*"],
    "exclude": ["**/node_modules/**"]
  }
}

```

## `package.json`

```json
{
  "name": "@examples/basic-usage",
  "private": true,
  "type": "module",
  "description": "Getting started with functional-examples — CLI and programmatic scanning",
  "main": "./scan.ts",
  "dependencies": {
    "functional-examples": "workspace:*",
    "@functional-examples/yaml-manifest": "workspace:*"
  },
  "functional-examples": {
    "title": "Getting Started",
    "tags": ["beginner", "scanning", "getting-started"]
  }
}

```

## `scan.ts`

### Region: `scan`

```typescript
async function main() {
  // scan() auto-discovers config and plugins
  const result = await scan();

  console.log(`Found ${result.examples.length} examples:`);
  for (const example of result.examples) {
    console.log(`  - ${example.title} (${example.id})`);
  }

  if (result.errors.length > 0) {
    console.log(`\n${result.errors.length} errors occurred:`);
    for (const error of result.errors) {
      console.log(`  - ${error.path}: ${error.message}`);
    }
  }
}
```

## `tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"],
    "noEmit": true
  },
  "include": ["*.ts"]
}

```

