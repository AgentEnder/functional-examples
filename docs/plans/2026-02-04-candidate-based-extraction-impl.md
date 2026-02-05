# Candidate-Based Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the extractor architecture from root-path tree walking to candidate-based extraction where the scanner evaluates include patterns and passes pre-filtered Dirent[] candidates to extractors.

**Architecture:** Scanner evaluates include glob at config root, filters by exclude, passes Dirent[] to all extractors. Extractors decide which candidates they can handle (files vs directories). claimedFiles remains for conflict detection.

**Tech Stack:** TypeScript, tinyglobby (new dep), Node.js Dirent

---

## Task 1: Add tinyglobby dependency

**Files:**
- Modify: `packages/functional-examples/package.json`

**Step 1: Add dependency**

```bash
cd packages/functional-examples && pnpm add tinyglobby
```

**Step 2: Verify installation**

```bash
pnpm ls tinyglobby
```

**Step 3: Commit**

```bash
git add packages/functional-examples/package.json pnpm-lock.yaml
git commit -m "chore: add tinyglobby dependency for candidate glob evaluation"
```

---

## Task 2: Update ExtractorOptions and Extractor interface

**Files:**
- Modify: `packages/functional-examples/src/types/index.ts:114-155`

**Step 1: Update ExtractorOptions**

Replace lines 114-121:

```typescript
/**
 * Options passed to extractor during extraction
 */
export interface ExtractorOptions {
  /** Absolute path to the config root (for context/relative paths) */
  rootPath: string;
  /** Glob patterns to exclude (for internal filtering within directories) */
  exclude?: string[];
  /** Signal for cancellation */
  signal?: AbortSignal;
}
```

**Step 2: Update Extractor interface**

Replace lines 135-155:

```typescript
import type { Dirent } from 'node:fs';

/**
 * Candidate-based extractor interface.
 * Called with pre-filtered candidates (files and/or directories).
 * Extractor decides which candidates it can handle.
 */
export interface Extractor<TMetadata = Record<string, unknown>> {
  /** Unique name for this extractor */
  readonly name: string;

  /**
   * Extract examples from the provided candidates.
   * Candidates are pre-filtered by include/exclude patterns.
   *
   * @param candidates - Dirent entries (files and/or directories) to consider
   * @param options - Extraction options including rootPath for context
   * @returns All examples found and files claimed
   */
  extract(
    candidates: Dirent[],
    options: ExtractorOptions
  ): Promise<ExtractorResult<TMetadata>>;
}
```

**Step 3: Add Dirent import at top of file**

Add after line 1:

```typescript
import type { Dirent } from 'node:fs';
```

**Step 4: Commit**

```bash
git add packages/functional-examples/src/types/index.ts
git commit -m "feat!: change Extractor interface to candidate-based (Dirent[])"
```

---

## Task 3: Create candidate resolution utility

**Files:**
- Create: `packages/functional-examples/src/scanner/candidates.ts`
- Create: `packages/functional-examples/src/scanner/candidates.spec.ts`

**Step 1: Write the test file**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { resolveCandidates, getDefaultIncludePattern } from './candidates.js';

describe('resolveCandidates', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'candidates-test-'));
    // Create test structure
    await fs.mkdir(path.join(tempDir, 'example-a'));
    await fs.mkdir(path.join(tempDir, 'example-b'));
    await fs.writeFile(path.join(tempDir, 'single-file.ts'), '// test');
    await fs.mkdir(path.join(tempDir, 'node_modules'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should return immediate children with default * pattern', async () => {
    const candidates = await resolveCandidates(tempDir, ['*'], []);
    const names = candidates.map((c) => c.name).sort();
    expect(names).toContain('example-a');
    expect(names).toContain('example-b');
    expect(names).toContain('single-file.ts');
    expect(names).toContain('node_modules');
  });

  it('should filter by exclude patterns', async () => {
    const candidates = await resolveCandidates(tempDir, ['*'], ['node_modules']);
    const names = candidates.map((c) => c.name);
    expect(names).not.toContain('node_modules');
  });

  it('should handle nested patterns like examples/*', async () => {
    await fs.mkdir(path.join(tempDir, 'examples'));
    await fs.mkdir(path.join(tempDir, 'examples', 'nested-a'));
    await fs.mkdir(path.join(tempDir, 'examples', 'nested-b'));

    const candidates = await resolveCandidates(tempDir, ['examples/*'], []);
    const names = candidates.map((c) => c.name).sort();
    expect(names).toEqual(['nested-a', 'nested-b']);
  });
});

describe('getDefaultIncludePattern', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'default-pattern-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should return ["*"] when no examples directory exists', async () => {
    await fs.mkdir(path.join(tempDir, 'src'));
    const pattern = await getDefaultIncludePattern(tempDir);
    expect(pattern).toEqual(['*']);
  });

  it('should return ["examples/*"] when examples directory exists', async () => {
    await fs.mkdir(path.join(tempDir, 'examples'));
    const pattern = await getDefaultIncludePattern(tempDir);
    expect(pattern).toEqual(['examples/*']);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/functional-examples && pnpm test src/scanner/candidates.spec.ts
```
Expected: FAIL (module not found)

**Step 3: Write the implementation**

```typescript
/**
 * Candidate resolution for the scanner.
 * Evaluates include/exclude patterns and returns Dirent candidates.
 */

import { readdir } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { glob } from 'tinyglobby';
import * as path from 'node:path';

/**
 * Resolve candidates by evaluating include patterns against the root.
 * Returns Dirent entries for files and directories that match.
 *
 * @param root - Absolute path to the config root
 * @param include - Glob patterns to include
 * @param exclude - Glob patterns to exclude
 * @returns Array of Dirent entries
 */
export async function resolveCandidates(
  root: string,
  include: string[],
  exclude: string[]
): Promise<Dirent[]> {
  // Use tinyglobby to match patterns
  const matches = await glob(include, {
    cwd: root,
    ignore: exclude,
    onlyFiles: false,
    expandDirectories: false,
    absolute: false,
  });

  // For each match, we need to get the Dirent
  // Group by parent directory to batch readdir calls
  const parentDirs = new Map<string, Set<string>>();

  for (const match of matches) {
    const parentDir = path.dirname(match);
    const name = path.basename(match);
    const parent = parentDir === '.' ? root : path.join(root, parentDir);

    if (!parentDirs.has(parent)) {
      parentDirs.set(parent, new Set());
    }
    parentDirs.get(parent)!.add(name);
  }

  // Read each parent directory and filter to matched names
  const candidates: Dirent[] = [];

  for (const [parentPath, names] of parentDirs) {
    try {
      const entries = await readdir(parentPath, { withFileTypes: true });
      for (const entry of entries) {
        if (names.has(entry.name)) {
          candidates.push(entry);
        }
      }
    } catch {
      // Directory doesn't exist or can't be read, skip
    }
  }

  return candidates;
}

/**
 * Determine the default include pattern based on directory structure.
 * Returns ['examples/*'] if an examples directory exists, otherwise ['*'].
 *
 * @param root - Absolute path to the config root
 * @returns Default include pattern array
 */
export async function getDefaultIncludePattern(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const hasExamplesDir = entries.some(
      (entry) => entry.isDirectory() && entry.name === 'examples'
    );
    return hasExamplesDir ? ['examples/*'] : ['*'];
  } catch {
    return ['*'];
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
cd packages/functional-examples && pnpm test src/scanner/candidates.spec.ts
```
Expected: PASS

**Step 5: Export from scanner index**

Add to `packages/functional-examples/src/scanner/index.ts` (create if needed):

```typescript
export { resolveCandidates, getDefaultIncludePattern } from './candidates.js';
```

**Step 6: Commit**

```bash
git add packages/functional-examples/src/scanner/candidates.ts packages/functional-examples/src/scanner/candidates.spec.ts
git commit -m "feat: add candidate resolution utility with tinyglobby"
```

---

## Task 4: Update scanner orchestration

**Files:**
- Modify: `packages/functional-examples/src/scanner/scanner.ts`

**Step 1: Add imports**

Add after line 7:

```typescript
import { resolveCandidates, getDefaultIncludePattern } from './candidates.js';
```

**Step 2: Update scanExamples to resolve candidates first**

In the `scanExamples` function, after line 65 (after destructuring options), add candidate resolution:

```typescript
  // Determine effective include pattern
  const effectiveInclude =
    include.length > 0 && include[0] !== '**/*'
      ? include
      : await getDefaultIncludePattern(root);

  // Resolve candidates from include/exclude patterns
  const candidates = await resolveCandidates(root, effectiveInclude, exclude);
```

**Step 3: Update runExtractorsInParallel call**

Change line 100-104 from:

```typescript
  const extractorResults = await runExtractorsInParallel(allExtractors, root, {
    include,
    exclude,
    signal,
  });
```

To:

```typescript
  const extractorResults = await runExtractorsInParallel(
    allExtractors,
    candidates,
    {
      rootPath: root,
      exclude,
      signal,
    }
  );
```

**Step 4: Update runExtractorsInParallel function signature**

Change lines 211-242 to:

```typescript
import type { Dirent } from 'node:fs';

async function runExtractorsInParallel<TMetadata>(
  extractors: Extractor<TMetadata>[],
  candidates: Dirent[],
  options: { rootPath: string; exclude?: string[]; signal?: AbortSignal }
): Promise<Array<ExtractorResult<TMetadata> & { extractorName: string }>> {
  const results = await Promise.all(
    extractors.map(async (extractor) => {
      try {
        const result = await extractor.extract(candidates, options);
        return { ...result, extractorName: extractor.name };
      } catch (error) {
        return {
          examples: [] as Example<TMetadata>[],
          errors: [
            {
              path: options.rootPath,
              message: `Extractor "${extractor.name}" failed: ${
                (error as Error).message
              }`,
              cause: error as Error,
            },
          ],
          claimedFiles: new Set<string>(),
          extractorName: extractor.name,
        };
      }
    })
  );

  return results;
}
```

**Step 5: Remove applyFilters call (no longer needed)**

Line 122 - remove or comment out since filtering now happens before extraction:

```typescript
  // Filters now applied at candidate resolution, not post-extraction
  const finalExamples = filteredExamples;
```

**Step 6: Commit**

```bash
git add packages/functional-examples/src/scanner/scanner.ts
git commit -m "feat!: update scanner to resolve candidates before extraction"
```

---

## Task 5: Migrate yaml-manifest extractor

**Files:**
- Modify: `packages/yaml-manifest/src/extractor.ts`

**Step 1: Update imports**

Replace imports to include Dirent:

```typescript
import type { Dirent } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import path from 'node:path';
import type {
  Extractor,
  ExtractorOptions,
  ExtractorResult,
  Example,
  ExampleFile,
  ExtractorError,
} from 'functional-examples';
```

Remove fast-glob import (no longer needed at top level).

**Step 2: Update extract method signature**

Change the extract method (lines 82-148) to:

```typescript
    async extract(
      candidates: Dirent[],
      options: ExtractorOptions
    ): Promise<ExtractorResult> {
      const examples: Example[] = [];
      const errors: ExtractorError[] = [];
      const claimedFiles = new Set<string>();

      for (const candidate of candidates) {
        // Check for abort signal
        if (options.signal?.aborted) {
          break;
        }

        const fullPath = path.join(candidate.parentPath, candidate.name);

        // Handle file candidates - check if it's a meta.yml file directly
        if (candidate.isFile() && candidate.name === options.metaFileName) {
          try {
            const result = await this.extractFromManifest(
              fullPath,
              path.dirname(fullPath),
              options
            );
            if (result) {
              examples.push(result.example);
              for (const f of result.claimedFiles) {
                claimedFiles.add(f);
              }
            }
          } catch (error) {
            errors.push({
              path: fullPath,
              message: (error as Error).message,
              cause: error as Error,
            });
          }
          continue;
        }

        // Handle directory candidates - look for meta.yml inside
        if (candidate.isDirectory()) {
          const metaPath = path.join(fullPath, options.metaFileName);
          try {
            const result = await this.extractFromManifest(
              metaPath,
              fullPath,
              options
            );
            if (result) {
              examples.push(result.example);
              for (const f of result.claimedFiles) {
                claimedFiles.add(f);
              }
            }
          } catch {
            // No meta.yml in this directory, skip
          }
        }
      }

      return { examples, errors, claimedFiles };
    },
```

**Step 3: Add extractFromManifest helper method**

Add inside the returned object, after the extract method:

```typescript
    async extractFromManifest(
      metaPath: string,
      exampleDir: string,
      extractorOptions: ExtractorOptions
    ): Promise<{ example: Example; claimedFiles: string[] } | null> {
      const metaContent = await readFile(metaPath, 'utf-8');
      const metadata = parseYaml(metaContent) as Record<string, unknown>;

      const dirName = path.basename(exampleDir);
      const id = (metadata.id as string) ?? dirName;

      const files = await collectFiles(
        exampleDir,
        [...options.excludeFiles, options.metaFileName],
        options.excludePatterns
      );

      const claimedFiles = [metaPath, ...files.map((f) => f.absolutePath)];

      const example: Example = {
        id,
        title: (metadata.title as string) ?? dirName,
        description: metadata.description as string | undefined,
        rootPath: exampleDir,
        files,
        metadata,
        extractorName: 'meta-yml',
      };

      return { example, claimedFiles };
    },
```

**Step 4: Update the function to use closure for options**

The extractor needs access to `options` (the MetaYmlExtractorOptions) in the helper. Restructure slightly:

```typescript
export function createMetaYmlExtractor(
  opts?: MetaYmlExtractorOptions
): Extractor {
  const options = { ...DEFAULT_OPTIONS, ...opts };

  async function extractFromManifest(
    metaPath: string,
    exampleDir: string
  ): Promise<{ example: Example; claimedFiles: string[] }> {
    const metaContent = await readFile(metaPath, 'utf-8');
    const metadata = parseYaml(metaContent) as Record<string, unknown>;

    const dirName = path.basename(exampleDir);
    const id = (metadata.id as string) ?? dirName;

    const files = await collectFiles(
      exampleDir,
      [...options.excludeFiles, options.metaFileName],
      options.excludePatterns
    );

    const claimedFiles = [metaPath, ...files.map((f) => f.absolutePath)];

    return {
      example: {
        id,
        title: (metadata.title as string) ?? dirName,
        description: metadata.description as string | undefined,
        rootPath: exampleDir,
        files,
        metadata,
        extractorName: 'meta-yml',
      },
      claimedFiles,
    };
  }

  return {
    name: 'meta-yml',

    async extract(
      candidates: Dirent[],
      extractorOpts: ExtractorOptions
    ): Promise<ExtractorResult> {
      const examples: Example[] = [];
      const errors: ExtractorError[] = [];
      const claimedFiles = new Set<string>();

      for (const candidate of candidates) {
        if (extractorOpts.signal?.aborted) break;

        const fullPath = path.join(candidate.parentPath, candidate.name);

        // File candidate: check if it's our meta file
        if (candidate.isFile() && candidate.name === options.metaFileName) {
          try {
            const result = await extractFromManifest(
              fullPath,
              path.dirname(fullPath)
            );
            examples.push(result.example);
            result.claimedFiles.forEach((f) => claimedFiles.add(f));
          } catch (error) {
            errors.push({
              path: fullPath,
              message: (error as Error).message,
              cause: error as Error,
            });
          }
          continue;
        }

        // Directory candidate: look for meta file inside
        if (candidate.isDirectory()) {
          const metaPath = path.join(fullPath, options.metaFileName);
          try {
            const result = await extractFromManifest(metaPath, fullPath);
            examples.push(result.example);
            result.claimedFiles.forEach((f) => claimedFiles.add(f));
          } catch {
            // No meta file in this directory, skip silently
          }
        }
      }

      return { examples, errors, claimedFiles };
    },
  };
}
```

**Step 5: Run extractor tests**

```bash
cd packages/yaml-manifest && pnpm test
```

**Step 6: Commit**

```bash
git add packages/yaml-manifest/src/extractor.ts
git commit -m "feat!: migrate yaml-manifest extractor to candidate-based"
```

---

## Task 6: Migrate javascript extractor

**Files:**
- Modify: `packages/javascript/src/extractor.ts`

**Step 1: Update imports**

Add Dirent import:

```typescript
import type { Dirent } from 'node:fs';
```

Remove fast-glob import.

**Step 2: Update extract method**

Replace lines 179-258:

```typescript
    async extract(
      candidates: Dirent[],
      options: ExtractorOptions
    ): Promise<ExtractorResult> {
      const examples: Example[] = [];
      const claimedFiles = new Set<string>();

      for (const candidate of candidates) {
        if (options.signal?.aborted) break;

        const fullPath = path.join(candidate.parentPath, candidate.name);

        // Handle file candidates directly
        if (candidate.isFile()) {
          const ext = path.extname(candidate.name);
          if (!FILE_EXTENSIONS.includes(ext)) continue;

          const example = await this.tryExtractFromFile(fullPath, options.rootPath);
          if (example) {
            examples.push(example);
            claimedFiles.add(fullPath);
          }
          continue;
        }

        // Handle directory candidates - scan for JS/TS files inside
        if (candidate.isDirectory()) {
          const dirExamples = await this.extractFromDirectory(
            fullPath,
            options
          );
          for (const { example, filePath } of dirExamples) {
            examples.push(example);
            claimedFiles.add(filePath);
          }
        }
      }

      return { examples, errors: [], claimedFiles };
    },
```

**Step 3: Add helper methods**

Add these as part of the extractor object or as closures:

```typescript
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'];

// Inside createJavaScriptExtractor, before return:

async function tryExtractFromFile(
  absolutePath: string,
  rootPath: string
): Promise<Example | null> {
  let content: string;
  try {
    content = await fs.readFile(absolutePath, 'utf-8');
  } catch {
    return null;
  }

  const metadata = extractFrontmatter(content);
  if (!metadata || !hasValidMetadata(metadata)) {
    return null;
  }

  const { id, title, description, ...restMetadata } = metadata;
  const relativePath = path.relative(rootPath, absolutePath);

  return {
    id,
    title,
    description: typeof description === 'string' ? description : undefined,
    rootPath: absolutePath,
    files: [{ absolutePath, relativePath, raw: content }],
    metadata: restMetadata,
    extractorName: EXTRACTOR_NAME,
  };
}

async function extractFromDirectory(
  dirPath: string,
  options: ExtractorOptions
): Promise<Array<{ example: Example; filePath: string }>> {
  const results: Array<{ example: Example; filePath: string }> = [];

  const excludePatterns = [
    ...DEFAULT_EXCLUDE_PATTERNS,
    ...(options.exclude ?? []),
  ];

  // Use fast-glob to find JS/TS files in this directory
  const files = await fg(FILE_PATTERNS, {
    cwd: dirPath,
    absolute: true,
    ignore: excludePatterns,
  });

  for (const filePath of files) {
    if (options.signal?.aborted) break;

    const example = await tryExtractFromFile(filePath, options.rootPath);
    if (example) {
      results.push({ example, filePath });
    }
  }

  return results;
}
```

**Step 4: Run tests**

```bash
cd packages/javascript && pnpm test
```

**Step 5: Commit**

```bash
git add packages/javascript/src/extractor.ts
git commit -m "feat!: migrate javascript extractor to candidate-based"
```

---

## Task 7: Update scanner tests

**Files:**
- Modify: `packages/functional-examples/src/scanner/scanner.spec.ts`

**Step 1: Update mock extractor to use new interface**

The mock extractors in tests need to accept `Dirent[]` instead of `rootPath`:

```typescript
function createMockExtractor(
  name: string,
  examples: Example[],
  claimedFiles: Set<string> = new Set()
): Extractor {
  return {
    name,
    async extract(candidates: Dirent[], options: ExtractorOptions) {
      return { examples, errors: [], claimedFiles };
    },
  };
}
```

**Step 2: Update test setup to provide Dirent-compatible mocks if needed**

Tests may need adjustments to work with the new candidate-based flow.

**Step 3: Run all scanner tests**

```bash
cd packages/functional-examples && pnpm test src/scanner/
```

**Step 4: Commit**

```bash
git add packages/functional-examples/src/scanner/scanner.spec.ts
git commit -m "test: update scanner tests for candidate-based extraction"
```

---

## Task 8: Update config resolver defaults

**Files:**
- Modify: `packages/functional-examples/src/config/resolver.ts:53-56`

**Step 1: Update DEFAULT_SCAN**

Change from `['**/*']` to `['*']` as the new default (smart detection handled in scanner):

```typescript
const DEFAULT_SCAN: Required<ScanConfig> = {
  include: ['*'],
  exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
};
```

Note: The actual smart detection (examples/* vs *) happens in the scanner when include is ['*'].

**Step 2: Commit**

```bash
git add packages/functional-examples/src/config/resolver.ts
git commit -m "feat: update default include pattern to * (smart detection in scanner)"
```

---

## Task 9: Update example custom extractor

**Files:**
- Modify: `examples/custom-extractor/toml-extractor.ts`

**Step 1: Update to candidate-based interface**

Similar pattern to yaml-manifest - accept Dirent[], handle files and directories.

**Step 2: Commit**

```bash
git add examples/custom-extractor/toml-extractor.ts
git commit -m "docs: update custom extractor example for candidate-based API"
```

---

## Task 10: Run full test suite and fix issues

**Step 1: Run all tests**

```bash
pnpm test
```

**Step 2: Fix any failing tests**

Address test failures from the interface changes.

**Step 3: Run linting**

```bash
pnpm lint
```

**Step 4: Final commit**

```bash
git add -A
git commit -m "test: fix remaining tests after candidate-based extraction migration"
```

---

## Task 11: Update type exports

**Files:**
- Modify: `packages/functional-examples/src/index.ts`

**Step 1: Ensure Dirent is re-exported or documented**

Users creating custom extractors need to know about the Dirent type. Add a note or re-export if needed.

**Step 2: Commit**

```bash
git add packages/functional-examples/src/index.ts
git commit -m "chore: update exports for candidate-based extraction"
```

---

## Summary

| Task | Description | Dependencies |
|------|-------------|--------------|
| 1 | Add tinyglobby | None |
| 2 | Update types | None |
| 3 | Create candidate util | 1 |
| 4 | Update scanner | 2, 3 |
| 5 | Migrate yaml-manifest | 2 |
| 6 | Migrate javascript | 2 |
| 7 | Update scanner tests | 4 |
| 8 | Update config defaults | None |
| 9 | Update example | 2 |
| 10 | Full test suite | All |
| 11 | Update exports | All |

**Parallel opportunities:**
- Tasks 5, 6 can run in parallel (both depend on Task 2)
- Task 8 can run any time
- Task 9 can run after Task 2
