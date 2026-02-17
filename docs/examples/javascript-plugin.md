---
generated: true
---

# JavaScript Plugin

Demonstrates using frontmatter comments in TypeScript/JavaScript files
to define example metadata, including region markers for code snippets.


# JavaScript Plugin Example

This example demonstrates the `@functional-examples/javascript` plugin, which extracts code examples from JavaScript and TypeScript files using frontmatter metadata and region markers.

## Usage

```bash
# Scan and display examples
npx functional-examples scan

# Output as JSON
npx functional-examples scan -f json
```

## Frontmatter Format

Frontmatter is written as YAML inside comment blocks at the top of a file. Here's how `getting-started.ts` defines its metadata:

```typescript
// ---
// id: getting-started
// title: Getting Started
// description: A simple example demonstrating frontmatter metadata extraction
// tags:
//   - beginner
//   - tutorial
// ---
```

Required fields: `id`, `title`. Optional: `description`, `tags`, and any custom fields.

## Region Markers

Extract specific code snippets with `#region` / `#endregion` markers. These are extracted as `hunks` in the scan output.

For example, the `capitalize` utility:

```typescript
/**
 * Capitalize the first letter of a string.
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
```

And the `truncate` utility:

```typescript
/**
 * Truncate a string to a maximum length.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
```

## Usage in Action

```typescript
// Example usage of the greet function
const message = greet('World');
console.log(message); // Output: Hello, World!
```

## Configuration Options

```typescript
createJavaScriptPlugin({
  skipFrontmatter: true,  // Disable frontmatter parsing
  skipRegions: true,      // Disable region extraction
})
```

## Supported Extensions

`.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.mts`, `.cts`


## `demo.sh`

### Region: `scan`

```bash
# Scan for examples using the JavaScript plugin
npx functional-examples scan
```

### Region: `json`

```bash
# View scan results as JSON — includes regions and frontmatter metadata
npx functional-examples scan -f json
```

## `functional-examples.config.ts`

```typescript
import { createJavaScriptPlugin } from '@functional-examples/javascript';
import type { Config } from 'functional-examples';

/**
 * Configuration for the JavaScript plugin example.
 *
 * This example demonstrates:
 * - Frontmatter metadata extraction (id, title, description, custom fields)
 * - Region markers for code snippets (#region / #endregion)
 *
 * Plugin options (all optional):
 * - skipFrontmatter: true  - Disable frontmatter parsing
 * - skipRegions: true      - Disable region extraction
 */
const config: Config = {
  plugins: [createJavaScriptPlugin()],
  scan: {
    include: ['src/**/*'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
};

export default config;

```

## `package.json`

```json
{
  "name": "@examples/javascript-plugin",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "description": "Demonstrates using frontmatter comments in TypeScript/JavaScript files to define example metadata, including region markers for code snippets",
  "dependencies": {
    "functional-examples": "workspace:*",
    "@functional-examples/javascript": "workspace:*"
  },
  "functional-examples": {
    "title": "JavaScript Plugin",
    "tags": ["plugin", "frontmatter", "typescript", "regions"]
  }
}

```

