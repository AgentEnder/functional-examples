# @functional-examples/yaml-manifest

YAML manifest extractor plugin for multi-file examples in functional-examples.

## Installation

```bash
npm install @functional-examples/yaml-manifest
```

## Overview

This plugin enables directory-based example discovery using `meta.yml` manifest files. Each example directory contains a `meta.yml` that declares the example's metadata and file structure.

## Usage

```typescript
import { createYamlManifestPlugin } from '@functional-examples/yaml-manifest';
import type { Config } from 'functional-examples';

/**
 * Configuration for the YAML manifest example.
 *
 * This example demonstrates directory-based example organization where
 * each example is a folder containing:
 * - meta.yml (or meta.yaml) with metadata
 * - Source files for the example
 *
 * Benefits of this approach:
 * - Multi-file examples are natural (just add more files)
 * - Metadata is separate from code (no frontmatter comments)
 * - Works with any file type (not just JS/TS)
 */
const config: Config = {
  plugins: [createYamlManifestPlugin()],
  scan: {
    include: ['**/*'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
};

export default config;

```

## Manifest Format

Create a `meta.yml` file in each example directory:

```yaml
id: my-example
title: My Example
description: Demonstrates a multi-file pattern
tags:
  - tutorial
  - typescript
```

### Directory Structure

```
examples/
  my-example/
    meta.yml
    main.ts
    utils.ts
    README.md
```

## Features

- **Multi-file examples**: Group related files under a single example
- **Entry point declaration**: Specify which file is the main entry
- **Rich metadata**: Title, description, tags, and custom fields
- **README support**: Include prose documentation alongside code

## License

MIT
