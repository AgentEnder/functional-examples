---
generated: true
---

# YAML Manifest Plugin

Demonstrates using the yaml-manifest plugin to manage
multi-file examples with meta.yml metadata files.
Each example is a directory containing a meta.yml and source files.


# YAML Manifest Example

This example demonstrates the `@functional-examples/yaml-manifest` plugin, which organizes examples as directories with a `meta.yml` manifest file.

## Usage

```bash
# Scan and display examples
npx functional-examples scan

# Output as JSON
npx functional-examples scan -f json
```

## Directory Structure

```
examples/
├── basic-usage/
│   ├── meta.yml      # Required: metadata for this example
│   └── scan.ts       # Source file
└── multi-file/
    ├── meta.yml
    ├── main.ts       # Entry point
    └── utils.ts      # Additional files
```

## Configuration

The config file sets up the YAML manifest plugin:

```json
{
  "$schema": "./.functional-examples/schema.json",
  "scan": {
    "include": ["examples/**/*"],
    "exclude": ["**/node_modules/**", "**/dist/**"]
  }
}

```

## meta.yml Format

```yaml
id: my-example
title: My Example Title
description: |
  A longer description that can span
  multiple lines using YAML syntax.
tags:
  - beginner
  - tutorial
```

Required fields: `id`, `title`

## When to Use This Plugin

Choose YAML manifest over frontmatter when:

- **Multi-file examples** — Example spans multiple source files
- **Non-JS/TS files** — Python, Go, Rust, etc.
- **Clean source files** — No metadata comments in code
- **Complex metadata** — Easier to write in YAML than comment syntax


## `demo.sh`

### Region: `scan`

```bash
# Scan for examples — yaml-manifest plugin auto-detected from deps
npx functional-examples scan
```

### Region: `json`

```bash
# View detailed output as JSON
npx functional-examples scan -f json
```

## `package.json`

```json
{
  "name": "@examples/yaml-manifest",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "description": "Demonstrates using directory-based examples with separate meta.yml files for metadata, supporting multi-file examples",
  "dependencies": {
    "functional-examples": "workspace:*",
    "@functional-examples/yaml-manifest": "workspace:*"
  },
  "functional-examples": {
    "title": "YAML Manifest Plugin",
    "description": "Demonstrates using YAML manifests in examples",
    "tags": ["plugin", "yaml", "directory-based", "multi-file"]
  }
}

```

## `examples/basic-usage/scan.ts`

```typescript
/**
 * Basic example: Scanning for examples in a directory
 */
import { resolveConfig, scanExamples } from 'functional-examples';

async function main() {
  // Resolve config (auto-detects installed plugins)
  const config = await resolveConfig({
    root: process.cwd(),
  });

  // Scan for examples using resolved config
  const result = await scanExamples(config);

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

main().catch(console.error);

```

## `examples/multi-file/main.ts`

```typescript
/**
 * Entry point for the multi-file example
 */
import { greet } from './utils.js';

const message = greet('World');
console.log(message);

```

## `examples/multi-file/utils.ts`

```typescript
/**
 * Utility functions for the multi-file example
 */

export function greet(name: string): string {
  return `Hello, ${name}!`;
}

export function farewell(name: string): string {
  return `Goodbye, ${name}!`;
}

```

