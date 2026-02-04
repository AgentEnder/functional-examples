# functional-examples

A language-agnostic library for treating code examples as first-class citizens.

## Features

- **Pluggable metadata extraction**: YAML frontmatter and meta.yml built-in
- **Language-aware region parsing**: Extracts code regions with comment-style detection
- **Flexible scanning**: Directory-based and file-based example discovery
- **Type-safe API**: Full TypeScript support with generic metadata types

## Installation

```bash
npm install functional-examples
# or
pnpm add functional-examples
# or
yarn add functional-examples
```

## Quick Start

### Scanning for Examples

```typescript
import { scanExamples } from 'functional-examples';

const { examples, errors } = await scanExamples('./examples');

for (const example of examples) {
  console.log(example.metadata.title);
  console.log(example.files.map(f => f.path));
}
```

### Extracting Code Regions

```typescript
import { extractRegion, parseRegions } from 'functional-examples';

// Extract a specific region
const setupCode = extractRegion(code, 'setup', { extension: 'ts' });

// Get all regions
const regions = parseRegions(code, { extension: 'py' });
console.log(regions['main']?.content);
```

## Example Formats

### Directory-based (meta.yml)

```
examples/
  my-example/
    meta.yml
    main.ts
    helper.ts
```

**meta.yml:**
```yaml
id: my-example
title: My Example
description: Demonstrates something useful
entryPoint: main.ts
```

### File-based (YAML frontmatter)

```typescript
// ---
// title: My Example
// description: A single-file example
// ---

console.log('Hello, world!');
```

## Region Markers

Mark regions in your code for extraction:

```typescript
// #region setup
const db = createDatabase();
// #endregion setup

// #region main
await db.query('SELECT * FROM users');
// #endregion main
```

Supports 30+ languages with automatic comment syntax detection.

## Custom Extractors

```typescript
import { ExtractorRegistry, MetadataExtractor } from 'functional-examples';

class TomlExtractor implements MetadataExtractor {
  readonly name = 'toml';

  canExtract(context) {
    return context.entries?.includes('meta.toml') ?? false;
  }

  async extract(context) {
    // Custom extraction logic
  }
}

const registry = new ExtractorRegistry()
  .register(new TomlExtractor());

const scanner = new ExampleScanner({ extractors: registry });
```

## API Reference

### Scanner

- `scanExamples(directory, options?)` - Scan a directory for examples
- `ExampleScanner` - Class for customized scanning

### Extractors

- `createDefaultRegistry()` - Create registry with built-in extractors
- `YamlFrontmatterExtractor` - Single-file YAML frontmatter
- `MetaYmlExtractor` - Directory-based meta.yml

### Regions

- `parseRegions(code, options?)` - Parse all regions
- `extractRegion(code, regionId, options?)` - Extract single region
- `stripRegionMarkers(code, options?)` - Remove all markers
- `listRegions(code, options?)` - List region IDs
- `LANGUAGE_CONFIGS` - Language comment syntax mappings

### File Helpers

- `readExampleFile(path, options?)` - Read file with optional region
- `readExampleFiles(directory, files)` - Read multiple files

## License

MIT
