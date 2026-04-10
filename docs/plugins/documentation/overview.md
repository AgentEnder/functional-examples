---
title: "Overview"
description: "Generate markdown documentation from scanned examples with templates, prose helpers, and guide rendering."
nav:
  order: 1
---

# Documentation plugin

The documentation plugin (`@functional-examples/documentation`) generates markdown documentation from scanned examples. It provides template-based generation, prose helpers for embedding live code, and guide rendering with cross-example references.

## Installation

```bash
npm install @functional-examples/documentation
```

## Setup

<%= example('documentation-plugin').file('functional-examples.config.ts') %>

### Plugin options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `outputDir` | `string` | `'docs'` | Directory for generated documentation |
| `format` | `'markdown' \| 'mdoc'` | `'markdown'` | Output format |
| `enableExtractor` | `boolean` | `false` | Enable markdown file extraction |

## Generating documentation

The plugin adds a `documentation` CLI command:

<%= example('documentation-plugin').file('generate.sh') %>

Running the command renders templates for each scanned example, producing markdown files in the configured output directory.

### What gets generated

The default template produces output like this for a single example:

<%= example('documentation-plugin').file('__snapshots__/doc-sample.md') %>

The structure includes frontmatter, the title from metadata, a description, and each file's regions rendered as fenced code blocks with syntax highlighting. Snapshot assertions in the example's test suite verify this output.

## Metadata options

Examples control documentation generation via the `docs` metadata field:

| Field | Type | Description |
|-------|------|-------------|
| `docs.skip` | `boolean` | Exclude from generated docs |
| `docs.outputName` | `string` | Override the output filename |
| `docs.template` | `string` | Use a specific template file |
| `docs.hunks` | `object` | Descriptions for named regions |

```yaml
# In meta.yml
docs:
  skip: true          # Don't generate a docs page for this example
  outputName: custom   # Use 'custom.md' instead of 'id.md'
```

**Next:** [Prose helpers](../plugins/documentation/prose-helpers) cover embedding files, regions, and metadata into your documentation.
