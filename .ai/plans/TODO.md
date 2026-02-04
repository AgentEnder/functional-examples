# Completed Work

## Plugin Architecture Refactor (Feb 4, 2025)

All items from the original TODO have been addressed through the plugin architecture refactor:

### ✅ Extractors + Region Detection / Hunks
- Implemented via `ExampleFile` with `raw`, `parsed`, and `hunks` fields
- Parsers process file contents through pipeline (`FileParseContext` accumulator)
- Region detection via `#region`/`#endregion` markers with language-specific comment prefixes

### ✅ Frontmatter Extractor - Comment Prefix Detection by Language
- Replaced generic frontmatter extractor with `@functional-examples/javascript` plugin
- JavaScript plugin detects both line comments (`// ---`) and block comments (`/* --- */`)
- Architecture supports adding language-specific plugins (Python, Go, etc.)

### ✅ Frontmatter Extractor - Multi-line Comment Support
- JavaScript frontmatter parser supports block comment wrapped style:
  ```javascript
  /* ---
  title: Example
  --- */
  ```

## New Architecture

### Core Package (`functional-examples`)
- `Plugin` interface: Combines extractors and file content parsers
- `PluginRegistry`: Manages plugins and extension-based lookup
- `FileParseContext`: Accumulator pattern for parser pipelines
- `scanExamples()`: Supports both plugins (new) and extractors (deprecated)

### JavaScript Plugin (`@functional-examples/javascript`)
- Single-file extractor for `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.mts`, `.cts`
- Frontmatter parser (line and block comment styles)
- Region parser (`#region`/`#endregion` markers)
- Combined parser chains frontmatter → regions

### YAML Manifest Plugin (`@functional-examples/yaml-manifest`)
- Directory-based multi-file examples via `meta.yml` manifest
- No file extensions (not file-type specific)
- No content parser (manifest is separate from content)

## Future Work

- [ ] Add more language plugins (Python, Go, Rust, etc.)
- [ ] Support nested region markers
- [ ] Add CLI for scanning examples
- [ ] Add validation for example metadata schemas
