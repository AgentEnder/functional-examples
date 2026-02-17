---
title: "Core Concepts"
description: "Understand examples, extractors, plugins, configuration, regions, and the scanner pipeline."
nav:
  order: 3
---

# Core Concepts

This guide explains the building blocks of functional-examples: what an example *is*, how extractors discover them, how plugins compose behavior, and how the scanner ties it all together.

## Examples

An **Example** is the fundamental unit. It represents a single scannable code example with:

- **id** — unique identifier (e.g., `"basic-usage"`)
- **title** — human-readable name
- **description** — what the example demonstrates
- **files** — the actual source files belonging to this example
- **metadata** — arbitrary key-value data (tags, difficulty, category, etc.)
- **extractorName** — which extractor discovered this example

Every plugin ultimately produces `Example` objects. The scanner collects them all into a uniform `ScanResult`.

## Extractors

An **Extractor** is a function that receives a list of file candidates and returns examples. It's the core mechanism plugins use to discover examples in your project tree.

The extractor contract:

1. Receive `Dirent[]` candidates (files matching the scan patterns)
2. Inspect files, parse metadata, group related files
3. Return an `ExtractorResult` with:
   - `examples` — the discovered examples
   - `errors` — any problems encountered
   - `claimedFiles` — paths this extractor "owns" (prevents double-extraction)

Here's a custom extractor that parses TOML metadata files:

<%= example('custom-extractor').file('toml-extractor.ts') %>

The **claimed files** mechanism is important: when multiple plugins are active, each extractor claims the files it processes. This prevents the same file from being extracted twice by different plugins.

## Plugins

A **Plugin** is a container that provides one or more capabilities:

| Capability | Purpose |
|-----------|---------|
| **extractor** | Discovers examples from files |
| **validators** | Checks example metadata against rules |
| **schemas** | JSON Schema definitions for metadata and options |
| **commands** | CLI commands the plugin adds |
| **extensions** | File extensions the plugin handles |

Plugins are registered in your config:

<%= example('multi-plugin-config').region('full-config') %>

Each plugin operates independently. The scanner calls each plugin's extractor in sequence, passing unclaimed files to subsequent extractors.

## Regions

**Regions** (also called hunks) are named sections within a file, marked with `#region` / `#endregion` comments:

<%= example('region-markers').file('src/regions-demo.ts') %>

Regions let you reference specific parts of a file in documentation. Instead of showing an entire file, you can pull just the `setup` region:

```markdown
<\%= example('my-example').region('setup') %\>;
```

> [!NOTE]
> There's a zero width space in the above code to prevent it from being processed by eta, copying it directly will not work.

The JavaScript plugin automatically detects `#region` / `#endregion` markers and records their line ranges as hunks on the file.

## The Scanner Pipeline

When you call `scan()` or `scanExamples()`, here's what happens:

1. **Config resolution** — the config file is loaded, plugins are instantiated, and scan patterns are resolved
2. **File discovery** — the scanner globs for files matching `scan.include` patterns (minus `scan.exclude`)
3. **Path mapping** — if `pathMappings` are configured, files are routed to specific extractors by pattern
4. **Extraction** — each plugin's extractor runs against its candidate files, producing examples and claiming files
5. **Validation** — if the config includes a `metadata` schema, each example's metadata is validated against it
6. **Result assembly** — examples, errors, and stats are collected into a `ScanResult`

The result gives you everything you need to generate docs, run tests, or build custom tooling.

## Configuration

Configuration lives in a `functional-examples.config.ts` (or `.json`) file at your project root. It controls:

- **plugins** — which plugins to load
- **scan.root** — base directory for scanning
- **scan.include / scan.exclude** — glob patterns for file discovery
- **pathMappings** — route specific file patterns to specific extractors
- **metadata** — JSON Schema for validating example metadata

See the [Configuration guide](../configuration) for the full reference.
