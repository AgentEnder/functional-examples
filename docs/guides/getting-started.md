---
title: "Getting Started"
description: "Install functional-examples, configure your first project, and run your first scan."
nav:
  section: "Guides"
  order: 1
---

# Getting Started

functional-examples helps you manage, scan, and validate code examples embedded in your projects. This guide walks you through installation, configuration, and running your first scan.

## Installation

Install the core package and at least one plugin:

```bash
npm install functional-examples @functional-examples/javascript
```

Or with pnpm:

```bash
pnpm add functional-examples @functional-examples/javascript
```

## Project Configuration

Create a `functional-examples.config.ts` at your project root. This tells the scanner which plugins to use and where to find examples.

Here's a minimal configuration that uses the JavaScript plugin to scan an `examples/` directory:

```typescript
import { createJavaScriptPlugin } from '@functional-examples/javascript';

export default {
  plugins: [createJavaScriptPlugin()],
  scan: {
    root: 'examples',
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
};
```

## Writing Your First Example

The JavaScript plugin supports two ways to define examples:

### Single-File with Frontmatter

For standalone files, embed YAML frontmatter in a comment block. Create `examples/hello.ts`:

```typescript
/**
 * ---
 * id: hello
 * title: Hello World
 * description: A minimal example
 * ---
 */
export function hello() {
  return 'Hello from functional-examples!';
}
```

The frontmatter provides metadata — an `id`, `title`, and optional `description` — that the scanner extracts alongside the code.

### Multi-File with package.json

For examples that span multiple files, use a `package.json` as the metadata source. The JavaScript plugin reads the `name` field for the id, `description` and `keywords` from standard fields, and any custom metadata from a `functional-examples` key:

```json
{
  "name": "@examples/my-example",
  "description": "An example with multiple files",
  "main": "./index.ts",
  "functional-examples": {
    "title": "My Example",
    "tags": ["getting-started"]
  }
}
```

The plugin traces entry points (`main`, `module`, `exports`) to discover which files belong to the example, so you don't have to list them manually.

## Running a Scan

### CLI

The quickest way to scan is via the CLI:

```bash
npx functional-examples scan
```

This discovers your config file, loads plugins, and prints every example it finds.

### Programmatic API

For tighter integration, use the `scan()` convenience function. Here's how the **basic-usage** example does it:

<%= example('basic-usage').file('scan.ts') %>

`scan()` auto-discovers the nearest config file, resolves plugins, and returns a `ScanResult` with `examples`, `errors`, and `stats`.

## What Comes Next

- **[Core Concepts](./core-concepts)** — understand examples, extractors, and the plugin model
- **[Plugins](./plugins)** — explore built-in plugins and when to use each one
- **[Configuration](./configuration)** — deep dive into config options, scan patterns, and metadata schemas
- **[Testing Examples](./testing-examples)** — verify that your examples actually run
