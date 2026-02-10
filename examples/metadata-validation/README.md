# Metadata Validation Example

This example demonstrates enforcing metadata requirements using JSON Schema validation.

## Usage

```bash
# Scan and display examples (will show validation errors)
pnpm scan

# Output as JSON to see error details
pnpm scan:json
```

## Configuration Schema

The config's `metadata` field defines a JSON Schema that all examples must satisfy:

<%= region('schema') %>

## Valid Metadata

A passing example includes all required fields — `category` and `difficulty`:

```typescript
// ---
// id: valid-example
// title: Valid Example
// description: This example has all required metadata fields
// category: tutorials
// difficulty: beginner
// ---
```

## Missing Fields

An example missing required fields will produce validation errors:

```typescript
// ---
// id: missing-fields
// title: Missing Required Fields
// description: This example is missing category and difficulty
// ---
```

When scanned, you'll see errors like:

```
Errors (1):
  - example:missing-fields: [config.metadata] must have required property 'category'
```

## Two Levels of Validation

1. **Plugin validators** — Each plugin can define its own validator (e.g., JavaScript plugin requires `id` and `title`)
2. **Config schema validation** — The `metadata` JSON Schema in your config file (validated with AJV)

Both run during scanning, and all errors are collected.

## Use Cases

- **Documentation sites** — Require `category` for navigation
- **Tutorial platforms** — Require `difficulty` for filtering
- **API references** — Require `version` for versioned docs
- **Course content** — Require `chapter`, `order` for sequencing
