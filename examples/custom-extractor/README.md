# Custom Extractor Example

This example demonstrates how to create your own custom extractor for file formats not covered by built-in plugins.

## Usage

```bash
# Scan using the custom TOML extractor
pnpm scan

# Output as JSON
pnpm scan:json
```

## The Extractor Interface

```typescript
interface Extractor<TMetadata> {
  name: string;
  extract(
    rootPath: string,
    options?: { include?: string[]; exclude?: string[] }
  ): Promise<ExtractorResult<TMetadata>>;
}

interface ExtractorResult<TMetadata> {
  examples: Example<TMetadata>[];
  errors: { path: string; message: string }[];
  claimedFiles: Set<string>;
}
```

## Key Concepts

### Tree-Scan Pattern

Extractors implement the "tree-scan" pattern:
- Called once with the root directory
- Return ALL examples found in that tree
- Claim files they've processed

### Claimed Files

The `claimedFiles` set tells the scanner which files this extractor owns. This is used for:
- Conflict detection (multiple extractors claiming same file)
- Path-based conflict resolution

### Example Shape

Each example must have:
- `id` - Unique identifier
- `title` - Display name
- `rootPath` - Base directory
- `files` - Array of file info
- `metadata` - Your custom metadata type
- `extractorName` - Your extractor's name

## Creating Your Own

1. Define your metadata interface
2. Implement the `Extractor` interface
3. Scan for your file pattern (e.g., `meta.toml`)
4. Parse metadata and collect files
5. Return examples with claimed files

See `toml-extractor.ts` for a complete implementation.

## When to Create a Custom Extractor

- Unique metadata format (TOML, INI, custom JSON schema)
- Special directory structures
- Language-specific conventions
- Integration with other tools
