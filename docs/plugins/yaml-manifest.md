---
title: "YAML Manifest Plugin"
description: "Discover multi-file examples using meta.yml manifest files with directory-based organization."
nav:
  order: 2
---

# YAML Manifest Plugin

The YAML manifest plugin (`@functional-examples/yaml-manifest`) discovers examples via `meta.yml` files in directories. Each directory containing a `meta.yml` becomes an example, with all sibling files automatically included.

## Installation

```bash
npm install @functional-examples/yaml-manifest
```

## How It Works

1. The extractor scans for directories containing a `meta.yml` file
2. It parses the YAML metadata (id, title, description, etc.)
3. All files in the directory (and subdirectories) become part of the example
4. Files can be filtered via the `include` field in `meta.yml`

## meta.yml Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier for the example |
| `title` | Yes | Human-readable title |
| `description` | No | What the example demonstrates |
| `tags` | No | Array of category tags |
| `include` | No | Glob patterns for files to include |
| `test` | No | Test definitions (see [Test Plugin](../test)) |
| `docs` | No | Documentation options (skip, outputName, etc.) |

### Example meta.yml

```yaml
id: basic-usage
title: Basic Usage
description: |
  Demonstrates scanning for examples in a directory
  using the functional-examples library.
tags:
  - getting-started
  - api
```

## Directory-Based Discovery

The plugin treats each directory with a `meta.yml` as a self-contained example:

```
examples/
  my-example/
    meta.yml          ← Metadata (required)
    main.ts           ← Source files (auto-discovered)
    utils.ts
    data.json
```

All files in the directory are collected unless filtered by `include` patterns. Common exclusions (node_modules, .git) are applied automatically.

## Multi-File Example Patterns

<%= example('yaml-manifest').file('examples/multi-file/main.ts') %>

The `include` field uses glob patterns to filter which files belong to the example. When omitted, all files in the directory are included.

## Configuration

The YAML manifest plugin requires minimal configuration — it's auto-detected when listed as a dependency:

```json
{
  "scan": {
    "include": ["examples/**/*"],
    "exclude": ["**/node_modules/**"]
  }
}
```

Or explicitly in TypeScript:

```typescript
import { createYamlManifestPlugin } from '@functional-examples/yaml-manifest';

export default {
  plugins: [createYamlManifestPlugin()],
  scan: {
    include: ['examples/**/*'],
  },
};
```

## When to Choose YAML Manifest vs JavaScript Plugin

| Scenario | Recommended Plugin |
|----------|-------------------|
| Single TypeScript/JavaScript files | JavaScript Plugin |
| Multi-file examples with mixed languages | YAML Manifest |
| Metadata co-located with code | JavaScript Plugin |
| Metadata separate from source | YAML Manifest |
| Non-JS/TS files (Python, Go, Rust) | YAML Manifest |
| Auto entry-point tracing | JavaScript Plugin |

You can use both plugins together with [path mappings](../guides/../configuration) to handle different directories.

**See also:** [JavaScript Plugin](../javascript) for frontmatter-based extraction, [Mixed Plugins example](../../examples/mixed-plugins) for combining extractors.
