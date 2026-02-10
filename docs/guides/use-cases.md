---
title: "Use Cases"
description: "Real-world scenarios where functional-examples shines: doc sites, tutorials, API references, monorepos, and OSS showcases."
nav:
  section: "Guides"
  order: 7
---

# Use Cases

functional-examples is flexible enough for many different contexts. This guide walks through the most common scenarios and how to set them up.

## Documentation Sites

The most common use case: you maintain a library and want your docs to show real, tested code.

**Setup:**

1. Put example projects under `examples/` in your repo
2. Use the JavaScript plugin for frontmatter-based examples
3. Use the documentation plugin to generate pages or hydrate guides

**Why it works:** examples are real files that your editor type-checks and your CI can test. When you rename an API, your examples break at build time — not after a user reports stale docs.

## Tutorials and Courses

For structured learning content where examples build on each other.

**Setup:**

1. Use the YAML manifest plugin for multi-file examples
2. Organize examples by chapter/lesson in directories
3. Use metadata fields like `difficulty` and `category` to structure navigation
4. Use the test plugin to verify every lesson's code runs

**Why it works:** each tutorial step is a complete, runnable example with its own metadata. The metadata schema ensures every lesson has the required fields (difficulty level, prerequisites, etc.).

## API References

When you want to show usage examples alongside API documentation.

**Setup:**

1. Co-locate examples with the code they demonstrate
2. Use region markers to extract specific code sections
3. Reference regions in your API docs

```typescript
// In your example file:
// #region create-client
const client = createApiClient({ baseUrl: 'https://api.example.com' });
// #endregion

// #region make-request
const response = await client.get('/users');
// #endregion
```

Each region can be pulled independently into API reference pages, keeping examples DRY.

## Monorepo Shared Examples

For monorepos where multiple packages share a set of examples.

**Setup:**

1. Place examples at the workspace root under `examples/`
2. Use path mappings to route different directories to different extractors
3. Use metadata tags to organize examples by package

The mixed-plugins example demonstrates this pattern with path mappings routing `src/` files to the JavaScript extractor and `tutorials/` to the YAML manifest extractor.

## Open Source Showcases

For OSS projects that want a gallery of community or first-party examples.

**Setup:**

1. Each example is a standalone project with its own `package.json`
2. Metadata in `package.json` provides title, description, and tags
3. The docs site scans all examples and builds a gallery with filtering
4. CI runs `functional-examples test` to ensure every showcase example works

**Why it works:** contributors can add examples by creating a new directory with a `package.json` — no need to edit a central registry. The scanner discovers them automatically.

## Quick Reference

| Scenario | Plugins | Key Features |
|----------|---------|-------------|
| Doc site | JavaScript + Documentation | Frontmatter or package.json, guide hydration, doc generation |
| Tutorials | YAML Manifest + Test | Multi-file examples, metadata-driven assertions, schemas |
| API reference | JavaScript | Region markers, selective code extraction |
| Monorepo | JavaScript + YAML Manifest | Path mappings, multi-extractor |
| OSS showcase | JavaScript + Test | Auto-discovery, CI testing, gallery metadata |
