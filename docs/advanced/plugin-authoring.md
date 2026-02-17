---
title: "Plugin Authoring"
description: "Build complete plugins with extractors, parsers, validators, schemas, and CLI commands."
nav:
  order: 2
---

# Plugin Authoring

A plugin bundles an extractor, file-contents parsers, validators, schemas, and CLI commands into a single package. This guide walks through building a complete plugin using the INI format as an example.

## Plugin Interface

::typedoc{symbol="Plugin" pkg="functional-examples"}

| Field | Purpose |
|-------|---------|
| `name` | Unique identifier for the plugin |
| `extensions` | File extensions this plugin handles |
| `extractor` | Discovers and extracts examples from files |
| `fileContentsParsers` | Transform file content in the parse pipeline |
| `schemas` | JSON Schema definitions for plugin options and metadata |
| `validators` | Validation functions for options and metadata |
| `commands` | CLI commands contributed by the plugin |

## Example: INI Plugin

Here's a complete plugin that supports INI-based metadata:

### Metadata Type

<%= example('plugin-authoring').file('src/ini-plugin.ts') %>

### Configuration

<%= example('plugin-authoring').file('functional-examples.config.ts') %>

## Building Each Component

### 1. Extractor

The extractor discovers examples from file candidates. It scans for a specific file pattern (e.g., `meta.ini`), parses metadata, collects sibling files, and returns `ExtractorResult`.

Key responsibilities:
- Scan `candidates` for your metadata files
- Parse metadata and validate required fields
- Collect all files belonging to each example
- Add files to `claimedFiles` to prevent conflicts
- Return errors for recoverable issues

### 2. File Contents Parser

Parsers transform file content in a pipeline. Each parser receives a `FileParseContext` and returns a modified context:

::typedoc{symbol="FileContentsParser" pkg="devkit"}

The context includes:
- `raw` — original file content
- `parsed` — current parsed content (modified by previous parsers)
- `hunks` — extracted code regions
- `metadata` — example metadata
- `filePath` — absolute path to the file

### 3. Schemas (Optional)

Contribute JSON Schema definitions for plugin options and metadata validation:

<%= example('plugin-authoring').region('schemas') %>

### 4. Validators (Optional)

Provide custom validation functions beyond what JSON Schema can express:

<%= example('plugin-authoring').region('validators') %>

### 5. Commands (Optional)

Add CLI commands that are loaded when your plugin is registered:

<%= example('plugin-authoring').region('commands') %>

## Plugin Lifecycle

1. **Loading** — Config resolution imports and instantiates plugins
2. **Registration** — Plugins register extractors, parsers, schemas, and commands
3. **Composition** — Multiple plugins compose: extractors run in parallel, parsers run in sequence, schemas merge

## Best Practices

- Keep plugins focused — one extractor per metadata format
- Use `extensions` to declare which file types you handle
- Always validate required metadata fields in the extractor
- Return errors instead of throwing for recoverable issues
- Annotate code with region markers for documentation extraction

**See also:** [Custom Extractors](../custom-extractors) for extractor-only implementations.
