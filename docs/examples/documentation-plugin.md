---
generated: true
---

# Documentation Plugin

Demonstrates using the documentation plugin to generate
markdown documentation from scanned examples. Shows template
rendering, region extraction, and generated output structure.


# Documentation Plugin

Demonstrates using `@functional-examples/documentation` to generate markdown from scanned examples.

## What This Shows

- Configuring the documentation plugin alongside the JavaScript plugin
- Running the `documentation` command to generate markdown files
- Generated output structure: per-example pages with regions + an index page
- Snapshot testing to verify generated output doesn't drift

## Running

```bash
# Scan for examples
bash demo.sh

# Generate documentation from scanned examples
bash generate.sh
```

## Generated Output

The `documentation` command produces:
- **`generated-docs/doc-sample.md`** — per-example page with title, description, and code regions
- **`generated-docs/index.md`** — index linking to all generated example pages

The snapshot in `__snapshots__/doc-sample.md` shows the expected output structure.

## Configuration

The `functional-examples.config.ts` registers both the JavaScript plugin (for extraction) and the documentation plugin (for generation). The documentation plugin adds the `documentation` CLI command with `outputDir` and `format` options.


---
generated: true
---

# Sample for Documentation

A simple example demonstrating documentation generation

## `src/sample.ts`

### Region: `frontmatter`

```typescript
// ---
// id: doc-sample
// title: Sample for Documentation
// description: A simple example demonstrating documentation generation
// tags:
//   - documentation
//   - sample
// ---
```

### Region: `setup`

```typescript
import { readFileSync } from 'node:fs';

/**
 * Read and parse a configuration file.
 */
export function loadConfig(path: string): Record<string, unknown> {
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content);
}
```

### Region: `usage`

```typescript
// Load configuration from a JSON file
const config = loadConfig('config.json');
console.log('Loaded config:', config);
```



## `demo.sh`

### Region: `scan`

```bash
# Scan for examples — documentation plugin registered alongside JavaScript plugin
npx functional-examples scan
```

## `functional-examples.config.ts`

```typescript
import { createDocumentationPlugin } from '@functional-examples/documentation';
import { createJavaScriptPlugin } from '@functional-examples/javascript';
import type { Config } from 'functional-examples';

/**
 * Configuration demonstrating the documentation plugin.
 *
 * The documentation plugin:
 * - Adds the `generate` CLI command
 * - Enables template-based doc generation
 * - Provides prose helpers (file(), region(), fencedBlock())
 */
const config: Config = {
  plugins: [
    createJavaScriptPlugin(),
    createDocumentationPlugin({
      outputDir: 'generated-docs',
      format: 'markdown',
    }),
  ],
  scan: {
    include: ['src/**/*'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
};

export default config;

```

## `generate.sh`

### Region: `generate`

```bash
# Generate markdown documentation from all scanned examples
npx functional-examples documentation
```

## `package.json`

```json
{
  "name": "@examples/documentation-plugin",
  "private": true,
  "type": "module",
  "description": "Demonstrates using the documentation plugin to generate markdown",
  "dependencies": {
    "functional-examples": "workspace:*",
    "@functional-examples/javascript": "workspace:*",
    "@functional-examples/documentation": "workspace:*"
  },
  "functional-examples": {
    "title": "Documentation Plugin",
    "tags": ["docs", "templates", "generation"]
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

## `src/sample.ts`

### Region: `frontmatter`

```typescript
// ---
// id: doc-sample
// title: Sample for Documentation
// description: A simple example demonstrating documentation generation
// tags:
//   - documentation
//   - sample
// ---
```

