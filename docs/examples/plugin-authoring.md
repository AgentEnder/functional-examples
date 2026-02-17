---
generated: true
---

# Plugin Authoring

Demonstrates building a custom plugin from scratch that supports
INI-based metadata. Implements the full Plugin interface with
name, extensions, extractor, and fileContentsParsers.


# Plugin Authoring

Demonstrates building a custom plugin from scratch that supports INI-based metadata.

## What This Shows

- Implementing the full `Plugin` interface (name, extensions, extractor, fileContentsParsers)
- Creating a custom `Extractor` that discovers `meta.ini` files
- Creating a `FileContentsParser` that strips INI comments
- Registering the plugin in a TypeScript config file

## Running

```bash
# Scan for examples using the custom INI plugin
bash demo.sh
```

## Plugin Structure

The INI plugin (`src/ini-plugin.ts`) provides:

1. **Extractor** — scans for `meta.ini` files, parses INI key=value pairs, returns `Example` objects
2. **FileContentsParser** — strips INI comments (`;` and `#` lines) from `.ini` files
3. **Plugin** — bundles the extractor and parser with a name and extensions list


## `demo.sh`

### Region: `scan`

```bash
# Scan using the custom INI plugin — registered in functional-examples.config.ts
npx functional-examples scan
```

## `functional-examples.config.ts`

```typescript
import type { Config } from 'functional-examples';
import { createIniPlugin } from './src/ini-plugin.js';

/**
 * Configuration demonstrating a custom INI plugin.
 *
 * The INI plugin provides:
 * - An extractor that discovers `meta.ini` files
 * - A parser that strips INI comments from content
 */
const config: Config = {
  plugins: [createIniPlugin()],
  scan: {
    include: ['src/**/*'],
    exclude: ['**/node_modules/**'],
  },
};

export default config;

```

## `package.json`

```json
{
  "name": "@examples/plugin-authoring",
  "private": true,
  "type": "module",
  "description": "Demonstrates building a custom plugin from scratch with INI metadata",
  "dependencies": {
    "functional-examples": "workspace:*"
  },
  "devDependencies": {
    "tsx": "catalog:"
  },
  "functional-examples": {
    "title": "Plugin Authoring",
    "tags": ["advanced", "plugins", "authoring"]
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
  "include": ["*.ts", "src/**/*.ts"]
}

```

## `src/extension-points.ts`

### Region: `schemas`

```typescript
const schemas = {
  options: {
    /* JSON Schema for plugin options */
  },
  metadata: {
    /* JSON Schema for metadata fields */
  },
};
```

### Region: `validators`

```typescript
const validators = {
  validateOptions(_options: unknown) {
    return { success: true, errors: [] as string[] };
  },
  validateMetadata(_metadata: unknown) {
    return { success: true, errors: [] as string[] };
  },
};
```

### Region: `commands`

```typescript
const commands = [
  {
    name: 'my-command',
    description: 'Does something useful',
    handler: async (_args: unknown) => {
      /* ... */
    },
  },
];
```

## `src/ini-plugin.ts`

### Region: `metadata`

```typescript
/** Metadata shape for INI-based examples. */
export interface IniMetadata {
  id: string;
  title: string;
  description?: string;
  author?: string;
  [key: string]: unknown;
}
```

### Region: `parser`

```typescript
/** Parse simple INI key=value pairs. */
function parseIni(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) continue;
    // Skip section headers
    if (trimmed.startsWith('[')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      result[key] = value;
    }
  }
  return result;
}
```

### Region: `extractor`

```typescript
/** Create an extractor that discovers meta.ini files. */
function createIniExtractor(): Extractor<IniMetadata> {
  return {
    name: 'ini-extractor',

    async extract(candidates: Dirent[]): Promise<ExtractorResult<IniMetadata>> {
      const examples: Example<IniMetadata>[] = [];
      const claimedFiles = new Set<string>();
      const errors: { path: string; message: string }[] = [];

      // Find meta.ini files from candidates
      const iniFiles: string[] = [];

      for (const candidate of candidates) {
        const fullPath = path.join(candidate.parentPath, candidate.name);

        if (candidate.isFile() && candidate.name === 'meta.ini') {
          iniFiles.push(fullPath);
        } else if (candidate.isDirectory()) {
          const metaPath = path.join(fullPath, 'meta.ini');
          try {
            await readFile(metaPath, 'utf-8');
            iniFiles.push(metaPath);
          } catch {
            // No meta.ini in this directory
          }
        }
      }

      for (const iniFile of iniFiles) {
        try {
          const content = await readFile(iniFile, 'utf-8');
          const parsed = parseIni(content);

          if (!parsed['id'] || !parsed['title']) {
            errors.push({ path: iniFile, message: 'meta.ini must have id and title' });
            continue;
          }

          const metadata: IniMetadata = {
            id: parsed['id'],
            title: parsed['title'],
            description: parsed['description'],
            author: parsed['author'],
          };

          const exampleDir = path.dirname(iniFile);
          const files = collectFiles(exampleDir);

          for (const f of files) claimedFiles.add(f);

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
            extractorName: 'ini-extractor',
          });
        } catch (err) {
          errors.push({
            path: iniFile,
            message: `Failed to parse: ${(err as Error).message}`,
          });
        }
      }

      return { examples, errors, claimedFiles };
    },
  };
}
```

### Region: `content-parser`

```typescript
/** A file-contents parser that strips INI-style comments from .ini files. */
function createIniCommentStripper(): FileContentsParser {
  return {
    name: 'ini-comment-stripper',
    parse(context: FileParseContext): FileParseContext {
      if (!context.filePath?.endsWith('.ini')) return context;

      const stripped = context.parsed
        .split('\n')
        .filter((line) => {
          const trimmed = line.trim();
          return !trimmed.startsWith(';') && !trimmed.startsWith('#');
        })
        .join('\n');

      return { ...context, parsed: stripped };
    },
  };
}
```

### Region: `create-plugin`

```typescript
/** Create the INI plugin. */
export function createIniPlugin(): Plugin<IniMetadata> {
  return {
    name: 'ini',
    extensions: ['.ini'],
    extractor: createIniExtractor(),
    fileContentsParsers: [createIniCommentStripper()],
  };
}
```

## `src/ini-example/main.ts`

```typescript
/**
 * A simple example discovered by the custom INI plugin.
 */
export function greet(name: string): string {
  return `Hello, ${name}!`;
}

console.log(greet('INI World'));

```

## `src/ini-example/meta.ini`

```ini
; Example metadata in INI format
[metadata]
id = hello-ini
title = Hello INI
description = An example using INI-based metadata
author = Example Author

```

