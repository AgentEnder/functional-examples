# Examples Reorganization Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorganize examples into self-contained projects that showcase different configurations of functional-examples.

**Architecture:** Each example is an independent mini-project with its own package.json, config, and source files. All examples are included in the pnpm workspace and depend on local workspace packages.

**Tech Stack:** pnpm workspaces, TypeScript, functional-examples tooling

---

## Project Structure

```
examples/
├── javascript-plugin/
│   ├── package.json
│   ├── functional-examples.config.ts
│   ├── README.md
│   └── src/
│       ├── getting-started.ts
│       └── utils.ts
│
├── yaml-manifest/
│   ├── package.json
│   ├── functional-examples.config.ts
│   ├── README.md
│   └── examples/
│       └── hello-world/
│           ├── meta.yml
│           └── index.ts
│
├── mixed-plugins/
│   ├── package.json
│   ├── functional-examples.config.ts
│   ├── README.md
│   └── src/...
│
├── metadata-validation/
│   ├── package.json
│   ├── functional-examples.config.ts
│   ├── README.md
│   └── src/...
│
└── custom-extractor/
    ├── package.json
    ├── functional-examples.config.ts
    ├── README.md
    ├── my-extractor.ts
    └── examples/...
```

## What Each Example Demonstrates

### javascript-plugin/
Shows frontmatter metadata and region extraction:
- Frontmatter with `id`, `title`, `description`, custom fields
- `#region`/`#endregion` markers for code snippets
- Config options: `skipFrontmatter`, `skipRegions`

### yaml-manifest/
Shows directory-based example organization:
- Each example in its own folder with `meta.yml`
- Multi-file examples with entryPoint specification
- When this approach is better than inline frontmatter

### mixed-plugins/
Shows both plugins coexisting:
- Some examples use frontmatter, others use meta.yml
- `pathMappings` config to resolve conflicts
- Conflict resolution strategy documentation

### metadata-validation/
Shows schema enforcement:
- Config with `metadata` JSON Schema requiring specific fields
- Examples that pass validation
- How validation errors appear

### custom-extractor/
Shows extensibility:
- Implements a simple custom extractor
- Registers alongside built-in plugins
- Documents the `Extractor` interface

## Workspace Integration

Root `pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/*'
  - 'examples/*'
```

Example package.json pattern:
```json
{
  "name": "@functional-examples/example-javascript-plugin",
  "private": true,
  "type": "module",
  "scripts": {
    "scan": "functional-examples scan .",
    "scan:json": "functional-examples scan . -f json"
  },
  "dependencies": {
    "functional-examples": "workspace:*",
    "@functional-examples/javascript": "workspace:*"
  }
}
```

## Migration

Existing content migration:
- `basic-usage/` → **yaml-manifest/** example
- `frontmatter-example/` → **javascript-plugin/** example
- `custom-extractor.ts` → **custom-extractor/** example
- Root config/package.json → removed

---

## Tasks

### Task 1: Update workspace configuration
**Files:**
- Modify: `pnpm-workspace.yaml`

Update to include examples in workspace:
```yaml
packages:
  - 'packages/*'
  - 'examples/*'
```

### Task 2: Create javascript-plugin example
**Files:**
- Create: `examples/javascript-plugin/package.json`
- Create: `examples/javascript-plugin/functional-examples.config.ts`
- Create: `examples/javascript-plugin/README.md`
- Create: `examples/javascript-plugin/src/getting-started.ts`
- Create: `examples/javascript-plugin/src/utils.ts`

Migrate content from `frontmatter-example/` and add region examples.

### Task 3: Create yaml-manifest example
**Files:**
- Create: `examples/yaml-manifest/package.json`
- Create: `examples/yaml-manifest/functional-examples.config.ts`
- Create: `examples/yaml-manifest/README.md`
- Create: `examples/yaml-manifest/examples/hello-world/meta.yml`
- Create: `examples/yaml-manifest/examples/hello-world/index.ts`

Migrate content from `basic-usage/`.

### Task 4: Create mixed-plugins example
**Files:**
- Create: `examples/mixed-plugins/package.json`
- Create: `examples/mixed-plugins/functional-examples.config.ts`
- Create: `examples/mixed-plugins/README.md`
- Create: `examples/mixed-plugins/src/` (frontmatter examples)
- Create: `examples/mixed-plugins/tutorials/` (yaml manifest examples)

Show pathMappings for conflict resolution.

### Task 5: Create metadata-validation example
**Files:**
- Create: `examples/metadata-validation/package.json`
- Create: `examples/metadata-validation/functional-examples.config.ts`
- Create: `examples/metadata-validation/README.md`
- Create: `examples/metadata-validation/src/` (examples with required fields)

Config requires `category` and `difficulty` fields.

### Task 6: Create custom-extractor example
**Files:**
- Create: `examples/custom-extractor/package.json`
- Create: `examples/custom-extractor/functional-examples.config.ts`
- Create: `examples/custom-extractor/README.md`
- Create: `examples/custom-extractor/my-extractor.ts`
- Create: `examples/custom-extractor/examples/`

Migrate and expand `custom-extractor.ts`.

### Task 7: Remove old examples structure
**Files:**
- Delete: `examples/basic-usage/`
- Delete: `examples/frontmatter-example/`
- Delete: `examples/custom-extractor.ts`
- Delete: `examples/functional-examples.config.ts`
- Delete: `examples/package.json`
- Delete: `examples/tsconfig.json`

### Task 8: Install and verify
**Steps:**
1. Run `pnpm install` to link workspace dependencies
2. Test each example: `pnpm --filter "@functional-examples/example-*" scan`
3. Verify all examples produce expected output

### Task 9: Commit changes
Commit the reorganized examples structure.
