---
generated: true
---

# JSON Configuration

Shows how to use a JSON configuration file for declarative setup. JSON configs support auto-detected plugins, scan patterns, path mappings, and metadata validation via JSON Schema.


# JSON Configuration Example

This example demonstrates using a JSON configuration file (`functional-examples.config.json`) instead of TypeScript for declarative setup.

## Usage

```bash
# From the example directory
npx functional-examples scan
```

## Configuration File

The JSON config supports plugins, scan patterns, path mappings, and metadata schemas:

```json
{
  "$schema": "./.functional-examples/schema.json",
  "scan": {
    "include": ["snippets/**/*"],
    "exclude": ["**/*.test.*", "**/*.spec.*"]
  },
  "pathMappings": [
    {
      "pattern": "**/legacy/**",
      "extractor": "meta-yml"
    }
  ],
  "metadata": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "description": "Unique identifier for the example"
      },
      "title": {
        "type": "string",
        "description": "Human-readable title"
      },
      "description": {
        "type": "string",
        "description": "What this example demonstrates"
      },
      "category": {
        "type": "string",
        "enum": ["tutorial", "recipe", "reference", "advanced"],
        "description": "Example category for filtering"
      },
      "tags": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Tags for search and filtering"
      }
    },
    "required": ["id", "title", "category"]
  }
}

```

## Features

JSON configuration supports:
- **Auto-detected plugins** — Plugins are resolved automatically
- **Scan patterns** — Include/exclude patterns for file discovery
- **Path mappings** — Conflict resolution for multiple plugins
- **JSON Schema validation** — Metadata schema enforcement with IDE support

## When to Use JSON Config

Choose JSON over TypeScript configuration when:
- **No custom logic needed** — Simple declarative setup
- **Non-JS tooling** — Other tools can easily read JSON
- **Schema validation** — IDE support via JSON Schema


## `demo.sh`

### Region: `scan`

```bash
# Default scan output
npx functional-examples scan
```

### Region: `json`

```bash
# JSON output format
npx functional-examples scan -f json
```

### Region: `yaml`

```bash
# YAML output format
npx functional-examples scan -f yaml
```

## `package.json`

```json
{
  "name": "@examples/json-config",
  "private": true,
  "type": "module",
  "description": "Shows how to use a JSON configuration file for declarative setup with auto-detected plugins, scan patterns, path mappings, and metadata validation via JSON Schema",
  "files": [
    "functional-examples.config.json",
    "snippets/**/*.ts"
  ],
  "functional-examples": {
    "title": "JSON Configuration",
    "tags": [
      "configuration",
      "json",
      "schema-validation"
    ]
  }
}

```

## `snippets/advanced-usage/index.ts`

```typescript
/**
 * Advanced usage example
 */
export async function* paginate<T>(
  fetcher: (page: number) => Promise<T[]>
): AsyncGenerator<T> {
  let page = 0;
  while (true) {
    const items = await fetcher(page++);
    if (items.length === 0) break;
    yield* items;
  }
}

```

## `snippets/getting-started/index.ts`

```typescript
/**
 * Getting started example
 */
export function hello(name: string): string {
  return `Hello, ${name}!`;
}

```

