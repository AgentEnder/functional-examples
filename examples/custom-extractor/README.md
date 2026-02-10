# Custom Extractor Example

This example demonstrates how to create your own custom extractor for file formats not covered by built-in plugins.

## Usage

```bash
# Scan using the custom TOML extractor
pnpm scan

# Output as JSON
pnpm scan:json
```

## The Extractor

The `createTomlExtractor` function implements the full extractor interface — scanning for `meta.toml` files, parsing metadata, and claiming files:

<%= region('createExtractor') %>

## Key Concepts

### Tree-Scan Pattern

Extractors implement the "tree-scan" pattern:
- Called once with candidate `Dirent[]` entries
- Return ALL examples found in those candidates
- Claim files they've processed via `claimedFiles`

### Claimed Files

The `claimedFiles` set tells the scanner which files this extractor owns. This is used for:
- Conflict detection (multiple extractors claiming same file)
- Path-based conflict resolution

### Example Shape

Each example must have:
- `id` — Unique identifier
- `title` — Display name
- `rootPath` — Base directory
- `files` — Array of file info
- `metadata` — Your custom metadata type
- `extractorName` — Your extractor's name

## When to Create a Custom Extractor

- Unique metadata format (TOML, INI, custom JSON schema)
- Special directory structures
- Language-specific conventions
- Integration with other tools
