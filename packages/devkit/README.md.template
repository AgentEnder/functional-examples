# @functional-examples/devkit

Plugin development kit for functional-examples — shared types and utilities.

## Installation

```bash
npm install @functional-examples/devkit
```

## Overview

The devkit provides the foundational types and utility modules used by `functional-examples` and its plugins. It's organized into sub-entries so consumers only pull in what they need.

## Sub-Entries

### Types (root)

```typescript
import type { Plugin, Extractor, Config, Example } from '@functional-examples/devkit';
```

Core type definitions: `Plugin`, `Extractor`, `ExtractorResult`, `Config`, `Example`, `ExampleFile`, and more.

### JSON Parsing (`devkit/json`)

```typescript
import { parseJson, tryParseJson, JsonParseError } from '@functional-examples/devkit/json';
```

Async JSON parser with fallback support for JSONC and JSON5 formats. Requires optional peer dependencies `jsonc-parser` and/or `json5` for extended format support.

### Glob Matching (`devkit/glob`)

```typescript
import { glob, isMatch, createMatcher } from '@functional-examples/devkit/glob';
```

File globbing and pattern matching via `tinyglobby` and `picomatch`. Requires peer dependencies `tinyglobby` and `picomatch`.

### YAML Parsing (`devkit/yaml`)

```typescript
import { parseYaml, tryParseYaml, YamlParseError } from '@functional-examples/devkit/yaml';
```

Synchronous YAML parser. Requires peer dependency `yaml`.

## Peer Dependencies

Each sub-entry declares its own peer dependencies:

| Sub-entry | Required peers |
|-----------|---------------|
| `devkit/glob` | `tinyglobby`, `picomatch` |
| `devkit/yaml` | `yaml` |
| `devkit/json` | none (built-in JSON.parse); `jsonc-parser` and/or `json5` for extended formats |

## License

MIT
