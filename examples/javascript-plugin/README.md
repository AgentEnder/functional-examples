# JavaScript Plugin Example

This example demonstrates the `@functional-examples/javascript` plugin, which extracts code examples from JavaScript and TypeScript files using:

1. **Frontmatter metadata** - YAML in comments at the top of files
2. **Region markers** - `#region` / `#endregion` for code snippets

## Usage

```bash
# Scan and display examples
pnpm scan

# Output as JSON
pnpm scan:json
```

## Frontmatter Format

```typescript
// ---
// id: my-example
// title: My Example Title
// description: A description of what this example shows
// tags:
//   - beginner
//   - tutorial
// ---

// Your code here...
```

Required fields: `id`, `title`

## Region Markers

Extract specific code snippets:

```typescript
// #region setup
const config = { ... };
// #endregion setup

// #region usage
doSomething(config);
// #endregion usage
```

Regions are extracted as `hunks` in the scan output.

## Configuration Options

```typescript
createJavaScriptPlugin({
  skipFrontmatter: true,  // Disable frontmatter parsing
  skipRegions: true,      // Disable region extraction
})
```

## Supported Extensions

`.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.mts`, `.cts`
