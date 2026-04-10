---
title: "Templates"
description: "Built-in and custom Eta templates for controlling documentation output."
nav:
  order: 4
---

# Templates

The documentation plugin uses [Eta](https://eta.js.org/) templates to render each example into a documentation page. Built-in templates handle the common case; custom templates let you control every detail.

## Built-in templates

The plugin ships with four templates:

| Template | Type | Format | Description |
|----------|------|--------|-------------|
| `@slug.md.template` | Per-item | Markdown | One page per example |
| `@slug.mdoc.template` | Per-item | Markdoc | One page per example (Markdoc) |
| `index.md.template` | Aggregate | Markdown | Index listing all examples |
| `index.mdoc.template` | Aggregate | Markdoc | Index listing all examples (Markdoc) |

### Per-item templates

Per-item templates contain an `@var` placeholder in their filename. The `@slug` placeholder is replaced with the example's ID at render time. Each scanned example produces one output file.

The `@var` pattern works in directory names too:

```
templates/
  examples/@example/index.md.template
```

This produces nested output like `examples/my-app/index.md`.

### Aggregate templates

Templates without an `@var` placeholder render once with the full list of examples. Use them for index pages, tables of contents, or summary views.

## Template data model

Per-item templates receive an `it` object with these fields:

| Field | Type | Description |
|-------|------|-------------|
| `it.id` | `string` | Example ID |
| `it.title` | `string` | Example title |
| `it.description` | `string \| undefined` | Example description |
| `it.metadata` | `Record<string, unknown>` | Full metadata object |
| `it.files` | `ExampleFile[]` | All example files |
| `it.helpers` | `TemplateHelpers` | Utility functions |
| `it.renderedProse` | `string[]` | Prose files with helpers expanded |
| `it.unconsumedFiles` | `ExampleFile[]` | Files not embedded by prose helpers |

Aggregate templates receive:

| Field | Type | Description |
|-------|------|-------------|
| `it.examples` | `{ id, title, description }[]` | All scanned examples |
| `it.format` | `string` | Output format extension (e.g. `.md`) |
| `it.helpers` | `TemplateHelpers` | Utility functions |

## Template helpers

The `it.helpers` object provides functions useful in both template types:

| Helper | Description |
|--------|-------------|
| `codeBlock(content, lang?, options?)` | Render a fenced code block |
| `langFromPath(filePath)` | Infer language from file extension |
| `region(files, regionId)` | Find a region across files |
| `filesByExt(files, ext)` | Filter files by extension |
| `isProseFile(file)` | Check if a file is prose (`.md`, `.mdx`, etc.) |
| `hunkDescription(metadata, hunkId)` | Look up a region description from `docs.hunks` |
| `slugify(text)` | Convert text to a URL-friendly slug |
| `createFileAccessor(file, title?)` | Create a chainable `FileAccessor` |

## Custom templates

Override the built-in templates by pointing the `templates` option to a directory:

```typescript
createDocumentationPlugin({
  templates: './my-templates',
})
```

Your directory should follow the same naming conventions (`@slug.md.template` for per-item, `index.md.template` for aggregate). The plugin discovers templates recursively.

### Example custom template

A minimal per-item template:

```eta
---
title: "<\%= it.title \%>"
---

# <\%= it.title \%>

<\% if (it.description) { \%>
<\%= it.description \%>
<\% } \%>

<\% it.renderedProse.forEach(function(content) { \%>
<\%= content \%>
<\% }); \%>

<\% it.unconsumedFiles.forEach(function(file) { \%>
## `<\%= file.relativePath \%>`

<\%= it.helpers.codeBlock(file.parsed ?? file.raw ?? '', it.helpers.langFromPath(file.relativePath)) \%>
<\% }); \%>
```

## Consumption tracking

When prose files use `file()` or `region()` helpers, those files are marked as "consumed." The template data splits files into two groups:

- **`renderedProse`** -- prose content with helpers already expanded
- **`unconsumedFiles`** -- code files not yet embedded anywhere

The built-in template renders unconsumed files as additional code blocks after the prose content, so no file is silently dropped.
