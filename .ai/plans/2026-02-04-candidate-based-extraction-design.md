# Candidate-Based Extraction Architecture

**Date:** 2026-02-04
**Status:** Proposed
**Breaking Change:** Yes (major version bump required)

## Overview & Motivation

### The Problem

The current extractor architecture has each extractor independently traverse the entire workspace using its own glob patterns. Include/exclude patterns from config are applied *after* extraction as post-filters on results. This creates several issues:

1. **Redundant work** - Multiple extractors each glob the full tree independently
2. **Unintuitive mental model** - Users expect include/exclude to control what extractors *see*, not filter what they *found*
3. **Limited flexibility** - Extractors can't easily handle both single-file and directory-based examples since they're designed around tree walking

### The Solution

Shift to a **candidates-based model** where:

1. The scanner evaluates include patterns once against the config root
2. Matched entries (files and directories) become "extraction candidates"
3. All extractors receive the same candidate list
4. Each extractor decides which candidates it can handle

This inverts the control flow - the scanner controls *what* to consider, extractors decide *how* to extract from each candidate.

### Benefits

- **Single source of truth** for what's being scanned
- **Intuitive include/exclude** - patterns control extractor input, not output filtering
- **Flexible extractors** - can support single files, directories, or both
- **Reduced I/O** - one glob evaluation instead of N (per extractor)

---

## Extractor Interface Changes

### Current Interface

```typescript
interface Extractor<TMetadata = Record<string, unknown>> {
  readonly name: string;
  extract(
    rootPath: string,
    options?: ExtractorOptions
  ): Promise<ExtractorResult<TMetadata>>;
}

interface ExtractorOptions {
  include?: string[];
  exclude?: string[];
  signal?: AbortSignal;
}
```

### New Interface

```typescript
import { Dirent } from 'node:fs';

interface Extractor<TMetadata = Record<string, unknown>> {
  readonly name: string;
  extract(
    candidates: Dirent[],
    options?: ExtractorOptions
  ): Promise<ExtractorResult<TMetadata>>;
}

interface ExtractorOptions {
  rootPath: string;       // Config root for context/relative path calculations
  exclude?: string[];     // Available for internal filtering within directories
  signal?: AbortSignal;
}
```

### Key Changes

| Aspect | Before | After |
|--------|--------|-------|
| Primary input | `rootPath: string` | `candidates: Dirent[]` |
| Discovery | Extractor does its own glob | Scanner provides candidates |
| Root context | Primary argument | Moved to `options.rootPath` |
| Include patterns | Passed to extractor, often ignored | Evaluated by scanner, not passed |
| Exclude patterns | Passed to extractor | Still passed for internal use |

### ExtractorResult

Unchanged - extractors still return `examples`, `errors`, and `claimedFiles`.

---

## Scanner Orchestration

### Current Flow

```
scanExamples({ root, extractors, include, exclude })
    ↓
Run all extractors in parallel, each with root path
    ↓
Each extractor globs independently
    ↓
Collect results, detect conflicts
    ↓
Apply include/exclude as post-filters on example.rootPath
    ↓
Return filtered results
```

### New Flow

```
scanExamples({ root, extractors, include, exclude })
    ↓
Determine effective include pattern:
  - If include specified: use it
  - Else if examples/ dir exists: default to "examples/*"
  - Else: default to "*"
    ↓
Evaluate include glob against root → Dirent[]
    ↓
Filter out candidates matching exclude patterns
    ↓
Run all extractors in parallel with same candidates
    ↓
Collect results, detect conflicts via claimedFiles
    ↓
Return results (no post-filtering needed)
```

### Glob Evaluation

Uses [tinyglobby](https://github.com/SuperchupuDev/tinyglobby) for pattern matching:

```typescript
import { glob } from 'tinyglobby';

async function resolveCandidates(
  root: string,
  include: string[],
  exclude: string[]
): Promise<Dirent[]> {
  const entries = await glob(include, {
    cwd: root,
    ignore: exclude,
    expandDirectories: false,
    onlyDirectories: false,
    onlyFiles: false,
  });

  // Convert to Dirents if needed based on tinyglobby API
}
```

---

## Default Include Pattern Logic

### Smart Default Behavior

When no `include` pattern is specified in config:

```typescript
async function getDefaultInclude(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });

  const hasExamplesDir = entries.some(
    entry => entry.isDirectory() && entry.name === 'examples'
  );

  return hasExamplesDir ? ['examples/*'] : ['*'];
}
```

### Examples

**Flat structure:**
```
project/
  functional-examples.config.ts
  example-a/
  example-b/
```
→ No `examples/` dir → Default: `['*']` → Candidates: `example-a/`, `example-b/`, `functional-examples.config.ts`

**Nested structure:**
```
project/
  functional-examples.config.ts
  src/
  examples/
    example-a/
    example-b/
```
→ Has `examples/` dir → Default: `['examples/*']` → Candidates: `examples/example-a/`, `examples/example-b/`

### Explicit Override

Users can always set `include` explicitly to override the smart default:

```typescript
const config: Config = {
  scan: {
    include: ['packages/*/examples/*'],
    exclude: ['**/node_modules/**'],
  },
};
```

---

## Extractor Implementation Changes

### Before: Tree-Walking Extractor

```typescript
// yaml-manifest extractor (current)
export const yamlManifestExtractor: Extractor = {
  name: 'yaml-manifest',
  async extract(rootPath, options) {
    // Extractor does its own discovery
    const manifestPaths = await glob('**/meta.yml', {
      cwd: rootPath,
      ignore: options?.exclude,
    });

    const examples: Example[] = [];
    for (const manifestPath of manifestPaths) {
      // ... parse each manifest and build example
    }

    return { examples, errors: [], claimedFiles };
  },
};
```

### After: Candidate-Based Extractor

```typescript
// yaml-manifest extractor (new)
export const yamlManifestExtractor: Extractor = {
  name: 'yaml-manifest',
  async extract(candidates, options) {
    const examples: Example[] = [];
    const errors: ExtractionError[] = [];
    const claimedFiles = new Set<string>();

    for (const candidate of candidates) {
      const fullPath = path.join(candidate.parentPath, candidate.name);

      if (candidate.isFile() && candidate.name === 'meta.yml') {
        // Single file candidate - extract directly
        const result = await this.extractFromManifest(fullPath, options);
        // ... handle result
      } else if (candidate.isDirectory()) {
        // Directory candidate - look for meta.yml inside
        const manifestPath = path.join(fullPath, 'meta.yml');
        if (await fileExists(manifestPath)) {
          const result = await this.extractFromManifest(manifestPath, options);
          // ... handle result
        }
      }
      // else: skip candidates we don't handle
    }

    return { examples, errors, claimedFiles };
  },
};
```

### Key Differences

| Aspect | Before | After |
|--------|--------|-------|
| Discovery | `glob('**/meta.yml')` | Iterate candidates |
| File handling | N/A (only found via glob) | Check `candidate.isFile()` |
| Dir handling | Implicit (glob finds nested files) | Check `candidate.isDirectory()`, then look inside |
| Skipping | Via glob ignore | Just don't process the candidate |

---

## Breaking Changes & Migration

### Breaking Changes

1. **Extractor interface signature** - `extract(rootPath, options)` → `extract(candidates, options)`
2. **Include semantics** - Now controls what extractors see, not post-filter
3. **Default include pattern** - Changes from `['**/*']` to `['*']` or `['examples/*']`

### Migration Path for Plugin Authors

**Minimal migration** - wrap the old logic:

```typescript
// Quick migration: glob within each directory candidate
async extract(candidates, options) {
  const examples: Example[] = [];

  for (const candidate of candidates) {
    if (!candidate.isDirectory()) continue;

    const dirPath = path.join(candidate.parentPath, candidate.name);
    // Fall back to old glob-based discovery within this candidate
    const manifests = await glob('**/meta.yml', {
      cwd: dirPath,
      ignore: options?.exclude
    });

    // ... rest of existing logic
  }

  return { examples, errors: [], claimedFiles };
}
```

**Full migration** - rewrite to handle candidates directly (as shown above).

### User Config Migration

Most configs won't need changes. However, users relying on `**/*` default behavior for deeply nested examples should update:

```typescript
// Before: implicit **/* default found nested examples
// After: explicit pattern needed
const config: Config = {
  scan: {
    include: ['**/my-example-pattern'],
  },
};
```

### Versioning

This is a breaking change → major version bump required.

---

## Implementation Summary

### Files to Modify

1. `packages/functional-examples/src/types/index.ts` - Extractor interface
2. `packages/functional-examples/src/scanner/scanner.ts` - Orchestration logic
3. `packages/functional-examples/src/config/resolver.ts` - Default pattern logic
4. `packages/yaml-manifest/src/extractor.ts` - Migrate extractor
5. `packages/javascript-plugin/src/extractor.ts` - Migrate extractor
6. Any other plugin extractors

### Out of Scope

- Parser pipeline changes
- Metadata validation changes
- CLI interface changes
- Config file format changes

### Design at a Glance

| Component | Change |
|-----------|--------|
| **Include/Exclude** | Pre-filters candidates instead of post-filters results |
| **Extractor input** | `Dirent[]` candidates instead of root path |
| **Extractor options** | `rootPath` moves to options, `include` removed |
| **Default pattern** | `*` or `examples/*` (smart detection) |
| **Glob library** | tinyglobby with `ignore` option |
| **claimedFiles** | Unchanged |
| **ExtractorResult** | Unchanged |
