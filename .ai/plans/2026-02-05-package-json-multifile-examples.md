# Package.json Multi-File Examples Design

**Date:** 2026-02-05
**Status:** Approved

## Overview

Enhance the `@functional-examples/javascript` plugin to support multi-file examples detected via `package.json` files. This enables examples to represent "whole" projects with proper dependency management.

## Metadata Extraction

When the JavaScript extractor receives a **directory candidate**, it checks for a `package.json` with the following metadata derivation:

| `package.json` field | Example metadata field | Notes |
|---------------------|----------------------|-------|
| `name` | `id` | Scope stripped (e.g., `@examples/foo` → `foo`) |
| `name` | `title` | Fallback if no explicit title |
| `description` | `description` | Direct mapping |
| `keywords` | `tags` | Array mapping |
| `functional-examples.title` | `title` | Override |
| `functional-examples.*` | `metadata` | Spread remaining fields |

**Validation:**
- `package.json` must exist and be valid JSON
- `name` field required (becomes `id`)
- `functional-examples` is optional; its fields override/extend defaults

**Example:**
```json
{
  "name": "@examples/getting-started",
  "description": "A basic walkthrough",
  "keywords": ["beginner"],
  "main": "./src/index.ts",
  "functional-examples": {
    "title": "Getting Started Guide",
    "difficulty": "easy"
  }
}
```

**Result:**
```javascript
{
  id: "getting-started",
  title: "Getting Started Guide",
  description: "A basic walkthrough",
  tags: ["beginner"],
  metadata: { difficulty: "easy" }
}
```

## File Collection Strategy

Files are collected by **aggregating multiple sources** (not fallbacks):

### Sources

1. **Dependency tracing** - Use `dependency-tree` to trace imports from:
   - `main` field
   - `module` field
   - `exports` field values (recursively extract paths from export map)
   - `types` field

2. **Explicit `files` array** - Include any globs/paths listed

3. **Always included:**
   - `package.json` itself
   - `README.md` / `README` (if present)

### Example

```json
{
  "name": "my-example",
  "main": "./src/index.ts",
  "files": ["assets/**"],
  "exports": {
    ".": "./src/index.ts",
    "./utils": "./src/utils.ts"
  }
}
```

If `src/index.ts` imports `src/helper.ts`, collected files:
```
package.json          (always)
README.md             (always, if exists)
src/index.ts          (from main + exports)
src/helper.ts         (traced dependency)
src/utils.ts          (from exports)
assets/**             (from files array)
```

### Ignored

- `node_modules/`
- `dist/`, `build/` (output directories)
- Common config files unless in `files` array

## Parsing & Metadata Stripping

### Package.json

The `functional-examples` key is stripped from parsed content:

```javascript
// Raw (on disk)
{
  "name": "@examples/getting-started",
  "main": "./src/index.ts",
  "functional-examples": { "title": "Getting Started Guide" }
}

// Parsed (in example output)
{
  "name": "@examples/getting-started",
  "main": "./src/index.ts"
}
```

### Source Files

- Frontmatter in individual files is **stripped but not extracted** as separate examples
- Package.json metadata takes precedence
- Region markers (`#region`/`#endregion`) still work for extracting code hunks

## Directory Restructuring

### Current Structure

```
examples/
├── package.json                    # Dependencies, scripts
├── functional-examples.config.ts   # Config
├── tsconfig.json
└── src/
    ├── basic-usage/
    ├── javascript-plugin/
    └── ...
```

### New Structure

```
functional-examples.config.ts       # Moved to repo root
examples/
├── project.json                    # Nx config only (targets, tags)
├── tsconfig.json                   # Kept for IDE support
├── basic-usage/
│   ├── package.json                # Example deps + functional-examples metadata
│   ├── README.md
│   └── src/
├── javascript-plugin/
│   ├── package.json
│   └── src/
└── ...
```

### Changes

- `functional-examples.config.ts` → repo root
- `examples/package.json` → deleted (deps move to root workspace or individual examples)
- `examples/src/*` → `examples/*` (flatten one level)
- Each example gets its own `package.json` with `functional-examples` key
- `examples/project.json` for Nx (no dependencies, just project config)

### Root Config

```typescript
// /functional-examples.config.ts
import { createJavaScriptPlugin } from '@functional-examples/javascript';

export default {
  plugins: [createJavaScriptPlugin()]
  // scan.include defaults to examples/* automatically
};
```

## Implementation Details

### New Dependency

```json
{
  "dependencies": {
    "dependency-tree": "^10.x"
  }
}
```

### Exports Field Parsing

Handle various export map formats:

```javascript
// String
"exports": "./index.js"

// Object with conditions
"exports": {
  ".": { "import": "./index.mjs", "require": "./index.cjs" },
  "./utils": "./utils.js"
}
```

Extract all file paths from nested structure.

### Edge Cases

1. **No entry points defined** - If no `main`/`module`/`exports`, fall back to `files` array only. If no `files` either, error with "No files could be determined for example"

2. **Circular dependencies** - `dependency-tree` handles this; collect unique set

3. **External dependencies** - Only trace files within the example directory; stop at `node_modules` imports

4. **`package.json` as direct candidate** - Resolve to parent directory and treat as multi-file example

5. **Missing `README.md`** - Not an error, just not included

## Summary

This design enables the JavaScript plugin to support "whole project" examples by:
- Detecting `package.json` in directory candidates
- Deriving metadata from standard npm fields + `functional-examples` key
- Collecting files via dependency tracing + explicit `files` array
- Stripping metadata from output (like frontmatter stripping)
- Restructuring examples directory to use this pattern
