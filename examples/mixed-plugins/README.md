# Mixed Plugins Example

This example demonstrates using multiple plugins together with conflict resolution via `pathMappings`.

## Usage

```bash
# Scan and display examples
pnpm scan

# Output as JSON
pnpm scan:json
```

## The Problem

When both JavaScript and YAML manifest plugins are active, they may both try to claim the same files:

- JavaScript plugin claims any `.ts` file with frontmatter
- YAML manifest plugin claims any directory with `meta.yml`

If a TypeScript file is inside a directory with `meta.yml`, both plugins want it.

## The Solution: pathMappings

Use `pathMappings` in your config to specify which extractor wins for each path pattern:

```typescript
const config: Config = {
  plugins: [createJavaScriptPlugin(), createYamlManifestPlugin()],
  pathMappings: [
    {
      pattern: 'src/**',
      extractor: 'javascript-extractor',  // Frontmatter wins in src/
    },
    {
      pattern: 'tutorials/**',
      extractor: 'meta-yml',              // YAML manifest wins in tutorials/
    },
  ],
};
```

## Project Structure

```
mixed-plugins/
├── src/                    # JavaScript plugin handles these
│   └── utils.ts            # Has frontmatter metadata
└── tutorials/              # YAML manifest plugin handles these
    └── hello-world/
        ├── meta.yml
        └── index.ts
```

## Extractor Names

- `javascript-extractor` - The JavaScript/TypeScript plugin
- `meta-yml` - The YAML manifest plugin

These names are defined by each plugin and used in `pathMappings`.
