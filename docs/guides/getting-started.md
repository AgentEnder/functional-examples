---
title: "Getting Started"
description: "Install functional-examples, configure your first project, and run your first scan."
nav:
  order: 1
---

# Getting started

functional-examples helps you manage, scan, and validate code examples embedded in your projects. The steps below cover installation, configuration, and running your first scan.

## Installation

Install the core package and at least one plugin:

```bash
npm install functional-examples @functional-examples/javascript
```

Or with pnpm:

```bash
pnpm add functional-examples @functional-examples/javascript
```

## Project configuration

Create a `functional-examples.config.ts` at your project root. This tells the scanner which plugins to use and where to find examples.

Here's a minimal configuration that uses the JavaScript plugin to scan an `examples/` directory:

<%= example('getting-started').region('config') %>

## Writing your first example

The JavaScript plugin supports two ways to define examples:

### Single-file with frontmatter

For standalone files, embed YAML frontmatter in a comment block. Create `examples/hello.ts`:

<%= example('getting-started').file('src/hello.ts') %>

The frontmatter provides metadata — an `id`, `title`, and optional `description` — that the scanner extracts alongside the code.

### Multi-file with package.json

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

## Running a scan

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

## What comes next

- **[Core Concepts](../core-concepts)** — understand examples, extractors, and the plugin model
- **[Plugins](../plugins)** — explore built-in plugins and when to use each one
- **[Configuration](../configuration)** — deep dive into config options, scan patterns, and metadata schemas
- **[Testing Examples](../testing-examples)** — verify that your examples actually run

### Deep dives

- **[JavaScript Plugin](../../plugins/javascript)** — frontmatter, regions, and package.json metadata
- **[YAML Manifest Plugin](../../plugins/yaml-manifest)** — directory-based example discovery
- **[Test Plugin](../../plugins/test)** — full assertion reference and reporter options
- **[Documentation Plugin](../../plugins/documentation)** — template rendering and prose helpers

### Advanced topics

- **[Custom Extractors](../../advanced/custom-extractors)** — support alternative metadata formats
- **[Plugin Authoring](../../advanced/plugin-authoring)** — build complete plugins from scratch
- **[Snapshot Testing](../../advanced/snapshot-testing)** — verify output against reference files
- **[CI Integration](../../advanced/ci-integration)** — run example tests in GitHub Actions
