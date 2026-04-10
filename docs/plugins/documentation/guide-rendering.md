---
title: "Guide rendering"
description: "Reference files, regions, and metadata from any scanned example in standalone guide documents."
nav:
  order: 3
---

# Guide rendering

Guide rendering expands Eta template references in standalone markdown documents that live outside of any single example. Unlike [prose helpers](../plugins/documentation/prose-helpers) (scoped to one example), the guide renderer provides a cross-example lookup so a single guide can pull code from multiple examples.

## The `example()` helper

Every guide template has access to `example(id)`, which returns an accessor scoped to a specific example:

```
<\%= example('basic-usage').file('scan.ts') \%>
```

The accessor exposes the same capabilities as the per-example prose helpers, plus metadata and structural information:

| Property / Method | Returns | Description |
|---|---|---|
| `.file(path)` | `FileAccessor` | Embed a file as a fenced code block |
| `.file(path).region(id)` | `string` | Embed a scoped region |
| `.region(id)` | `string` | Embed a region (searched across all files) |
| `.metadata.*` | The metadata value | Strict-access metadata (throws on missing keys) |
| `.title` | `string` | The example's title |
| `.description` | `string \| undefined` | The example's description |
| `.files` | `ExampleFile[]` | All files in the example |

## Cross-example references

A single guide can reference multiple examples:

```markdown
## Configuration

<\%= example('basic-usage').file('functional-examples.config.ts') \%>

## Plugin setup

<\%= example('multi-plugin-config').file('functional-examples.config.ts') \%>
```

## Metadata access in guides

Access metadata from any example with the same strict-access proxy used in prose helpers:

```
Category: <\%= example('basic-usage').metadata.category \%>
```

Accessing a property that does not exist on the example's metadata throws an error with the full path and available keys:

```
<\%= example('basic-usage').metadata.typo \%>
<!-- Error: example('basic-usage').metadata.typo is not defined. Available properties: id, title, category -->
```

Nested metadata works the same way:

```
<\%= example('basic-usage').metadata.docs.hunks.setup \%>
```

## Programmatic usage

Create a guide renderer from scanned examples and render markdown strings or files:

```typescript
import { createGuideRenderer } from '@functional-examples/documentation';
import { scan } from 'functional-examples';

const { examples } = await scan({ root: workspaceRoot });
const renderer = createGuideRenderer(examples);

// Render a string
const html = renderer.render('<%= example("basic-usage").file("scan.ts") %>');

// Render a file
const page = await renderer.renderFile('docs/guides/getting-started.md');
```

### Custom helpers

Pass additional helpers via the `customHelpers` option. Each key becomes a top-level variable in the template:

```typescript
const renderer = createGuideRenderer(examples, {
  customHelpers: {
    shout: (s: string) => s.toUpperCase(),
  },
});

// In your guide: <\%= shout("hello") \%> → HELLO
```

**Next:** [Templates](../plugins/documentation/templates) covers the built-in template structure and how to create custom templates.
