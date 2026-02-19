# Region Config Design

**Date:** 2026-02-19
**Status:** Approved

## Problem

Region parsing (extracting `#region`/`#endregion` hunks from files) was originally split across two places:

- A `regions/` module in the core package (now deleted — it was dead code)
- A `FileContentsParser` inside `@functional-examples/javascript` that only understood JS/TS comment syntax

This meant users couldn't get hunks for `.py`, `.sh`, `.html`, or any other file type without writing a custom plugin. It also confused the responsibility boundary: the JS plugin's parser was doing something the core should own.

## Goals

1. Move region parsing into the core so it works for any file extension out of the box
2. Make the start/end tag keywords configurable at the top level of `Config`
3. Let users add or override patterns for arbitrary extensions via `fileExtensionMap`
4. Ship sensible defaults for ~15 common languages in the core package
5. Simplify `@functional-examples/javascript` — strip out its region and frontmatter parsers

## Non-Goals

- Per-plugin region tag overrides (removed; plugins read the global config)
- Backwards compatibility (nothing is published yet)

## Architecture

### Responsibility boundaries (corrected)

| Concern | Owner |
|---|---|
| Metadata extraction (frontmatter → `id`, `title`, etc.) | Extractor |
| Stripping frontmatter from `parsed` content | Extractor (sets `parsed` when building `ExampleFile`) |
| Region extraction → `hunks` | Core generic region parser (via `fileExtensionMap`) |
| Custom region syntax for exotic file types | Plugin `fileContentsParsers` (opt-in, rarely needed) |

`FileContentsParser` implementations in plugins are now region-only. Most plugins will have none.

### New `RegionConfig` type (devkit)

```typescript
interface RegionConfig {
  /** Token that opens a region. Default: 'region' */
  startTag?: string;
  /** Token that closes a region. Default: 'endregion' */
  endTag?: string;
  /**
   * Map of file extension → array of regex pattern strings.
   * `{token}` is substituted with startTag or endTag at parse time.
   * Each pattern must have exactly one capturing group for the region ID.
   * Multiple patterns per extension support multiple comment styles.
   *
   * User entries are merged over DEFAULT_REGION_EXTENSION_MAP (user wins).
   */
  fileExtensionMap?: Record<string, string[]>;
}
```

`Config` gains `region?: RegionConfig`.

### `FileParseContext` update (devkit)

```typescript
interface FileParseContext {
  raw: string;
  parsed: string;
  hunks: ParsedRegion[];
  metadata: Record<string, unknown>;
  filePath: string;
  /** Always present; defaults applied by createInitialContext */
  regionConfig: Required<Pick<RegionConfig, 'startTag' | 'endTag'>>;
}
```

`regionConfig` is always populated so plugin parsers can read it without null-checking.

### Default extension map (core)

Defined in `packages/functional-examples/src/regions/defaults.ts`. A representative sample:

```typescript
export const DEFAULT_REGION_EXTENSION_MAP: Record<string, string[]> = {
  // JS/TS family — line and block comments
  '.ts':   ['\\/\\/\\s*{token}\\s+(\\w+)', '\\/\\*\\s*{token}\\s+(\\w+)\\s*\\*\\/'],
  '.tsx':  ['\\/\\/\\s*{token}\\s+(\\w+)', '\\/\\*\\s*{token}\\s+(\\w+)\\s*\\*\\/'],
  '.js':   ['\\/\\/\\s*{token}\\s+(\\w+)', '\\/\\*\\s*{token}\\s+(\\w+)\\s*\\*\\/'],
  '.jsx':  ['\\/\\/\\s*{token}\\s+(\\w+)', '\\/\\*\\s*{token}\\s+(\\w+)\\s*\\*\\/'],
  '.mjs':  ['\\/\\/\\s*{token}\\s+(\\w+)', '\\/\\*\\s*{token}\\s+(\\w+)\\s*\\*\\/'],
  '.cjs':  ['\\/\\/\\s*{token}\\s+(\\w+)', '\\/\\*\\s*{token}\\s+(\\w+)\\s*\\*\\/'],
  '.mts':  ['\\/\\/\\s*{token}\\s+(\\w+)', '\\/\\*\\s*{token}\\s+(\\w+)\\s*\\*\\/'],
  '.cts':  ['\\/\\/\\s*{token}\\s+(\\w+)', '\\/\\*\\s*{token}\\s+(\\w+)\\s*\\*\\/'],
  // Python / Ruby / Shell — hash comments
  '.py':   ['#\\s*{token}\\s+(\\w+)'],
  '.rb':   ['#\\s*{token}\\s+(\\w+)'],
  '.sh':   ['#\\s*{token}\\s+(\\w+)'],
  // HTML / XML — block comments
  '.html': ['<!--\\s*{token}\\s+(\\w+)\\s*-->'],
  '.xml':  ['<!--\\s*{token}\\s+(\\w+)\\s*-->'],
  // CSS / SCSS — block comments
  '.css':  ['\\/\\*\\s*{token}\\s+(\\w+)\\s*\\*\\/'],
  '.scss': ['\\/\\*\\s*{token}\\s+(\\w+)\\s*\\*\\/'],
  // SQL / Lua — double-dash
  '.sql':  ['--\\s*{token}\\s+(\\w+)'],
  '.lua':  ['--\\s*{token}\\s+(\\w+)'],
  // Go / Rust / Swift — line comments
  '.go':   ['\\/\\/\\s*{token}\\s+(\\w+)'],
  '.rs':   ['\\/\\/\\s*{token}\\s+(\\w+)'],
  '.swift':['\\/\\/\\s*{token}\\s+(\\w+)'],
};
```

### Generic region parser

`packages/functional-examples/src/regions/parser.ts` exports:

```typescript
/** Not exported from barrel — used in tests and internally */
export function extractRegionFromFileContent(
  content: string,
  fileName: string,
  extensionMap: Record<string, string[]>,
  startTag: string,
  endTag: string
): ParsedRegion[]
```

- Derives the extension from `fileName` (e.g. `main.ts` → `.ts`)
- Looks up `extensionMap[ext]` — returns `[]` if not found
- For each pattern string, substitutes `{token}` with `startTag` → start regex, `endTag` → end regex (ID group is `(\w+)?` — optional on end markers)
- Scans lines, accumulates `ParsedRegion[]` using a stack (supports nesting)
- Strips region marker lines from `parsed`

`createGenericRegionParser(extensionMap, startTag, endTag): FileContentsParser` wraps this function for use in the pipeline.

### Scanner integration

`runParsePipeline` receives `ResolvedConfig.region` and:

1. Builds the merged extension map: `{ ...DEFAULT_REGION_EXTENSION_MAP, ...config.region.fileExtensionMap }`
2. Creates `createInitialContext(filePath, content, regionConfig)` — passes resolved `startTag`/`endTag` into context
3. Appends the generic region parser to the pipeline for every file whose extension is in the merged map

Plugin parsers (if any) run before the generic region parser, so a plugin can pre-transform content before region extraction.

## Changes by Package

### `@functional-examples/devkit`

- `src/types/index.ts`
  - Add `RegionConfig` interface
  - Add `regionConfig: Required<Pick<RegionConfig, 'startTag' | 'endTag'>>` to `FileParseContext`
  - Add `region?: RegionConfig` to `Config`

### `functional-examples` (core)

- New `src/regions/defaults.ts` — `DEFAULT_REGION_EXTENSION_MAP`
- New `src/regions/parser.ts` — `extractRegionFromFileContent`, `createGenericRegionParser`
- New `src/regions/parser.spec.ts` — vitest tests using `extractRegionFromFileContent` directly
- `src/config/schema.ts` — add `region` block to `ConfigSchema`
- `src/plugins/pipeline.ts` — update `createInitialContext` to accept `regionConfig`, append generic region parser
- `src/scanner/scanner.ts` — pass `ResolvedConfig.region` through to pipeline

### `@functional-examples/javascript`

- Delete `src/parser.ts` (region parser)
- Delete `src/frontmatter.ts` (frontmatter parser)
- Update `src/extractor.ts` — set `parsed` = content with frontmatter stripped when building `ExampleFile`
- Update `src/index.ts` — remove parser exports, remove `fileContentsParsers` from plugin, drop `skipFrontmatter`/`skipRegions`/`regionTag` from `JavaScriptPluginOptions`
- Update `src/index.ts` OPTIONS_SCHEMA accordingly

## Testing Strategy

- `src/regions/parser.spec.ts` tests `extractRegionFromFileContent` directly (no scanner setup needed):
  - Single region, multiple regions, nested regions
  - Multiple comment styles on the same extension (`.ts` line + block)
  - Extension not in map → empty hunks
  - Custom `startTag`/`endTag`
  - End marker without ID (valid)
- Existing scanner integration tests cover end-to-end hunk population
