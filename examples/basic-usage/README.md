# Basic Usage Example

This example demonstrates the most basic use case: scanning for examples in a directory.

## Usage

```bash
# From the repo root
npx functional-examples scan examples/basic-usage
```

## What it Shows

The `scan.ts` file demonstrates importing `scanExamples`, scanning a directory, and iterating over found examples:

<%= region('scan') %>

The scan function returns an object with:
- `examples` — Array of extracted examples
- `errors` — Array of any errors encountered during scanning
- `stats` — Timing and count information

## Key Concepts

### scanExamples

The main entry point for programmatic usage. Pass a resolved config with a `root` directory and the scanner will discover all examples using the configured plugins.
