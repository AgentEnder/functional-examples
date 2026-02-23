# @functional-examples/devkit

Plugin development kit for functional-examples — shared types and utilities.

## Installation

```bash
npm install @functional-examples/devkit

```

## Overview

The devkit provides the foundational types and utility modules used by `functional-examples` and its plugins.

## Usage

### Types (root)

```typescript
import type {
  Config,
  Example,
  Extractor,
  Plugin,
} from '@functional-examples/devkit';

```

Core type definitions: `Plugin`, `Extractor`, `ExtractorResult`, `Config`, `Example`, `ExampleFile`, and more.

### Utilities (root)

```typescript
import {
  createMatcher,
  glob,
  isMatch,
  JsonParseError,
  parseJson,
  parseYaml,
  tryParseJson,
  tryParseYaml,
  YamlParseError,
} from '@functional-examples/devkit';

```

Includes JSON parsing (`parseJson`, `tryParseJson`, `JsonParseError`), YAML parsing (`parseYaml`, `tryParseYaml`, `YamlParseError`), and glob helpers (`glob`, `isMatch`, `createMatcher`) from the root import.

## Peer Dependencies

The utility helpers rely on optional peer dependencies:

| Utility area | Optional peers |
|--------------|----------------|
| Glob helpers | `tinyglobby`, `picomatch` |
| YAML parser | `yaml` |
| JSON parser | `jsonc-parser` and/or `json5` for extended formats |

## License

MIT
