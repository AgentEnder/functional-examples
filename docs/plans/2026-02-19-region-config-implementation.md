# Region Config Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move region parsing into the core via a configurable `region` block in `Config`, backed by a default extension map, while simplifying the JS plugin to extractor-only.

**Architecture:** A `RegionConfig` type (devkit) carries `startTag`, `endTag`, and `fileExtensionMap`. `resolveConfig` merges user config over `DEFAULT_REGION_EXTENSION_MAP` and stores the result in `ResolvedConfig.region`. The scanner creates one `createGenericRegionParser` from that config and appends it to every file's pipeline. The JS plugin loses its region and frontmatter parsers; the extractor sets `file.parsed` (frontmatter-stripped) directly.

**Tech Stack:** TypeScript strict ESM, vitest, `path.extname`, no new dependencies.

**Design doc:** `docs/plans/2026-02-19-region-config-design.md`

---

### Task 1: Add `RegionConfig` to devkit types

**Files:**
- Modify: `packages/devkit/src/types/index.ts`

**Step 1: Add `RegionConfig` and update `FileParseContext` and `Config`**

In `packages/devkit/src/types/index.ts`, add `RegionConfig` just before `ScanConfig`, add `regionConfig` to `FileParseContext`, and add `region?` to `Config`. Also override `region` in `ResolvedConfig` to be required (defaults always applied by resolver).

```typescript
// Add before ScanConfig:
/**
 * Configuration for region marker parsing.
 */
export interface RegionConfig {
  /** Token that opens a region. Default: 'region' */
  startTag?: string;
  /** Token that closes a region. Default: 'endregion' */
  endTag?: string;
  /**
   * Map of file extension to an array of regex pattern strings.
   * `{token}` is substituted with startTag or endTag at parse time.
   * Each pattern must contain exactly one capturing group `(\w+)` for the region ID.
   * Multiple patterns per extension support multiple comment styles (e.g. line + block).
   * User entries are merged over the built-in DEFAULT_REGION_EXTENSION_MAP (user wins).
   *
   * @example
   * { '.py': ['#\\s*{token}\\s+(\\w+)'] }
   */
  fileExtensionMap?: Record<string, string[]>;
}
```

In `FileParseContext`, add after `filePath`:
```typescript
  /**
   * Resolved region config from ResolvedConfig.region.
   * Always populated by createInitialContext using defaults if not configured.
   */
  regionConfig: Required<Pick<RegionConfig, 'startTag' | 'endTag'>>;
```

In `Config`, add after `generate?`:
```typescript
  /** Region marker configuration */
  region?: RegionConfig;
```

In `ResolvedConfig`, add after `validationErrors`:
```typescript
  /**
   * Fully resolved region config with defaults applied and extension maps merged.
   * Always present — defaults to startTag:'region', endTag:'endregion'.
   */
  region: Required<RegionConfig>;
```

**Step 2: Build devkit to verify types compile**

```bash
npx nx run @functional-examples/devkit:build
```
Expected: build succeeds with no errors.

**Step 3: Commit**

```bash
git add packages/devkit/src/types/index.ts
git commit -m "feat(devkit): add RegionConfig type, regionConfig to FileParseContext, region to Config"
```

---

### Task 2: Create the default region extension map

**Files:**
- Create: `packages/functional-examples/src/regions/defaults.ts`

**Step 1: Create the file**

```typescript
/**
 * Default region marker patterns for common file extensions.
 *
 * Each entry maps a file extension to an array of regex pattern strings.
 * `{token}` is substituted at parse time with the configured startTag or endTag.
 * The single capturing group `(\w+)` captures the region ID.
 *
 * Multiple patterns per extension support multiple comment styles.
 */
export const DEFAULT_REGION_EXTENSION_MAP: Record<string, string[]> = {
  // JavaScript / TypeScript family — line comment and block comment
  '.ts':   ['\\/\\/\\s*{token}\\s+(\\w+)', '\\/\\*\\s*{token}\\s+(\\w+)\\s*\\*\\/'],
  '.tsx':  ['\\/\\/\\s*{token}\\s+(\\w+)', '\\/\\*\\s*{token}\\s+(\\w+)\\s*\\*\\/'],
  '.js':   ['\\/\\/\\s*{token}\\s+(\\w+)', '\\/\\*\\s*{token}\\s+(\\w+)\\s*\\*\\/'],
  '.jsx':  ['\\/\\/\\s*{token}\\s+(\\w+)', '\\/\\*\\s*{token}\\s+(\\w+)\\s*\\*\\/'],
  '.mjs':  ['\\/\\/\\s*{token}\\s+(\\w+)', '\\/\\*\\s*{token}\\s+(\\w+)\\s*\\*\\/'],
  '.cjs':  ['\\/\\/\\s*{token}\\s+(\\w+)', '\\/\\*\\s*{token}\\s+(\\w+)\\s*\\*\\/'],
  '.mts':  ['\\/\\/\\s*{token}\\s+(\\w+)', '\\/\\*\\s*{token}\\s+(\\w+)\\s*\\*\\/'],
  '.cts':  ['\\/\\/\\s*{token}\\s+(\\w+)', '\\/\\*\\s*{token}\\s+(\\w+)\\s*\\*\\/'],
  // Python / Ruby / Shell — hash line comment
  '.py':   ['#\\s*{token}\\s+(\\w+)'],
  '.rb':   ['#\\s*{token}\\s+(\\w+)'],
  '.sh':   ['#\\s*{token}\\s+(\\w+)'],
  // HTML / XML — block comment
  '.html': ['<!--\\s*{token}\\s+(\\w+)\\s*-->'],
  '.xml':  ['<!--\\s*{token}\\s+(\\w+)\\s*-->'],
  // CSS / SCSS — block comment
  '.css':  ['\\/\\*\\s*{token}\\s+(\\w+)\\s*\\*\\/'],
  '.scss': ['\\/\\*\\s*{token}\\s+(\\w+)\\s*\\*\\/'],
  // SQL / Lua — double-dash line comment
  '.sql':  ['--\\s*{token}\\s+(\\w+)'],
  '.lua':  ['--\\s*{token}\\s+(\\w+)'],
  // Go / Rust / Swift / C# — line comment
  '.go':   ['\\/\\/\\s*{token}\\s+(\\w+)'],
  '.rs':   ['\\/\\/\\s*{token}\\s+(\\w+)'],
  '.swift':['\\/\\/\\s*{token}\\s+(\\w+)'],
  '.cs':   ['\\/\\/\\s*{token}\\s+(\\w+)'],
};
```

**Step 2: Commit**

```bash
git add packages/functional-examples/src/regions/defaults.ts
git commit -m "feat(core): add DEFAULT_REGION_EXTENSION_MAP for common file extensions"
```

---

### Task 3: Implement the generic region parser (TDD)

**Files:**
- Create: `packages/functional-examples/src/regions/parser.spec.ts`
- Create: `packages/functional-examples/src/regions/parser.ts`

**Step 1: Write the failing tests**

Create `packages/functional-examples/src/regions/parser.spec.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { DEFAULT_REGION_EXTENSION_MAP } from './defaults.js';
import { extractRegionFromFileContent } from './parser.js';

const TS_MAP = {
  '.ts': DEFAULT_REGION_EXTENSION_MAP['.ts'],
};

const PY_MAP = {
  '.py': DEFAULT_REGION_EXTENSION_MAP['.py'],
};

describe('extractRegionFromFileContent', () => {
  describe('extension not in map', () => {
    it('returns empty hunks and original content for unknown extension', () => {
      const content = 'hello\nworld';
      const result = extractRegionFromFileContent(content, 'file.txt', {}, 'region', 'endregion');
      expect(result.hunks).toEqual([]);
      expect(result.parsed).toBe(content);
    });
  });

  describe('TypeScript line comments', () => {
    it('extracts a single region', () => {
      const content = [
        'const a = 1;',
        '// region setup',
        'const b = 2;',
        '// endregion setup',
        'const c = 3;',
      ].join('\n');

      const { hunks, parsed } = extractRegionFromFileContent(
        content, 'main.ts', TS_MAP, 'region', 'endregion'
      );

      expect(hunks).toHaveLength(1);
      expect(hunks[0].id).toBe('setup');
      expect(hunks[0].content).toBe('const b = 2;');
      expect(hunks[0].startLine).toBe(2);
      expect(hunks[0].endLine).toBe(4);
      expect(parsed).toBe('const a = 1;\nconst b = 2;\nconst c = 3;');
    });

    it('extracts multiple regions', () => {
      const content = [
        '// region alpha',
        'const a = 1;',
        '// endregion alpha',
        '// region beta',
        'const b = 2;',
        '// endregion beta',
      ].join('\n');

      const { hunks } = extractRegionFromFileContent(
        content, 'main.ts', TS_MAP, 'region', 'endregion'
      );

      expect(hunks).toHaveLength(2);
      expect(hunks[0].id).toBe('alpha');
      expect(hunks[1].id).toBe('beta');
    });

    it('strips region marker lines from parsed output', () => {
      const content = [
        '// region example',
        'const x = 42;',
        '// endregion example',
      ].join('\n');

      const { parsed } = extractRegionFromFileContent(
        content, 'main.ts', TS_MAP, 'region', 'endregion'
      );

      expect(parsed).toBe('const x = 42;');
      expect(parsed).not.toContain('region');
    });

    it('handles endregion without an ID', () => {
      const content = [
        '// region myRegion',
        'const x = 1;',
        '// endregion',
      ].join('\n');

      const { hunks } = extractRegionFromFileContent(
        content, 'main.ts', TS_MAP, 'region', 'endregion'
      );

      expect(hunks).toHaveLength(1);
      expect(hunks[0].id).toBe('myRegion');
    });

    it('handles nested regions', () => {
      const content = [
        '// region outer',
        'const a = 1;',
        '// region inner',
        'const b = 2;',
        '// endregion inner',
        'const c = 3;',
        '// endregion outer',
      ].join('\n');

      const { hunks } = extractRegionFromFileContent(
        content, 'main.ts', TS_MAP, 'region', 'endregion'
      );

      expect(hunks).toHaveLength(2);
      const outer = hunks.find(h => h.id === 'outer')!;
      const inner = hunks.find(h => h.id === 'inner')!;
      expect(outer.content).toContain('const a = 1;');
      expect(outer.content).toContain('const b = 2;');
      expect(inner.content).toBe('const b = 2;');
    });
  });

  describe('TypeScript block comments', () => {
    it('extracts region from block comment syntax', () => {
      const content = [
        '/* region blockExample */',
        'const x = 1;',
        '/* endregion blockExample */',
      ].join('\n');

      const { hunks } = extractRegionFromFileContent(
        content, 'main.ts', TS_MAP, 'region', 'endregion'
      );

      expect(hunks).toHaveLength(1);
      expect(hunks[0].id).toBe('blockExample');
    });
  });

  describe('Python hash comments', () => {
    it('extracts region from Python hash comment syntax', () => {
      const content = [
        '# region setup',
        'x = 1',
        '# endregion setup',
      ].join('\n');

      const { hunks, parsed } = extractRegionFromFileContent(
        content, 'script.py', PY_MAP, 'region', 'endregion'
      );

      expect(hunks).toHaveLength(1);
      expect(hunks[0].id).toBe('setup');
      expect(hunks[0].content).toBe('x = 1');
      expect(parsed).toBe('x = 1');
    });

    it('does not match TypeScript patterns for .py files', () => {
      const content = [
        '// region tsStyle',
        'x = 1',
        '// endregion tsStyle',
      ].join('\n');

      const { hunks } = extractRegionFromFileContent(
        content, 'script.py', PY_MAP, 'region', 'endregion'
      );

      // // comments are not Python style — no match
      expect(hunks).toHaveLength(0);
    });
  });

  describe('custom startTag / endTag', () => {
    it('respects custom tags', () => {
      const customMap = { '.ts': DEFAULT_REGION_EXTENSION_MAP['.ts'] };
      const content = [
        '// mark setup',
        'const x = 1;',
        '// unmark setup',
      ].join('\n');

      const { hunks } = extractRegionFromFileContent(
        content, 'main.ts', customMap, 'mark', 'unmark'
      );

      expect(hunks).toHaveLength(1);
      expect(hunks[0].id).toBe('setup');
    });
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
npx nx run functional-examples:test -- --reporter=verbose 2>&1 | grep -A5 'extractRegionFromFileContent'
```
Expected: FAIL — `Cannot find module './parser.js'`

**Step 3: Implement `extractRegionFromFileContent` and `createGenericRegionParser`**

Create `packages/functional-examples/src/regions/parser.ts`:

```typescript
import type {
  FileContentsParser,
  FileParseContext,
  ParsedRegion,
} from '../types/index.js';
import path from 'node:path';

interface RegionParseResult {
  hunks: ParsedRegion[];
  parsed: string;
}

interface StackEntry {
  id: string;
  startLine: number;
  lines: string[];
}

/**
 * Build the end-pattern regex for a given pattern string and endTag.
 * Makes the ID capture group optional, since `// endregion` (no ID) is valid.
 * Convention: patterns must use `\s+(\w+)` for the ID portion.
 */
function buildEndRegex(pattern: string, endTag: string): RegExp {
  const withToken = pattern.replace('{token}', endTag);
  // Make the space+ID portion optional for end markers
  const withOptional = withToken.replace('\\s+(\\w+)', '(?:\\s+(\\w+))?');
  return new RegExp(withOptional);
}

/**
 * Extract region hunks from file content using the provided extension map.
 *
 * Not exported from barrel files — used directly in tests and by createGenericRegionParser.
 *
 * @param content - File content to parse (should be post-frontmatter-strip if applicable)
 * @param fileName - File name (used to derive extension for map lookup)
 * @param extensionMap - Map of extension → array of regex pattern strings with {token}
 * @param startTag - Token substituted for region start markers
 * @param endTag - Token substituted for region end markers
 * @returns Extracted hunks and content with region marker lines stripped
 */
export function extractRegionFromFileContent(
  content: string,
  fileName: string,
  extensionMap: Record<string, string[]>,
  startTag: string,
  endTag: string,
): RegionParseResult {
  const ext = path.extname(fileName);
  const patterns = extensionMap[ext];

  if (!patterns || patterns.length === 0) {
    return { hunks: [], parsed: content };
  }

  const startRegexes = patterns.map(p => new RegExp(p.replace('{token}', startTag)));
  const endRegexes = patterns.map(p => buildEndRegex(p, endTag));

  const lines = content.split('\n');
  const outputLines: string[] = [];
  const hunks: ParsedRegion[] = [];
  const stack: StackEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Try each start pattern
    let startId: string | undefined;
    for (const regex of startRegexes) {
      const m = line.match(regex);
      if (m?.[1]) {
        startId = m[1];
        break;
      }
    }

    if (startId !== undefined) {
      stack.push({ id: startId, startLine: lineNum, lines: [] });
      continue; // strip marker line from output
    }

    // Try each end pattern
    let isEndMarker = false;
    for (const regex of endRegexes) {
      if (regex.test(line)) {
        isEndMarker = true;
        break;
      }
    }

    if (isEndMarker) {
      const entry = stack.pop();
      if (entry) {
        hunks.push({
          id: entry.id,
          content: entry.lines.join('\n'),
          startLine: entry.startLine,
          endLine: lineNum,
        });
      }
      continue; // strip marker line from output
    }

    // Regular line — add to output and to any open regions
    outputLines.push(line);
    for (const entry of stack) {
      entry.lines.push(line);
    }
  }

  return { hunks, parsed: outputLines.join('\n') };
}

/**
 * Create a FileContentsParser that extracts region hunks for any extension
 * present in the provided extension map. Used by the scanner for all files.
 */
export function createGenericRegionParser(
  extensionMap: Record<string, string[]>,
  startTag: string,
  endTag: string,
): FileContentsParser {
  return {
    name: 'core-region-parser',
    parse(context: FileParseContext): FileParseContext {
      const { hunks, parsed } = extractRegionFromFileContent(
        context.parsed,
        context.filePath,
        extensionMap,
        startTag,
        endTag,
      );
      return { ...context, parsed, hunks };
    },
  };
}
```

**Step 4: Run the tests to confirm they pass**

```bash
npx nx run functional-examples:test -- --reporter=verbose 2>&1 | grep -E '(PASS|FAIL|extractRegion)'
```
Expected: all `extractRegionFromFileContent` tests PASS.

**Step 5: Commit**

```bash
git add packages/functional-examples/src/regions/parser.ts \
        packages/functional-examples/src/regions/parser.spec.ts
git commit -m "feat(core): add extractRegionFromFileContent and createGenericRegionParser"
```

---

### Task 4: Update config schema and resolver

**Files:**
- Modify: `packages/functional-examples/src/config/schema.ts`
- Modify: `packages/functional-examples/src/config/resolver.ts`

**Step 1: Update `ConfigSchema` to include the `region` block**

In `packages/functional-examples/src/config/schema.ts`, add a `RegionConfigSchema` and include it in `ConfigSchema`. The existing `ConfigSchema` function currently validates `{ extractors?, scan?, pathMappings? }`. Add `region?`:

```typescript
// Add after ScanConfigSchema:
export const RegionConfigSchema = z.object({
  startTag: z.string().min(1).optional(),
  endTag: z.string().min(1).optional(),
  fileExtensionMap: z.record(z.string(), z.array(z.string())).optional(),
});
```

In `ConfigSchema`, add `region: RegionConfigSchema.optional()` to the object shape.

**Step 2: Apply defaults and merge extension map in `resolveConfig`**

In `packages/functional-examples/src/config/resolver.ts`:

Add import at the top:
```typescript
import { DEFAULT_REGION_EXTENSION_MAP } from '../regions/defaults.js';
import type { RegionConfig } from '../types/index.js';
```

Add a constant for defaults:
```typescript
const DEFAULT_REGION_TAG = {
  startTag: 'region',
  endTag: 'endregion',
} as const;
```

In the `resolveConfig` function, before the `return { ... }` statement, add:
```typescript
const resolvedRegion: Required<RegionConfig> = {
  startTag: config.region?.startTag ?? DEFAULT_REGION_TAG.startTag,
  endTag: config.region?.endTag ?? DEFAULT_REGION_TAG.endTag,
  fileExtensionMap: {
    ...DEFAULT_REGION_EXTENSION_MAP,
    ...(config.region?.fileExtensionMap ?? {}),
  },
};
```

In the `return` statement, add `region: resolvedRegion` to the returned object.

**Step 3: Build and run tests**

```bash
npx nx run functional-examples:build && npx nx run functional-examples:test
```
Expected: build succeeds, all tests pass.

**Step 4: Commit**

```bash
git add packages/functional-examples/src/config/schema.ts \
        packages/functional-examples/src/config/resolver.ts
git commit -m "feat(core): add region block to config schema, apply defaults in resolveConfig"
```

---

### Task 5: Wire region config into the pipeline and scanner

**Files:**
- Modify: `packages/functional-examples/src/plugins/pipeline.ts`
- Modify: `packages/functional-examples/src/scanner/scanner.ts`

**Step 1: Update `createInitialContext` in `pipeline.ts`**

`createInitialContext` currently takes `(filePath, content)`. Update the signature to accept `regionConfig` and optional `parsed` (for when the extractor has already stripped frontmatter):

```typescript
import type { FileContentsParser, FileParseContext, RegionConfig } from '../types/index.js';

export function createInitialContext(
  filePath: string,
  raw: string,
  regionConfig: Required<Pick<RegionConfig, 'startTag' | 'endTag'>>,
  parsed?: string,
): FileParseContext {
  return {
    raw,
    parsed: parsed ?? raw,
    hunks: [],
    metadata: {},
    filePath,
    regionConfig,
  };
}
```

`runParsePipeline` is unchanged.

**Step 2: Update scanner Step 8 to use generic region parser**

In `packages/functional-examples/src/scanner/scanner.ts`:

Add import at the top:
```typescript
import { createGenericRegionParser } from '../regions/parser.js';
```

Replace the existing Step 8 block (lines 159-177) with:

```typescript
// Step 8: Process file contents through parser pipelines
const regionConfig = {
  startTag: config.region.startTag,
  endTag: config.region.endTag,
};
const genericRegionParser = createGenericRegionParser(
  config.region.fileExtensionMap,
  config.region.startTag,
  config.region.endTag,
);

for (const example of scannedExamples) {
  for (const file of example.files) {
    const ext = path.extname(file.absolutePath);
    const pluginParsers = registry.getParsersForExtension(ext);
    const hasRegionPatterns = ext in config.region.fileExtensionMap;
    const parsers = hasRegionPatterns
      ? [...pluginParsers, genericRegionParser]
      : pluginParsers;

    if (parsers.length > 0) {
      if (file.raw === undefined) {
        file.raw = await fs.readFile(file.absolutePath, 'utf-8');
      }

      const ctx = createInitialContext(
        file.absolutePath,
        file.raw,
        regionConfig,
        file.parsed, // use extractor-set parsed (e.g. frontmatter-stripped) if present
      );
      const result = await runParsePipeline(ctx, parsers);
      file.parsed = result.parsed;
      file.hunks = result.hunks;
    }
  }
}
```

**Step 3: Build and run tests**

```bash
npx nx run functional-examples:build && npx nx run functional-examples:test
```
Expected: build succeeds, all tests pass. The scanner spec and pipeline specs should still pass.

**Step 4: Commit**

```bash
git add packages/functional-examples/src/plugins/pipeline.ts \
        packages/functional-examples/src/scanner/scanner.ts
git commit -m "feat(core): wire regionConfig into pipeline context and scanner"
```

---

### Task 6: Update the JS extractor to set `parsed` (strip frontmatter)

**Files:**
- Modify: `packages/javascript/src/extractor.ts`

**Background:** The extractor already calls `extractLineCommentFrontmatter` / `extractBlockCommentFrontmatter` to get metadata. Both functions already know the `endIndex` of the closing `---` line. We need to expose that index so we can slice it off to produce `parsed`.

**Step 1: Update `FrontmatterResult` and the two extractor helpers to return `endLine`**

In `packages/javascript/src/extractor.ts`, update `FrontmatterResult`:

```typescript
interface FrontmatterResult {
  metadata: Record<string, unknown>;
  /** Index of the closing frontmatter delimiter line (0-based) */
  endLine: number;
}
```

In `extractLineCommentFrontmatter`, change the return to include `endLine`:
```typescript
return { metadata, endLine: endIndex };
```

In `extractBlockCommentFrontmatter`, change the return similarly:
```typescript
return { metadata, endLine: endIndex };
```

**Step 2: Update `extractFrontmatter` to return `endLine` too**

```typescript
async function extractFrontmatter(
  content: string
): Promise<{ metadata: Record<string, unknown>; endLine: number } | null> {
  const lines = content.split('\n');

  const result =
    (await extractLineCommentFrontmatter(lines)) ??
    (await extractBlockCommentFrontmatter(lines));

  if (!result) return null;
  return { metadata: result.metadata, endLine: result.endLine };
}
```

**Step 3: Use `endLine` in `tryExtractFromFile` to set `parsed`**

In `tryExtractFromFile`, after calling `extractFrontmatter`:

```typescript
const frontmatter = await extractFrontmatter(content);
if (!frontmatter || !hasValidMetadata(frontmatter.metadata)) {
  return null;
}

const { id, title, description, ...restMetadata } = frontmatter.metadata;

// Strip frontmatter lines (0..endLine inclusive) to produce clean parsed content
const lines = content.split('\n');
const parsed = lines.slice(frontmatter.endLine + 1).join('\n').trimStart();

const relativePath = path.relative(rootPath, absolutePath);
return {
  // ...
  files: [{ absolutePath, relativePath, raw: content, parsed }],
  // ...
};
```

**Step 4: Build the JS plugin and run tests**

```bash
npx nx run @functional-examples/javascript:build && npx nx run @functional-examples/javascript:test
```
Expected: build and tests pass.

**Step 5: Commit**

```bash
git add packages/javascript/src/extractor.ts
git commit -m "feat(javascript): extractor sets parsed (frontmatter-stripped) on ExampleFile"
```

---

### Task 7: Remove region and frontmatter parsers from the JS plugin

**Files:**
- Delete: `packages/javascript/src/parser.ts`
- Delete: `packages/javascript/src/frontmatter.ts`
- Modify: `packages/javascript/src/index.ts`

**Step 1: Delete the parser files**

```bash
rm packages/javascript/src/parser.ts packages/javascript/src/frontmatter.ts
```

**Step 2: Update `packages/javascript/src/index.ts`**

Remove all references to the deleted files. The updated file should:

- Remove imports of `createJavaScriptParser`, `RegionTagConfig`, `createFrontmatterParser`
- Remove their re-exports
- Remove `skipFrontmatter`, `skipRegions`, `regionTag` from `JavaScriptPluginOptions`
- Remove those fields from `OPTIONS_SCHEMA`
- In `createJavaScriptPlugin`: remove the `parsers` array and `fileContentsParsers` from the returned plugin object

The slimmed `JavaScriptPluginOptions`:
```typescript
export interface JavaScriptPluginOptions {
  /** Skip file extraction/discovery — only contribute parsing (default: false) */
  skipExtraction?: boolean;
}
```

The slimmed `OPTIONS_SCHEMA`:
```typescript
const OPTIONS_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    skipExtraction: {
      type: 'boolean',
      description: 'Skip file extraction/discovery',
    },
  },
});
```

The slimmed `createJavaScriptPlugin`:
```typescript
export function createJavaScriptPlugin(
  options?: JavaScriptPluginOptions
): Plugin {
  const { skipExtraction = false } = options ?? {};

  return {
    name: 'javascript',
    extensions: [...JAVASCRIPT_EXTENSIONS],
    extractor: skipExtraction ? undefined : createJavaScriptExtractor(),
    schemas: {
      options: OPTIONS_SCHEMA,
      metadata: METADATA_SCHEMA,
    },
    validators: {
      metadata: validateMetadata,
    },
    _options: options,
  };
}
```

**Step 3: Build and run all tests**

```bash
npx nx run-many -t build && npx nx run-many -t test
```
Expected: all packages build and all tests pass.

**Step 4: Commit**

```bash
git add packages/javascript/src/index.ts
git commit -m "feat(javascript): remove region and frontmatter parsers — core handles regions now"
```

---

### Task 8: Final verification

**Step 1: Run the full test suite**

```bash
npx nx run-many -t test
```
Expected: all tests pass across all packages.

**Step 2: Run lint**

```bash
npx nx run-many -t lint
```
Expected: no lint errors.

**Step 3: Confirm `region-markers` example still works end-to-end**

```bash
npx nx run functional-examples:test -- --reporter=verbose 2>&1 | grep -i region
```
Expected: region-related tests pass.

**Step 4: Commit if any fixes were needed, then summarise**
