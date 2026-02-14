---
title: "Documentation Plugin"
description: "Generate markdown documentation from scanned examples with templates, prose helpers, and guide rendering."
nav:
  order: 4
---

# Documentation Plugin

The documentation plugin (`@functional-examples/documentation`) generates markdown documentation from scanned examples. It provides template-based generation, prose helpers for embedding code, and guide rendering with cross-example references.

## Installation

```bash
npm install @functional-examples/documentation
```

## Setup

<%= example('documentation-plugin').file('functional-examples.config.ts') %>

### Plugin Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `outputDir` | `string` | `'docs'` | Directory for generated documentation |
| `format` | `'markdown' \| 'mdoc'` | `'markdown'` | Output format |
| `enableExtractor` | `boolean` | `false` | Enable markdown file extraction |

## Generating Documentation

The documentation plugin adds the `documentation` CLI command:

<%= example('documentation-plugin').file('generate.sh') %>

This renders templates for each scanned example, producing markdown files in the configured output directory.

### What Gets Generated

Here's what the default template produces for a single example:

<%= example('documentation-plugin').file('__snapshots__/doc-sample.md') %>

Notice the structure: frontmatter, title from metadata, description, then each file's regions rendered as fenced code blocks with syntax highlighting. This output is verified by a snapshot assertion in the example's test suite.

### Built-in vs Custom Templates

The plugin ships with a default template that renders example metadata, files, and regions. You can override templates via the `templates` option for custom formatting.

## Prose Helpers

When rendering guides or README files, the documentation plugin provides Eta template helpers:

### File Embedding

```
<\%= example('my-example').file('path/to/file.ts') \%>
```

Embeds the entire file contents as a fenced code block with syntax highlighting.

### Region Embedding

```
<\%= example('my-example').region('regionName') \%>
```

Embeds a named code region (marked with `#region` / `#endregion` in source).

### Fenced Block

```
<%= fencedBlock(content, 'typescript') %>
```

Wraps content in a markdown fenced code block with the specified language.

## Guide Rendering

The documentation plugin powers the guide rendering system. Guides use Eta tags to reference live example code:

```markdown
Here's how to configure the scanner:

<%= example('basic-usage').file('scan.ts') %>
```

When rendered, the tag is replaced with the actual file contents from the scanned examples. This ensures documentation stays in sync with real code.

## Metadata Options

Examples can control documentation generation via the `docs` metadata field:

| Field | Type | Description |
|-------|------|-------------|
| `docs.skip` | `boolean` | Exclude this example from generated docs |
| `docs.outputName` | `string` | Override the output filename |
| `docs.template` | `string` | Use a specific template |
| `docs.hunks` | `object` | Configure which regions to include |

```yaml
# In meta.yml
docs:
  skip: true          # Don't generate a docs page for this example
  outputName: custom   # Use 'custom.md' instead of 'id.md'
```

**See also:** [Plugin Authoring](../advanced/plugin-authoring) for creating plugins that contribute to docs, [CI Integration](../advanced/ci-integration) for generating docs in CI.
