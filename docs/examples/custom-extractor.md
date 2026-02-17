---
generated: true
---

# Custom Extractor

Demonstrates creating a custom Extractor implementation to support
alternative metadata formats like TOML. Advanced usage requiring
a TypeScript config with inline plugin code.


# Custom Extractor Example

This example demonstrates how to create your own custom extractor for file formats not covered by built-in plugins.

## Usage

```bash
# Scan using the custom TOML extractor
npx tsx scan.ts
```

## The Extractor

The `createTomlExtractor` function implements the full extractor interface — scanning for `meta.toml` files, parsing metadata, and claiming files:

```typescript
export function createTomlExtractor(): Extractor<TomlMetadata> {
  return {
    name: 'toml-extractor',

    async extract(
      candidates: Dirent[]
    ): Promise<ExtractorResult<TomlMetadata>> {
      const examples: Example<TomlMetadata>[] = [];
      const claimedFiles = new Set<string>();
      const errors: { path: string; message: string }[] = [];

      // Find meta.toml files from candidates
      const tomlFiles: string[] = [];

      for (const candidate of candidates) {
        const fullPath = path.join(candidate.parentPath, candidate.name);

        if (candidate.isFile()) {
          // Direct file candidate: check if it's a meta.toml
          if (candidate.name === 'meta.toml') {
            tomlFiles.push(fullPath);
          }
        } else if (candidate.isDirectory()) {
          // Directory candidate: look for meta.toml inside
          const metaPath = path.join(fullPath, 'meta.toml');
          try {
            await readFile(metaPath, 'utf-8');
            tomlFiles.push(metaPath);
          } catch {
            // No meta.toml in this directory, skip
          }
        }
      }

      for (const tomlFile of tomlFiles) {
        try {
          const content = await readFile(tomlFile, 'utf-8');
          const metadata = parseSimpleToml(content);

          const exampleDir = path.dirname(tomlFile);

          // Collect all files in the example directory
          const files = collectExampleFiles(exampleDir);

          // Claim all files
          for (const file of files) {
            claimedFiles.add(file);
          }

          examples.push({
            id: metadata.id,
            title: metadata.title,
            description: metadata.description,
            rootPath: exampleDir,
            files: files.map((f) => ({
              absolutePath: f,
              relativePath: path.relative(exampleDir, f),
            })),
            metadata,
            extractorName: 'toml-extractor',
          });
        } catch (err) {
          errors.push({
            path: tomlFile,
            message: `Failed to parse: ${(err as Error).message}`,
          });
        }
      }

      return { examples, errors, claimedFiles };
    },
  };
}
```

## Key Concepts

### Tree-Scan Pattern

Extractors implement the "tree-scan" pattern:
- Called once with candidate `Dirent[]` entries
- Return ALL examples found in those candidates
- Claim files they've processed via `claimedFiles`

### Claimed Files

The `claimedFiles` set tells the scanner which files this extractor owns. This is used for:
- Conflict detection (multiple extractors claiming same file)
- Path-based conflict resolution

### Example Shape

Each example must have:
- `id` — Unique identifier
- `title` — Display name
- `rootPath` — Base directory
- `files` — Array of file info
- `metadata` — Your custom metadata type
- `extractorName` — Your extractor's name

## When to Create a Custom Extractor

- Unique metadata format (TOML, INI, custom JSON schema)
- Special directory structures
- Language-specific conventions
- Integration with other tools


## `config-as-plugin.ts`

### Region: `plugin-config`

```typescript
import type { Plugin } from 'functional-examples';
import { createTomlExtractor } from './toml-extractor.js';

const tomlPlugin: Plugin = {
  name: 'toml',
  extensions: ['.toml'],
  extractor: createTomlExtractor(),
};

export default {
  plugins: [tomlPlugin],
  scan: { include: ['examples/**/*'] },
};
```

## `demo.sh`

### Region: `scan`

```bash
# Run the custom scan script
npx tsx scan.ts
```

### Region: `json`

```bash
# Output as JSON
npx tsx scan.ts --json
```

## `package.json`

```json
{
  "name": "@examples/custom-extractor",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "description": "Demonstrates creating a custom Extractor implementation to support alternative metadata formats like TOML",
  "main": "./scan.ts",
  "dependencies": {
    "functional-examples": "workspace:*"
  },
  "devDependencies": {
    "tsx": "catalog:"
  },
  "functional-examples": {
    "title": "Custom Extractor",
    "tags": ["custom", "extractor", "toml", "advanced"]
  }
}

```

## `scan.ts`

```typescript
/**
 * Scan script using the custom TOML extractor.
 */
import { scan } from 'functional-examples';
import { resolveConfig } from 'functional-examples';
import { createTomlExtractor } from './toml-extractor.js';

async function main() {
  const jsonOutput = process.argv.includes('--json');

  const config = await resolveConfig({
    root: '.',
    plugins: [
      {
        name: 'toml-extractor',
        extractor: createTomlExtractor(),
      },
    ],
    scan: {
      include: ['**/*'],
      exclude: ['**/node_modules/**'],
    },
  });

  const result = await scan({ config });

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          examples: result.examples.map((e) => ({
            id: e.id,
            title: e.title,
            description: e.description,
            files: e.files.map((f) => f.relativePath),
            metadata: e.metadata,
          })),
          errors: result.errors,
          stats: result.stats,
        },
        null,
        2
      )
    );
  } else {
    console.log(`Found ${result.examples.length} TOML example(s):\n`);
    for (const example of result.examples) {
      console.log(`  ${example.id}: ${example.title}`);
      if (example.description) {
        console.log(`    ${example.description}`);
      }
      console.log(
        `    Files: ${example.files.map((f) => f.relativePath).join(', ')}`
      );
      console.log();
    }

    if (result.errors.length > 0) {
      console.log(`Errors (${result.errors.length}):`);
      for (const error of result.errors) {
        console.log(`  - ${error.path}: ${error.message}`);
      }
    }
  }
}

main().catch(console.error);

```

## `examples/hello-toml/index.ts`

```typescript
/**
 * Example file discovered by the custom TOML extractor.
 *
 * The metadata for this example comes from meta.toml,
 * not from frontmatter comments.
 */

export function hello(): string {
  return 'Hello from a TOML-based example!';
}

console.log(hello());

```

## `examples/hello-toml/meta.toml`

```toml
id = "hello-toml"
title = "Hello TOML"
description = "An example using TOML metadata"
author = "Example Author"

```

