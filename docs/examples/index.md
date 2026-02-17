---
generated: true
---

# Examples

- [Getting Started](./basic-usage.md) — Minimal setup demonstrating CLI usage and simple programmatic scanning.
This is the first example new users should explore.

- [Custom Extractor](./custom-extractor.md) — Demonstrates creating a custom Extractor implementation to support
alternative metadata formats like TOML. Advanced usage requiring
a TypeScript config with inline plugin code.

- [Documentation Plugin](./documentation-plugin.md) — Demonstrates using the documentation plugin to generate
markdown documentation from scanned examples. Shows template
rendering, region extraction, and generated output structure.

- [JavaScript Plugin](./javascript-plugin.md) — Demonstrates using frontmatter comments in TypeScript/JavaScript files
to define example metadata, including region markers for code snippets.

- [JSON Configuration](./json-config.md) — Shows how to use a JSON configuration file for declarative setup. JSON configs support auto-detected plugins, scan patterns, path mappings, and metadata validation via JSON Schema.

- [Metadata Validation](./metadata-validation.md) — Demonstrates enforcing metadata requirements using JSON Schema validation
to ensure examples have required fields like category and difficulty.

- [Mixed Plugins](./mixed-plugins.md) — Demonstrates using multiple plugins together with path-based
conflict resolution via pathMappings configuration.
src/ files use JavaScript plugin, tutorials/ use YAML manifest.

- [Plugin Authoring](./plugin-authoring.md) — Demonstrates building a custom plugin from scratch that supports
INI-based metadata. Implements the full Plugin interface with
name, extensions, extractor, and fileContentsParsers.

- [Snapshot Testing](./snapshot-testing.md) — Demonstrates snapshot assertions for verifying scan output.
Shows how to annotate snapshot files with region tags for
extracting documentation snippets.

- [Test Plugin Example](./test-plugin-example.md) — Demonstrates the test plugin with command execution and assertions.
Tests verify script behavior including exit codes and output content.

- [YAML Manifest Plugin](./yaml-manifest.md) — Demonstrates using the yaml-manifest plugin to manage
multi-file examples with meta.yml metadata files.
Each example is a directory containing a meta.yml and source files.

