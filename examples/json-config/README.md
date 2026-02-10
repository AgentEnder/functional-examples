# JSON Configuration Example

This example demonstrates using a JSON configuration file (`functional-examples.config.json`) instead of TypeScript for declarative setup.

## Usage

```bash
# From the example directory
npx functional-examples scan .
```

## Configuration File

The JSON config supports plugins, scan patterns, path mappings, and metadata schemas:

<%= file('functional-examples.config.json') %>

## Features

JSON configuration supports:
- **Auto-detected plugins** — Plugins are resolved automatically
- **Scan patterns** — Include/exclude patterns for file discovery
- **Path mappings** — Conflict resolution for multiple plugins
- **JSON Schema validation** — Metadata schema enforcement with IDE support

## When to Use JSON Config

Choose JSON over TypeScript configuration when:
- **No custom logic needed** — Simple declarative setup
- **Non-JS tooling** — Other tools can easily read JSON
- **Schema validation** — IDE support via JSON Schema
