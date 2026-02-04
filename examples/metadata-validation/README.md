# Metadata Validation Example

This example demonstrates enforcing metadata requirements using JSON Schema validation.

## Usage

```bash
# Scan and display examples (will show validation errors)
pnpm scan

# Output as JSON to see error details
pnpm scan:json
```

## Configuration

The config's `metadata` field defines a JSON Schema:

```typescript
const config: Config = {
  plugins: [createJavaScriptPlugin()],
  metadata: {
    type: 'object',
    properties: {
      category: { type: 'string' },
      difficulty: {
        type: 'string',
        enum: ['beginner', 'intermediate', 'advanced'],
      },
    },
    required: ['category', 'difficulty'],
  },
};
```

## Validation Errors

When an example is missing required metadata, you'll see errors like:

```
Errors (1):
  - example:my-example: [config.metadata] category: must have required property 'category'
```

## Two Levels of Validation

1. **Plugin validators** - Each plugin can define its own validator (e.g., JavaScript plugin requires `id` and `title`)

2. **Config schema validation** - The `metadata` JSON Schema in your config file (validated with AJV)

Both run during scanning, and all errors are collected.

## Use Cases

- **Documentation sites** - Require `category` for navigation
- **Tutorial platforms** - Require `difficulty` for filtering
- **API references** - Require `version` for versioned docs
- **Course content** - Require `chapter`, `order` for sequencing
