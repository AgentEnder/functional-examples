---
generated: true
---

# Mixed Plugins

Demonstrates using multiple plugins together with path-based
conflict resolution via pathMappings configuration.
src/ files use JavaScript plugin, tutorials/ use YAML manifest.


# Mixed Plugins Example

This example demonstrates using multiple plugins together with conflict resolution via `pathMappings`.

## Usage

```bash
# Scan and display examples
npx functional-examples scan

# Output as JSON
npx functional-examples scan -f json
```

## The Problem

When both JavaScript and YAML manifest plugins are active, they may both try to claim the same files:

- JavaScript plugin claims any `.ts` file with frontmatter
- YAML manifest plugin claims any directory with `meta.yml`

If a TypeScript file is inside a directory with `meta.yml`, both plugins want it.

## The Solution: pathMappings

Use `pathMappings` in your config to specify which extractor wins for each path pattern:

```json
{
  "$schema": "./.functional-examples/schema.json",
  "scan": {
    "include": ["src/**/*", "tutorials/*"],
    "exclude": ["**/node_modules/**"]
  },
  "pathMappings": [
    {
      "pattern": "src/**",
      "extractor": "javascript-extractor"
    },
    {
      "pattern": "tutorials/**",
      "extractor": "meta-yml"
    }
  ]
}

```

## Project Structure

```
mixed-plugins/
├── src/                    # JavaScript plugin handles these
│   └── utils.ts            # Has frontmatter metadata
└── tutorials/              # YAML manifest plugin handles these
    └── hello-world/
        ├── meta.yml
        └── index.ts
```

## Extractor Names

- `javascript-extractor` — The JavaScript/TypeScript plugin
- `meta-yml` — The YAML manifest plugin

These names are defined by each plugin and used in `pathMappings`.


## `demo.sh`

### Region: `scan`

```bash
# Scan — plugins auto-detected, pathMappings resolve conflicts
npx functional-examples scan
```

### Region: `json`

```bash
# View detailed output showing which extractor claimed each example
npx functional-examples scan -f json
```

## `package.json`

```json
{
  "name": "@examples/mixed-plugins",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "description": "Demonstrates using multiple plugins together with path-based conflict resolution via pathMappings configuration",
  "dependencies": {
    "functional-examples": "workspace:*",
    "@functional-examples/javascript": "workspace:*",
    "@functional-examples/yaml-manifest": "workspace:*"
  },
  "functional-examples": {
    "title": "Mixed Plugins",
    "tags": ["plugin", "pathMappings", "conflict-resolution"]
  }
}

```

## `src/utils.ts`

### Region: `frontmatter`

```typescript
// ---
// id: mixed-utils
// title: Utility Functions
// description: Example using frontmatter in a mixed-plugin project
// ---
```

## `tutorials/hello-world/index.ts`

```typescript
/**
 * Hello World Tutorial
 *
 * This file is part of a YAML manifest example.
 * The metadata comes from meta.yml, not frontmatter.
 */

function main() {
  console.log('Hello from the tutorial!');
  console.log('This example uses meta.yml for metadata.');
}

main();

```

