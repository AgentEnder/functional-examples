# @functional-examples/documentation

Documentation generation plugin for functional-examples.

## Installation

```bash
npm install @functional-examples/documentation

```

## Overview

This plugin generates documentation from your scanned examples using customizable templates. It supports both Markdown and Markdoc output formats, with Eta-powered template rendering.

## Usage

```typescript
import { createDocumentationPlugin } from '@functional-examples/documentation';
import { createJavaScriptPlugin } from '@functional-examples/javascript';
import type { Config } from 'functional-examples';

/**
 * Configuration demonstrating the documentation plugin.
 *
 * The documentation plugin:
 * - Adds the `generate` CLI command
 * - Enables template-based doc generation
 * - Provides prose helpers (file(), region(), fencedBlock())
 */
const config: Config = {
  plugins: [
    createJavaScriptPlugin(),
    createDocumentationPlugin({
      outputDir: 'generated-docs',
      format: 'markdown',
    }),
  ],
  scan: {
    include: ['src/**/*'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
};

export default config;

```

## Features

- **Template-based generation**: Eta templates for full control over output
- **Per-example templates**: Override the template for specific examples
- **Prose file rendering**: README.md files in examples are rendered with helper expansion
- **Region references**: Use `file()` and `region()` helpers in prose to embed code
- **Guide hydration**: Expand cross-example references in standalone guide documents
- **Check mode**: CI-friendly `--check` flag to verify docs are up-to-date
- **Multiple formats**: Markdown and Markdoc output

## Template Helpers

Inside prose files (README.md in examples), use:

```markdown
<%= file('utils.ts') %>       <% /* Embed a file as a fenced code block */ %>
<%= region('setup') %>        <% /* Embed a code region */ %>

```

Inside guide documents, reference any example:

```markdown
<%= example('basic-usage').file('scan.ts') %>
<%= example('basic-usage').region('scan') %>

```

## License

MIT
