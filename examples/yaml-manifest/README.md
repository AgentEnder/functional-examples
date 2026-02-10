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
├── basic-usage/
│   ├── meta.yml      # Required: metadata for this example
│   └── scan.ts       # Source file
└── multi-file/
    ├── meta.yml
    ├── main.ts       # Entry point
    └── utils.ts      # Additional files
```

## Configuration

The config file sets up the YAML manifest plugin:

<%= file('functional-examples.config.ts') %>

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

- **Multi-file examples** — Example spans multiple source files
- **Non-JS/TS files** — Python, Go, Rust, etc.
- **Clean source files** — No metadata comments in code
- **Complex metadata** — Easier to write in YAML than comment syntax
