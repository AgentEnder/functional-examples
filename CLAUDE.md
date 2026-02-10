# functional-examples

A toolkit for managing, scanning, and validating code examples in documentation projects.

## Monorepo Structure

```
packages/
  devkit/              → @functional-examples/devkit — shared types + utilities
  functional-examples/ → functional-examples — core scanner, config, CLI, typegen
  javascript/          → @functional-examples/javascript — JS/TS extractor plugin
  yaml-manifest/       → @functional-examples/yaml-manifest — meta.yml extractor plugin
  test/                → @functional-examples/test — test runner for examples
examples/              → Example projects demonstrating usage
e2e/                   → End-to-end tests
```

## Dependency Direction

```
devkit  ←  functional-examples (core)
  ↑              ↑
  |              |
  ├── javascript plugin
  ├── yaml-manifest plugin
  └── test runner
```

All plugins depend on `devkit` for types and shared utilities. The core package also depends on `devkit`. Plugins do NOT depend on each other.

## Devkit Sub-Entries

The devkit package provides shared utilities:

- **Types**: `Extractor`, `Plugin`, `Config`, `Example`, etc.
- **JSON parsing**: `parseJson`, `tryParseJson`, `JsonParseError`
- **Glob file matching**: `glob`, `isMatch`, `createMatcher`
- **YAML parsing**: `parseYaml`, `tryParseYaml`, `YamlParseError`

**Peer dep model:** Each sub-entry's underlying library (`tinyglobby`, `picomatch`, `yaml`, `jsonc-parser`, `json5`) is an **optional peer dependency** of devkit. Consumers that use a sub-entry must declare the required libs as direct dependencies in their own `package.json`. This way devkit can grow new sub-entries without forcing unused deps on existing consumers.

| Sub-entry | Required peer deps |
|-----------|-------------------|
| `devkit/glob` | `tinyglobby`, `picomatch` |
| `devkit/yaml` | `yaml` |
| `devkit/json` | none (JSON.parse built-in); `jsonc-parser` and/or `json5` for extended formats |

## Plugin Architecture

Plugins provide one or more of: **extractors**, **parsers**, **validators**, **schemas**, **commands**.

- **Extractor**: Receives `Dirent[]` candidates + options, returns `ExtractorResult` with examples, errors, and claimed files
- **FileContentsParser**: Transforms file content (e.g., strip frontmatter, parse metadata)
- **Validators**: Check example metadata against rules
- **Schemas**: JSON Schema definitions for plugin-specific metadata

## Catalog Management

Shared dependency versions are managed via `pnpm-workspace.yaml` catalog. Use `catalog:` in package.json to reference catalog versions.

## Commands

```bash
# Install dependencies
pnpm install

# Build a specific package
npx nx run @functional-examples/devkit:build

# Build everything
npx nx run-many -t build

# Test a specific package
npx nx run @functional-examples/devkit:test

# Test all packages
npx nx run-many -t test

# Lint
npx nx run-many -t lint
```

## Coding Conventions

- **ESM only** — all packages use `"type": "module"`
- **`.js` extension in imports** — TypeScript source uses `.js` extensions for ESM compatibility (e.g., `from './parse.js'`)
- **vitest** for testing — test files use `*.spec.ts` suffix
- **TypeScript strict mode** — all packages extend `tsconfig.base.json`
- **Nx** manages the build graph — respects `workspace:*` dependency links
- **Barrel exports** — each module has an `index.ts` that re-exports public API
