# YAML Manifest Example

This example demonstrates the `@functional-examples/yaml-manifest` plugin, which organizes examples as directories with a `meta.yml` manifest file.

## Usage

```bash
# Scan and display examples
pnpm scan

# Output as JSON
pnpm scan:json
```

## Directory Structure

```
examples/
├── my-example/
│   ├── meta.yml      # Required: metadata for this example
│   ├── index.ts      # Entry point (specified in meta.yml)
│   └── helper.ts     # Additional files
└── another-example/
    ├── meta.yml
    └── main.py       # Works with any file type
```

## meta.yml Format

```yaml
id: my-example
title: My Example Title
description: |
  A longer description that can span
  multiple lines using YAML syntax.
entryPoint: index.ts  # Optional: main file of the example
tags:
  - beginner
  - tutorial
```

Required fields: `id`, `title`

## When to Use This Plugin

Choose YAML manifest over frontmatter when:

- **Multi-file examples** - Example spans multiple source files
- **Non-JS/TS files** - Python, Go, Rust, etc.
- **Clean source files** - No metadata comments in code
- **Complex metadata** - Easier to write in YAML than comment syntax

## File Discovery

All files in the example directory (except `meta.yml`) are included as example files. Use `entryPoint` to indicate the primary file.
