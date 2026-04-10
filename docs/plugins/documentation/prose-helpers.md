---
title: "Prose helpers"
description: "Embed files, regions, and metadata into example README files using Eta template tokens."
nav:
  order: 2
---

# Prose helpers

Prose helpers are Eta template functions available inside an example's README or other prose files (`.md`, `.mdx`, `.mdoc`, `.txt`, `.rst`). They let you embed live code and metadata directly into documentation that stays in sync with the source.

## File embedding

Embed an entire file as a fenced code block:

```
<\%= file('path/to/file.ts') \%>
```

The language for syntax highlighting is detected from the file extension. The file is marked as "consumed" so it won't appear a second time in the default template's unconsumed-files section.

### Scoped region from a file

Chain `.region()` to embed a specific region within a file:

```
<\%= file('auth.ts').region('middleware') \%>
```

Regions are marked in source with `#region` / `#endregion` comments (or your configured region markers). The output includes a title like `auth.ts#middleware`.

## Region embedding

Embed a named region without specifying which file it comes from:

```
<\%= region('setup') \%>
```

The helper searches all files in the example for a region with the given ID. If the same region ID exists in multiple files, the render fails with an ambiguity error telling you to use `file('...').region('...')` to disambiguate.

## Metadata tokens

Reference any metadata field defined on the current example:

```
<\%= metadata.category \%>
<\%= metadata.difficulty \%>
```

Metadata is the object from `meta.yml` (or whichever extractor discovered the example). Every field defined on the example is accessible as a property of `metadata`.

### Nested metadata

Nested objects work the same way:

```
<\%= metadata.docs.hunks.setup \%>
```

### Strict access

Accessing a metadata property that does not exist on the example throws an error at render time:

```
<\%= metadata.typo \%>
<!-- Error: metadata.typo is not defined. Available properties: id, title, category -->
```

The error message lists every available property at that level so you can spot typos immediately. Nested paths report the full dot-path:

```
<\%= metadata.docs.nonexistent \%>
<!-- Error: metadata.docs.nonexistent is not defined. Available properties: hunks, skip -->
```

Under the hood, `metadata` is wrapped in a recursive `Proxy`. Arrays, `null`, booleans, and empty strings all pass through normally -- only truly missing keys throw.

### Type safety

Run `functional-examples generate` to produce a `.d.ts` file that augments the `ExampleMetadataRegistry` interface. With that file included in your `tsconfig.json`, your editor provides autocomplete for metadata fields and catches mismatches at compile time.

## Available helpers summary

| Helper | Returns | Side effect |
|--------|---------|-------------|
| `file(path)` | `FileAccessor` (renders via `toString()`) | Marks file consumed |
| `file(path).region(id)` | `string` (fenced code block) | Marks file consumed |
| `region(id)` | `string` (fenced code block) | Marks parent file consumed |
| `metadata.*` | The metadata value | None |
| `files` | `ExampleFile[]` | None |
| `helpers` | Utility functions (`slugify`, `langFromPath`, etc.) | None |

**Next:** [Guide rendering](../plugins/documentation/guide-rendering) covers cross-example references in standalone guide documents.
