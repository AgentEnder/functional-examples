---
title: "Plugins"
description: "Built-in plugins, when to use each one, multi-plugin setups, and building custom extractors."
nav:
  section: "Guides"
  order: 4
---

# Plugins

Plugins are the primary extension mechanism in functional-examples. Each plugin provides extractors, validators, commands, or schemas. This guide covers the built-in plugins, when to reach for each one, and how to compose them.

## JavaScript Plugin

**Package:** `@functional-examples/javascript`

The JavaScript plugin extracts examples from `.ts`, `.js`, `.tsx`, `.jsx`, `.mjs`, `.cjs`, `.mts`, and `.cts` files. It supports two extraction modes:

**Single-file (frontmatter):** Individual source files with YAML frontmatter in comment blocks. The frontmatter provides `id`, `title`, and any custom metadata. The plugin also detects `#region` / `#endregion` markers for referencing specific code sections.

Here's a single-file example:

<%= example('javascript-plugin').file('src/getting-started.ts') %>

**Multi-file (package.json):** Directories with a `package.json` that provides metadata. The plugin reads `name` (for id), `description`, `keywords`, and custom fields from the `functional-examples` key. It traces entry points (`main`, `module`, `exports`) to discover which files belong to the example.

**When to use it:**

- Your examples are TypeScript or JavaScript (single or multi-file)
- You want metadata co-located with the code
- You want region markers for referencing specific code sections
- You want multi-file examples with automatic entry point tracing

## YAML Manifest Plugin

**Package:** `@functional-examples/yaml-manifest`

The YAML manifest plugin discovers examples via `meta.yml` files in directories. Each `meta.yml` declares the example's metadata, and all sibling files become part of the example.

**When to use it:**

- Your examples span multiple files
- You work with non-JS/TS files (Python, Go, Rust, etc.)
- You want metadata separate from source code
- You need complex metadata structures

## Test Plugin

**Package:** `@functional-examples/test`

The test plugin adds testing capabilities. It reads test definitions from `metadata.test` on any scanned example — regardless of which extractor produced it. The test plugin doesn't extract examples itself; it operates on metadata populated by other plugins.

For JavaScript plugin examples using package.json, test definitions live under the `functional-examples.test` key:

<%= example('test-plugin-example').file('package.json') %>

For frontmatter-based examples, you could add a `test` field to the YAML metadata. For YAML manifest examples, add it to `meta.yml`. The test plugin doesn't care where the metadata came from — it just validates and runs whatever it finds in `metadata.test`.

Run tests with:

```bash
npx functional-examples test
```

**When to use it:**

- You want CI verification that examples actually run
- You need to assert exit codes, stdout, or stderr patterns
- You want regression testing for example code

## Documentation Plugin

**Package:** `@functional-examples/documentation`

The documentation plugin generates markdown documentation from scanned examples. It provides:

- Template-based doc generation (`functional-examples generate`)
- Prose rendering (expanding `file()` and `region()` references in README.md files)
- Guide hydration (expanding cross-example references in standalone guides)

**When to use it:**

- You want auto-generated API docs from example code
- You write guides that reference live example files
- You need consistent documentation format across many examples

## Multi-Plugin Setup

You can combine multiple plugins. When doing so, use **pathMappings** to route files to the right extractor and avoid conflicts:

<%= example('mixed-plugins').file('functional-examples.config.json') %>

Path mappings use glob patterns to assign files to specific extractors by name. Files that match a mapping are only sent to the specified extractor. Unmapped files are sent to all extractors.

## Custom Extractors

When the built-in plugins don't fit your metadata format, write a custom extractor. An extractor is a function that receives file candidates and returns examples.

Here's a complete custom extractor that reads TOML metadata files:

<%= example('custom-extractor').file('toml-extractor.ts') %>

And here's how to use it in a scan script:

<%= example('custom-extractor').file('scan.ts') %>

**Key points for custom extractors:**

- Return `claimedFiles` so other extractors don't process the same files
- Return `errors` for recoverable issues (the scanner collects them)
- Throw for unrecoverable failures
- Use `extractorName` to identify your extractor in results
