# @functional-examples/javascript

JavaScript/TypeScript extractor plugin for functional-examples.

## Installation

```bash
npm install @functional-examples/javascript

```

## Overview

This plugin adds JavaScript and TypeScript support to functional-examples:

- **YAML frontmatter extraction** from JS/TS files (comment-wrapped frontmatter)
- **Automatic dependency tree resolution** via `dependency-tree`
- **TypeScript-aware file matching** with configurable glob patterns

## Usage

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

## Features

### Frontmatter Extraction

The plugin detects YAML frontmatter in JS/TS comment blocks:

```typescript
// ---
// id: getting-started
// title: Getting Started
// description: A simple example demonstrating frontmatter metadata extraction
// tags:
//   - beginner
//   - tutorial
// ---

/**
 * A simple greeting function.
 *
 * @param name - The name to greet
 * @returns A greeting message
 */
export function greet(name: string): string {
  return `Hello, ${name}!`;
}

// Example usage of the greet function
const message = greet('World');
console.log(message); // Output: Hello, World!

```

### Dependency Resolution

When an entry point is specified, the plugin automatically resolves its dependency tree to discover related files.

### Path Mappings

Configure path mappings to handle TypeScript path aliases in your examples.

## License

MIT
