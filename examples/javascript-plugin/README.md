# JavaScript Plugin Example

This example demonstrates the `@functional-examples/javascript` plugin, which extracts code examples from JavaScript and TypeScript files using frontmatter metadata and region markers.

## Usage

```bash
# Scan and display examples
npx functional-examples scan .

# Output as JSON
npx functional-examples scan . -f json
```

## Frontmatter Format

Frontmatter is written as YAML inside comment blocks at the top of a file. Here's how `getting-started.ts` defines its metadata:

<%= region('frontmatter') %>

Required fields: `id`, `title`. Optional: `description`, `tags`, and any custom fields.

## Region Markers

Extract specific code snippets with `#region` / `#endregion` markers. These are extracted as `hunks` in the scan output.

For example, the `capitalize` utility:

<%= region('capitalize') %>

And the `truncate` utility:

<%= region('truncate') %>

## Usage in Action

<%= region('usage') %>

## Configuration Options

```typescript
createJavaScriptPlugin({
  skipFrontmatter: true,  // Disable frontmatter parsing
  skipRegions: true,      // Disable region extraction
})
```

## Supported Extensions

`.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.mts`, `.cts`
