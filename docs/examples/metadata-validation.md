---
generated: true
---

# Metadata Validation

Demonstrates enforcing metadata requirements using JSON Schema validation
to ensure examples have required fields like category and difficulty.


# Metadata Validation Example

This example demonstrates enforcing metadata requirements using JSON Schema validation.

## Usage

```bash
# Scan and display examples (will show validation errors)
npx functional-examples scan

# Output as JSON to see error details
npx functional-examples scan -f json
```

## Configuration Schema

The config's `metadata` field defines a JSON Schema that all examples must satisfy:

```json
{
  "$schema": "./.functional-examples/schema.json",
  "scan": {
    "include": ["src/**/*"],
    "exclude": ["**/node_modules/**", "**/dist/**"]
  },
  "metadata": {
    "type": "object",
    "properties": {
      "category": {
        "type": "string",
        "description": "Category for organizing examples"
      },
      "difficulty": {
        "type": "string",
        "enum": ["beginner", "intermediate", "advanced"],
        "description": "Difficulty level"
      }
    },
    "required": ["category", "difficulty"]
  }
}

```

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


## `demo.sh`

### Region: `scan`

```bash
# Scan with validation — missing required fields will be reported
npx functional-examples scan
```

### Region: `json`

```bash
# View detailed validation results as JSON
npx functional-examples scan -f json
```

## `package.json`

```json
{
  "name": "@examples/metadata-validation",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "description": "Demonstrates enforcing metadata requirements using JSON Schema validation to ensure examples have required fields like category and difficulty",
  "dependencies": {
    "functional-examples": "workspace:*",
    "@functional-examples/javascript": "workspace:*"
  },
  "functional-examples": {
    "title": "Metadata Validation",
    "tags": ["validation", "json-schema", "quality"]
  }
}

```

## `src/missing-fields.ts`

### Region: `frontmatter`

```typescript
// ---
// id: missing-fields
// title: Missing Required Fields
// description: This example is missing category and difficulty
// ---
```

## `src/valid-example.ts`

### Region: `frontmatter`

```typescript
// ---
// id: valid-example
// title: Valid Example
// description: This example has all required metadata fields
// category: tutorials
// difficulty: beginner
// ---
```

