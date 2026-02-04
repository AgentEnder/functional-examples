# Plan 01: Initial Library Setup

## Status: In Progress

## Overview

Create the functional-examples library with a language-agnostic API for discovering, parsing, and extracting code examples from a codebase.

## Goals

1. Extract proven patterns from isolated-workers, cli-forge, and flexibench
2. Create a pluggable metadata extraction system
3. Support language-aware region parsing
4. Provide a clean, type-safe public API

## Key Requirements

### Functional Requirements

- Scan directories for examples (meta.yml or frontmatter-based)
- Extract metadata from YAML frontmatter (cli-forge style) or meta.yml (isolated-workers style)
- Parse code regions using language-appropriate comment syntax
- Support 30+ programming languages for region detection
- Provide file reading helpers with optional region extraction

### Non-Functional Requirements

- Zero runtime dependencies beyond YAML parser
- Full TypeScript type safety with generic metadata support
- < 50kb minified bundle size
- Works in Node.js and potentially browsers (file reading excluded)

## Success Criteria

- [ ] Repository structure mirrors isolated-workers
- [ ] Build/lint/test all pass
- [ ] Core types defined (Example, ExampleFile, BaseMetadata)
- [ ] Pluggable extractor system working
- [ ] Region extraction supports JS, Python, SQL, HTML at minimum
- [ ] Scanner can discover examples recursively
- [ ] Library can scan its own examples/ folder (dogfooding)

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Metadata format | Pluggable extractors | Different projects use different patterns |
| Region markers | Language-aware | Same `#region` concept, different comment syntax |
| Core scope | Minimal | Scanner, extractors, regions - no framework code |
| Package naming | `functional-examples` | Clear, descriptive, npm-available |

## Source References

- Region parsing: `/Users/agentender/repos/isolated-workers/docs-site/server/utils/regions.ts`
- Scanner: `/Users/agentender/repos/isolated-workers/docs-site/server/utils/examples.ts`
- YAML frontmatter: `/Users/agentender/repos/cli-forge/tools/scripts/collect-examples.ts`
- Meta.yml schema: `/Users/agentender/repos/isolated-workers/examples/basic-ping/meta.yml`
