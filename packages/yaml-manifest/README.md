# @functional-examples/yaml-manifest

YAML manifest extractor plugin for multi-file examples in functional-examples.

## Installation

```bash
npm install @functional-examples/yaml-manifest

```

## Overview

This plugin enables directory-based example discovery using `meta.yml` manifest files. Each example directory contains a `meta.yml` that declares the example's metadata and file structure.

## Usage

```json
{
  "$schema": "./.functional-examples/schema.json",
  "scan": {
    "include": ["examples/**/*"],
    "exclude": ["**/node_modules/**", "**/dist/**"]
  }
}

```

## Manifest Format

Create a `meta.yml` file in each example directory:

```yaml
id: basic-usage
title: Basic Usage
description: |
  Demonstrates scanning for examples in a directory
  using the functional-examples library.
tags:
  - getting-started
  - api

```

### Directory Structure

```txt
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
