# Getting Started

This example demonstrates the most basic use case: scanning for examples using the CLI and programmatic API.

## CLI Usage

```bash
# Scan for examples
functional-examples scan

# Output as JSON
functional-examples scan -f json
```

## Programmatic Usage

The `scan.ts` file demonstrates the simplest programmatic entry point:

<%= region('scan') %>

The `scan()` function auto-discovers your config file and installed plugins, then returns:
- `examples` — Array of extracted examples
- `errors` — Array of any errors encountered during scanning
- `stats` — Timing and count information

## Key Concepts

### JSON Configuration

This example uses a JSON config (`functional-examples.config.json`) which is the simplest way to configure scanning. Plugins are auto-detected from your `package.json` dependencies.

### `scan()`

The convenience function wraps config discovery, loading, resolution, and scanning in a single call. For most use cases, this is all you need.
