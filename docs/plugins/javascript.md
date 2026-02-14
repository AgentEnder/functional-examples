---
title: "JavaScript Plugin"
description: "Extract examples from TypeScript and JavaScript files using frontmatter metadata and region markers."
nav:
  order: 1
---

# JavaScript Plugin

The JavaScript plugin (`@functional-examples/javascript`) extracts examples from TypeScript and JavaScript source files. It supports YAML frontmatter in comment blocks for metadata and region markers for referencing specific code sections.

## Installation

```bash
npm install @functional-examples/javascript
```

## Supported Extensions

`.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts`, `.cts`

## Frontmatter Extraction

Embed YAML metadata in a comment block at the top of any supported file:

<%= example('javascript-plugin').file('src/getting-started.ts') %>

The frontmatter block is delimited by `// ---` markers. All fields are extracted as metadata — `id` and `title` are required, everything else is optional.

### Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier for the example |
| `title` | Yes | Human-readable title |
| `description` | No | What the example demonstrates |
| `tags` | No | Array of category tags |
| Any custom field | No | Extracted as-is into metadata |

## Region Markers

Mark code sections with `#region` / `#endregion` (or custom tags) for selective extraction:

```typescript
// #region usage
const result = greet('World');
console.log(result);
// #endregion usage
```

Regions become **hunks** on the example's files. Documentation can reference specific regions via `<\%= example('javascript-plugin').region('usage') \%>` to include only that section.

### Custom Region Tags

Override the default markers via plugin options:

```typescript
createJavaScriptPlugin({
  regionTag: { start: '#_region', end: '#_endregion' },
})
```

This is useful when standard `#region` comments should remain visible in output while custom markers are stripped by the parser.

## Package.json Metadata Mode

For multi-file examples, the plugin reads metadata from `package.json`:

- `name` → `id`
- `description` → `description`
- `keywords` → `tags`
- `functional-examples.title` → `title`
- `functional-examples.tags` → additional tags

The plugin traces entry points (`main`, `module`, `exports`) to discover which files belong to the example automatically.

## Configuration

<%= example('javascript-plugin').file('functional-examples.config.ts') %>

### Plugin Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `skipFrontmatter` | `boolean` | `false` | Disable frontmatter parsing |
| `skipRegions` | `boolean` | `false` | Disable region extraction |
| `skipExtraction` | `boolean` | `false` | Disable example extraction (parser-only mode) |
| `regionTag` | `{ start, end }` | `{ start: '#region', end: '#endregion' }` | Custom region tag names |

### Parser-Only Mode

Set `skipExtraction: true` to use the JavaScript plugin only for its parsers (frontmatter + regions) without extracting examples. This is useful when another plugin handles extraction:

```typescript
createJavaScriptPlugin({
  skipExtraction: true,
  regionTag: { start: '#_region', end: '#_endregion' },
})
```

## When to Use

- Your examples are TypeScript or JavaScript (single or multi-file)
- You want metadata co-located with the code
- You want region markers for referencing specific code sections
- You want multi-file examples with automatic entry point tracing

**See also:** [YAML Manifest Plugin](../yaml-manifest) for non-JS examples or when you prefer metadata separate from source code.
