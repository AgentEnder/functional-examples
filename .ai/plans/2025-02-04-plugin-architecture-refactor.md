# Plugin Architecture Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor from Extractor-only architecture to a Plugin system with FileContentsParsers, enabling language-aware content processing pipelines.

**Architecture:** Plugins contain optional Extractors (find examples) and FileContentsParsers (process file content in accumulator pipeline). Language plugins auto-register for file extensions. Core library becomes pure orchestration with no built-in extractors or parsers.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces, Nx monorepo

---

## Phase 1: Core Type Definitions

### Task 1: Define Plugin and FileContentsParser Types

**Files:**
- Modify: `packages/functional-examples/src/types/index.ts`
- Test: `packages/functional-examples/src/types/types.spec.ts`

**Step 1: Write the type definitions**

Add to `packages/functional-examples/src/types/index.ts`:

```typescript
/**
 * Context passed through the FileContentsParser pipeline.
 * Each parser receives this, transforms it, and returns an updated version.
 */
export interface FileParseContext {
  /** Original file content, never modified */
  raw: string;
  /** Transformed content (frontmatter/markers stripped) */
  parsed: string;
  /** Extracted code regions (only explicit #region blocks) */
  hunks: ParsedRegion[];
  /** Metadata extracted by parsers */
  metadata: Record<string, unknown>;
  /** Absolute path to the file */
  filePath: string;
}

/**
 * Parsed code region from #region markers.
 */
export interface ParsedRegion {
  /** Region identifier from #region <id> */
  id: string;
  /** Content between region markers (markers stripped) */
  content: string;
  /** Line number where #region marker appears (1-based) */
  startLine: number;
  /** Line number where #endregion marker appears (1-based) */
  endLine: number;
}

/**
 * Parser that processes file contents in a pipeline.
 * Receives accumulated context, transforms it, returns updated context.
 */
export interface FileContentsParser {
  /** Unique parser name for debugging/logging */
  readonly name: string;

  /**
   * Process file content and return updated context.
   * @param context - Current accumulated parse context
   * @returns Updated context (should not mutate input)
   */
  parse(context: FileParseContext): FileParseContext | Promise<FileParseContext>;
}

/**
 * Plugin containing optional extractors and file content parsers.
 * Auto-registers for declared file extensions.
 */
export interface Plugin<TMetadata = Record<string, unknown>> {
  /** Unique plugin name */
  readonly name: string;

  /** File extensions this plugin handles (e.g., ['.ts', '.tsx', '.js', '.jsx']) */
  readonly extensions?: string[];

  /** Extractor that finds examples in a directory tree */
  readonly extractor?: Extractor<TMetadata>;

  /** Parser that processes file contents (runs in pipeline order) */
  readonly fileContentsParser?: FileContentsParser;
}
```

**Step 2: Update ExampleFile type**

Modify `ExampleFile` in `packages/functional-examples/src/types/index.ts`:

```typescript
/**
 * A file within an example, with optional processed content.
 */
export interface ExampleFile {
  /** Absolute path to the file */
  absolutePath: string;
  /** Path relative to example root */
  relativePath: string;
  /** @deprecated Use absolutePath instead */
  path?: string;
  /** Raw file contents (may be lazy-loaded) */
  raw?: string;
  /** Parsed content with metadata/markers stripped */
  parsed?: string;
  /** Extracted code regions */
  hunks?: ParsedRegion[];
}
```

**Step 3: Verify types compile**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec tsc --noEmit -p packages/functional-examples/tsconfig.lib.json`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/functional-examples/src/types/index.ts
git commit -m "$(cat <<'EOF'
feat(types): add Plugin and FileContentsParser interfaces

Introduces the new Plugin architecture with:
- FileParseContext for accumulator pipeline pattern
- ParsedRegion for code region extraction
- FileContentsParser interface for content processing
- Plugin interface combining extractors and parsers
- Updated ExampleFile with raw/parsed/hunks fields
EOF
)"
```

---

### Task 2: Export New Types from Package

**Files:**
- Modify: `packages/functional-examples/src/index.ts`

**Step 1: Add exports**

Add to exports in `packages/functional-examples/src/index.ts`:

```typescript
// Plugin system types
export type {
  Plugin,
  FileContentsParser,
  FileParseContext,
  ParsedRegion,
} from './types/index.js';
```

**Step 2: Verify exports**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec tsc --noEmit -p packages/functional-examples/tsconfig.lib.json`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/functional-examples/src/index.ts
git commit -m "feat: export Plugin system types from main package"
```

---

## Phase 2: Plugin Registry and Scanner Refactor

### Task 3: Create Plugin Registry

**Files:**
- Create: `packages/functional-examples/src/plugins/registry.ts`
- Create: `packages/functional-examples/src/plugins/index.ts`
- Test: `packages/functional-examples/src/plugins/registry.spec.ts`

**Step 1: Write the failing test**

Create `packages/functional-examples/src/plugins/registry.spec.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PluginRegistry } from './registry.js';
import type { Plugin, FileParseContext } from '../types/index.js';

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  describe('register', () => {
    it('should register a plugin', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        extensions: ['.ts'],
      };

      registry.register(plugin);

      expect(registry.getPlugins()).toContain(plugin);
    });

    it('should throw on duplicate plugin names', () => {
      const plugin: Plugin = { name: 'test-plugin' };

      registry.register(plugin);

      expect(() => registry.register(plugin)).toThrow(
        'Plugin "test-plugin" is already registered'
      );
    });
  });

  describe('getPluginsForExtension', () => {
    it('should return plugins registered for an extension', () => {
      const tsPlugin: Plugin = {
        name: 'ts-plugin',
        extensions: ['.ts', '.tsx'],
      };
      const jsPlugin: Plugin = {
        name: 'js-plugin',
        extensions: ['.js'],
      };

      registry.register(tsPlugin);
      registry.register(jsPlugin);

      expect(registry.getPluginsForExtension('.ts')).toEqual([tsPlugin]);
      expect(registry.getPluginsForExtension('.tsx')).toEqual([tsPlugin]);
      expect(registry.getPluginsForExtension('.js')).toEqual([jsPlugin]);
      expect(registry.getPluginsForExtension('.py')).toEqual([]);
    });
  });

  describe('getExtractors', () => {
    it('should return all extractors from registered plugins', () => {
      const extractor1 = {
        name: 'extractor1',
        extract: async () => ({ examples: [], errors: [], claimedFiles: new Set<string>() }),
      };
      const extractor2 = {
        name: 'extractor2',
        extract: async () => ({ examples: [], errors: [], claimedFiles: new Set<string>() }),
      };

      registry.register({ name: 'plugin1', extractor: extractor1 });
      registry.register({ name: 'plugin2', extractor: extractor2 });
      registry.register({ name: 'plugin3' }); // no extractor

      expect(registry.getExtractors()).toEqual([extractor1, extractor2]);
    });
  });

  describe('getParsersForExtension', () => {
    it('should return parsers for plugins matching extension in registration order', () => {
      const parser1: Plugin['fileContentsParser'] = {
        name: 'parser1',
        parse: (ctx: FileParseContext) => ctx,
      };
      const parser2: Plugin['fileContentsParser'] = {
        name: 'parser2',
        parse: (ctx: FileParseContext) => ctx,
      };

      registry.register({ name: 'plugin1', extensions: ['.ts'], fileContentsParser: parser1 });
      registry.register({ name: 'plugin2', extensions: ['.ts'], fileContentsParser: parser2 });

      const parsers = registry.getParsersForExtension('.ts');
      expect(parsers).toEqual([parser1, parser2]);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec vitest run packages/functional-examples/src/plugins/registry.spec.ts`
Expected: FAIL (module not found)

**Step 3: Write the implementation**

Create `packages/functional-examples/src/plugins/registry.ts`:

```typescript
import type {
  Plugin,
  Extractor,
  FileContentsParser,
} from '../types/index.js';

/**
 * Registry for plugins with extension-based lookup.
 */
export class PluginRegistry {
  private plugins: Plugin[] = [];
  private extensionMap: Map<string, Plugin[]> = new Map();

  /**
   * Register a plugin.
   * @throws If plugin with same name already registered
   */
  register(plugin: Plugin): void {
    if (this.plugins.some((p) => p.name === plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered`);
    }

    this.plugins.push(plugin);

    // Index by extensions
    if (plugin.extensions) {
      for (const ext of plugin.extensions) {
        const existing = this.extensionMap.get(ext) ?? [];
        existing.push(plugin);
        this.extensionMap.set(ext, existing);
      }
    }
  }

  /**
   * Get all registered plugins.
   */
  getPlugins(): readonly Plugin[] {
    return this.plugins;
  }

  /**
   * Get plugins registered for a file extension.
   */
  getPluginsForExtension(extension: string): Plugin[] {
    return this.extensionMap.get(extension) ?? [];
  }

  /**
   * Get all extractors from registered plugins.
   */
  getExtractors(): Extractor[] {
    return this.plugins
      .filter((p): p is Plugin & { extractor: Extractor } => p.extractor !== undefined)
      .map((p) => p.extractor);
  }

  /**
   * Get parsers for files with given extension, in registration order.
   */
  getParsersForExtension(extension: string): FileContentsParser[] {
    return this.getPluginsForExtension(extension)
      .filter((p): p is Plugin & { fileContentsParser: FileContentsParser } =>
        p.fileContentsParser !== undefined
      )
      .map((p) => p.fileContentsParser);
  }
}
```

Create `packages/functional-examples/src/plugins/index.ts`:

```typescript
export { PluginRegistry } from './registry.js';
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec vitest run packages/functional-examples/src/plugins/registry.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/functional-examples/src/plugins/
git commit -m "$(cat <<'EOF'
feat(plugins): add PluginRegistry for plugin management

Implements registry with:
- Plugin registration with duplicate name detection
- Extension-based plugin lookup
- Extractor aggregation across plugins
- Parser pipeline lookup by file extension
EOF
)"
```

---

### Task 4: Create File Content Pipeline Runner

**Files:**
- Create: `packages/functional-examples/src/plugins/pipeline.ts`
- Test: `packages/functional-examples/src/plugins/pipeline.spec.ts`

**Step 1: Write the failing test**

Create `packages/functional-examples/src/plugins/pipeline.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { runParsePipeline, createInitialContext } from './pipeline.js';
import type { FileContentsParser, FileParseContext } from '../types/index.js';

describe('createInitialContext', () => {
  it('should create context with raw content copied to parsed', () => {
    const ctx = createInitialContext('/path/to/file.ts', 'const x = 1;');

    expect(ctx).toEqual({
      raw: 'const x = 1;',
      parsed: 'const x = 1;',
      hunks: [],
      metadata: {},
      filePath: '/path/to/file.ts',
    });
  });
});

describe('runParsePipeline', () => {
  it('should run parsers in order, passing accumulated context', async () => {
    const calls: string[] = [];

    const parser1: FileContentsParser = {
      name: 'parser1',
      parse: (ctx) => {
        calls.push('parser1');
        return { ...ctx, metadata: { ...ctx.metadata, p1: true } };
      },
    };

    const parser2: FileContentsParser = {
      name: 'parser2',
      parse: (ctx) => {
        calls.push('parser2');
        return { ...ctx, metadata: { ...ctx.metadata, p2: true } };
      },
    };

    const initial = createInitialContext('/test.ts', 'code');
    const result = await runParsePipeline(initial, [parser1, parser2]);

    expect(calls).toEqual(['parser1', 'parser2']);
    expect(result.metadata).toEqual({ p1: true, p2: true });
  });

  it('should handle async parsers', async () => {
    const asyncParser: FileContentsParser = {
      name: 'async-parser',
      parse: async (ctx) => {
        await new Promise((r) => setTimeout(r, 1));
        return { ...ctx, parsed: ctx.parsed.toUpperCase() };
      },
    };

    const initial = createInitialContext('/test.ts', 'hello');
    const result = await runParsePipeline(initial, [asyncParser]);

    expect(result.parsed).toBe('HELLO');
  });

  it('should return initial context when no parsers provided', async () => {
    const initial = createInitialContext('/test.ts', 'code');
    const result = await runParsePipeline(initial, []);

    expect(result).toEqual(initial);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec vitest run packages/functional-examples/src/plugins/pipeline.spec.ts`
Expected: FAIL (module not found)

**Step 3: Write the implementation**

Create `packages/functional-examples/src/plugins/pipeline.ts`:

```typescript
import type { FileContentsParser, FileParseContext } from '../types/index.js';

/**
 * Create the initial parse context for a file.
 */
export function createInitialContext(
  filePath: string,
  content: string
): FileParseContext {
  return {
    raw: content,
    parsed: content,
    hunks: [],
    metadata: {},
    filePath,
  };
}

/**
 * Run file content through a parser pipeline.
 * Parsers execute in order, each receiving the output of the previous.
 */
export async function runParsePipeline(
  context: FileParseContext,
  parsers: FileContentsParser[]
): Promise<FileParseContext> {
  let result = context;

  for (const parser of parsers) {
    result = await parser.parse(result);
  }

  return result;
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec vitest run packages/functional-examples/src/plugins/pipeline.spec.ts`
Expected: PASS

**Step 5: Update exports**

Add to `packages/functional-examples/src/plugins/index.ts`:

```typescript
export { PluginRegistry } from './registry.js';
export { runParsePipeline, createInitialContext } from './pipeline.js';
```

**Step 6: Commit**

```bash
git add packages/functional-examples/src/plugins/
git commit -m "$(cat <<'EOF'
feat(plugins): add file content parse pipeline

Implements accumulator pattern pipeline:
- createInitialContext() sets up pre-structured context
- runParsePipeline() chains parsers sequentially
- Supports both sync and async parsers
EOF
)"
```

---

### Task 5: Update Scanner to Use Plugin Registry

**Files:**
- Modify: `packages/functional-examples/src/scanner/scanner.ts`
- Modify: `packages/functional-examples/src/scanner/types.ts`
- Test: `packages/functional-examples/src/scanner/scanner.spec.ts`

**Step 1: Update ScanOptions type**

Modify `packages/functional-examples/src/scanner/types.ts` to add plugin support:

```typescript
import type { Plugin, Extractor } from '../types/index.js';

// ... existing types ...

/**
 * Options for scanning examples.
 */
export interface ScanOptions<TMetadata = Record<string, unknown>> {
  /** Root directory to scan */
  root: string;

  /**
   * Plugins to use for scanning.
   * Plugins are processed in registration order.
   */
  plugins?: Plugin<TMetadata>[];

  /**
   * @deprecated Use plugins instead. Standalone extractors for backward compatibility.
   */
  extractors?: Extractor<TMetadata>[];

  /** Path mappings for conflict resolution */
  pathMappings?: PathMapping[];

  /** Glob patterns to include */
  include?: string[];

  /** Glob patterns to exclude */
  exclude?: string[];

  /** Abort signal for cancellation */
  signal?: AbortSignal;

  /**
   * Whether to process file contents through parser pipelines.
   * @default true
   */
  processFileContents?: boolean;
}
```

**Step 2: Update scanner implementation**

Modify `packages/functional-examples/src/scanner/scanner.ts` to use PluginRegistry:

```typescript
import { PluginRegistry } from '../plugins/registry.js';
import { runParsePipeline, createInitialContext } from '../plugins/pipeline.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// In scanExamples function, add plugin handling:

export async function scanExamples<TMetadata = Record<string, unknown>>(
  options: ScanOptions<TMetadata>
): Promise<ScanResult<TMetadata>> {
  const startTime = Date.now();
  const {
    root,
    plugins = [],
    extractors: standaloneExtractors = [],
    pathMappings = [],
    include,
    exclude,
    signal,
    processFileContents = true,
  } = options;

  // Build plugin registry
  const registry = new PluginRegistry();
  for (const plugin of plugins) {
    registry.register(plugin);
  }

  // Collect all extractors (from plugins + standalone for backward compat)
  const allExtractors = [
    ...registry.getExtractors(),
    ...standaloneExtractors,
  ];

  // ... rest of existing extraction logic using allExtractors ...

  // After extraction, process file contents if enabled
  if (processFileContents) {
    for (const example of examples) {
      for (const file of example.files) {
        const ext = path.extname(file.absolutePath);
        const parsers = registry.getParsersForExtension(ext);

        if (parsers.length > 0 && file.raw === undefined) {
          // Load file content if not already loaded
          file.raw = await fs.readFile(file.absolutePath, 'utf-8');
        }

        if (file.raw !== undefined && parsers.length > 0) {
          const ctx = createInitialContext(file.absolutePath, file.raw);
          const result = await runParsePipeline(ctx, parsers);
          file.parsed = result.parsed;
          file.hunks = result.hunks;
        }
      }
    }
  }

  // ... return result ...
}
```

**Step 3: Write tests for new plugin-based scanning**

Add to `packages/functional-examples/src/scanner/scanner.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scanExamples } from './scanner.js';
import type { Plugin, FileParseContext } from '../types/index.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('scanExamples with plugins', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scan-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should run file contents through parser pipeline', async () => {
    // Create test file
    const filePath = path.join(tempDir, 'test.ts');
    await fs.writeFile(filePath, '// #region main\nconst x = 1;\n// #endregion main');

    const parseHistory: string[] = [];

    const plugin: Plugin = {
      name: 'test-plugin',
      extensions: ['.ts'],
      extractor: {
        name: 'test-extractor',
        async extract(root) {
          return {
            examples: [{
              id: 'test',
              title: 'Test',
              rootPath: root,
              files: [{ absolutePath: filePath, relativePath: 'test.ts' }],
              metadata: {},
              extractorName: 'test-extractor',
            }],
            errors: [],
            claimedFiles: new Set([filePath]),
          };
        },
      },
      fileContentsParser: {
        name: 'test-parser',
        parse(ctx: FileParseContext) {
          parseHistory.push(ctx.filePath);
          return {
            ...ctx,
            parsed: ctx.raw.replace(/\/\/ #region.*\n?/g, '').replace(/\/\/ #endregion.*\n?/g, ''),
            hunks: [{ id: 'main', content: 'const x = 1;', startLine: 1, endLine: 3 }],
          };
        },
      },
    };

    const result = await scanExamples({
      root: tempDir,
      plugins: [plugin],
    });

    expect(result.examples).toHaveLength(1);
    expect(result.examples[0].files[0].parsed).toBe('const x = 1;\n');
    expect(result.examples[0].files[0].hunks).toHaveLength(1);
    expect(parseHistory).toContain(filePath);
  });

  it('should respect processFileContents: false', async () => {
    const filePath = path.join(tempDir, 'test.ts');
    await fs.writeFile(filePath, 'const x = 1;');

    const parseCalled = vi.fn();

    const plugin: Plugin = {
      name: 'test-plugin',
      extensions: ['.ts'],
      extractor: {
        name: 'test-extractor',
        async extract(root) {
          return {
            examples: [{
              id: 'test',
              title: 'Test',
              rootPath: root,
              files: [{ absolutePath: filePath, relativePath: 'test.ts' }],
              metadata: {},
              extractorName: 'test-extractor',
            }],
            errors: [],
            claimedFiles: new Set([filePath]),
          };
        },
      },
      fileContentsParser: {
        name: 'test-parser',
        parse(ctx: FileParseContext) {
          parseCalled();
          return ctx;
        },
      },
    };

    await scanExamples({
      root: tempDir,
      plugins: [plugin],
      processFileContents: false,
    });

    expect(parseCalled).not.toHaveBeenCalled();
  });
});
```

**Step 4: Run tests**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec vitest run packages/functional-examples/src/scanner/`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/functional-examples/src/scanner/
git commit -m "$(cat <<'EOF'
feat(scanner): integrate plugin system with scanner

- ScanOptions now accepts plugins array
- Scanner builds PluginRegistry internally
- File contents processed through parser pipelines
- Backward compatible: extractors option still works
- New processFileContents option (default: true)
EOF
)"
```

---

### Task 6: Export Plugin System from Main Package

**Files:**
- Modify: `packages/functional-examples/src/index.ts`

**Step 1: Add plugin exports**

Add to `packages/functional-examples/src/index.ts`:

```typescript
// Plugin system
export { PluginRegistry, runParsePipeline, createInitialContext } from './plugins/index.js';
```

**Step 2: Verify build**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec tsc --noEmit -p packages/functional-examples/tsconfig.lib.json`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/functional-examples/src/index.ts
git commit -m "feat: export plugin system from main package"
```

---

## Phase 3: JavaScript Plugin Package

### Task 7: Create JavaScript Plugin Package Structure

**Files:**
- Create: `packages/javascript/package.json`
- Create: `packages/javascript/tsconfig.json`
- Create: `packages/javascript/tsconfig.lib.json`
- Create: `packages/javascript/src/index.ts`

**Step 1: Create package.json**

Create `packages/javascript/package.json`:

```json
{
  "name": "@functional-examples/javascript",
  "version": "0.0.1",
  "description": "JavaScript/TypeScript plugin for functional-examples",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsc -p tsconfig.lib.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "peerDependencies": {
    "functional-examples": "workspace:*"
  },
  "devDependencies": {
    "functional-examples": "workspace:*",
    "typescript": "catalog:",
    "vitest": "catalog:"
  },
  "dependencies": {
    "fast-glob": "^3.3.0",
    "yaml": "catalog:"
  }
}
```

**Step 2: Create tsconfig files**

Create `packages/javascript/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

Create `packages/javascript/tsconfig.lib.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts", "node_modules", "dist"]
}
```

**Step 3: Create placeholder index**

Create `packages/javascript/src/index.ts`:

```typescript
export const JAVASCRIPT_EXTENSIONS = [
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
] as const;
```

**Step 4: Install dependencies**

Run: `cd /Users/agentender/repos/functional-examples && pnpm install`
Expected: Success

**Step 5: Commit**

```bash
git add packages/javascript/
git commit -m "$(cat <<'EOF'
feat(javascript): scaffold @functional-examples/javascript package

New plugin package for JavaScript/TypeScript support with:
- Package configuration for ESM
- TypeScript build setup
- Peer dependency on functional-examples core
EOF
)"
```

---

### Task 8: Implement JavaScript FileContentsParser (Region Parsing)

**Files:**
- Create: `packages/javascript/src/parser.ts`
- Test: `packages/javascript/src/parser.spec.ts`

**Step 1: Write the failing test**

Create `packages/javascript/src/parser.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createJavaScriptParser } from './parser.js';
import type { FileParseContext } from 'functional-examples';

describe('createJavaScriptParser', () => {
  const parser = createJavaScriptParser();

  function makeContext(content: string, filePath = '/test.ts'): FileParseContext {
    return {
      raw: content,
      parsed: content,
      hunks: [],
      metadata: {},
      filePath,
    };
  }

  describe('region parsing', () => {
    it('should extract regions from line comments', () => {
      const content = `// some code
// #region setup
const db = connect();
// #endregion setup
// more code`;

      const result = parser.parse(makeContext(content));

      expect(result.hunks).toHaveLength(1);
      expect(result.hunks[0]).toEqual({
        id: 'setup',
        content: 'const db = connect();',
        startLine: 2,
        endLine: 4,
      });
    });

    it('should extract regions from block comments', () => {
      const content = `/* #region main */
console.log('hello');
/* #endregion main */`;

      const result = parser.parse(makeContext(content));

      expect(result.hunks).toHaveLength(1);
      expect(result.hunks[0].id).toBe('main');
      expect(result.hunks[0].content).toBe("console.log('hello');");
    });

    it('should handle multiple regions', () => {
      const content = `// #region a
const a = 1;
// #endregion a
// #region b
const b = 2;
// #endregion b`;

      const result = parser.parse(makeContext(content));

      expect(result.hunks).toHaveLength(2);
      expect(result.hunks[0].id).toBe('a');
      expect(result.hunks[1].id).toBe('b');
    });

    it('should strip region markers from parsed content', () => {
      const content = `const before = 0;
// #region main
const inside = 1;
// #endregion main
const after = 2;`;

      const result = parser.parse(makeContext(content));

      expect(result.parsed).toBe(`const before = 0;
const inside = 1;
const after = 2;`);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec vitest run packages/javascript/src/parser.spec.ts`
Expected: FAIL (module not found)

**Step 3: Write the implementation**

Create `packages/javascript/src/parser.ts`:

```typescript
import type { FileContentsParser, FileParseContext, ParsedRegion } from 'functional-examples';

const LINE_COMMENT_REGION = /^[ \t]*\/\/\s*#region\s+(\S+)\s*$/;
const LINE_COMMENT_ENDREGION = /^[ \t]*\/\/\s*#endregion(?:\s+(\S+))?\s*$/;
const BLOCK_COMMENT_REGION = /^[ \t]*\/\*\s*#region\s+(\S+)\s*\*\/\s*$/;
const BLOCK_COMMENT_ENDREGION = /^[ \t]*\/\*\s*#endregion(?:\s+(\S+))?\s*\*\/\s*$/;

interface RegionState {
  id: string;
  startLine: number;
  lines: string[];
}

/**
 * Create a FileContentsParser for JavaScript/TypeScript files.
 * Handles region extraction and marker stripping.
 */
export function createJavaScriptParser(): FileContentsParser {
  return {
    name: 'javascript-parser',

    parse(context: FileParseContext): FileParseContext {
      const lines = context.raw.split('\n');
      const hunks: ParsedRegion[] = [];
      const outputLines: string[] = [];
      const regionStack: RegionState[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        // Check for region start
        const startMatch =
          line.match(LINE_COMMENT_REGION) || line.match(BLOCK_COMMENT_REGION);

        if (startMatch) {
          regionStack.push({
            id: startMatch[1],
            startLine: lineNum,
            lines: [],
          });
          continue; // Don't include marker in output
        }

        // Check for region end
        const endMatch =
          line.match(LINE_COMMENT_ENDREGION) || line.match(BLOCK_COMMENT_ENDREGION);

        if (endMatch) {
          const current = regionStack.pop();
          if (current) {
            hunks.push({
              id: current.id,
              content: current.lines.join('\n'),
              startLine: current.startLine,
              endLine: lineNum,
            });
          }
          continue; // Don't include marker in output
        }

        // Regular line - add to output and any active regions
        outputLines.push(line);
        for (const region of regionStack) {
          region.lines.push(line);
        }
      }

      return {
        ...context,
        parsed: outputLines.join('\n'),
        hunks,
      };
    },
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec vitest run packages/javascript/src/parser.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/javascript/src/parser.ts packages/javascript/src/parser.spec.ts
git commit -m "$(cat <<'EOF'
feat(javascript): implement region parser

FileContentsParser that:
- Extracts #region/#endregion blocks
- Supports both // and /* */ comment styles
- Strips markers from parsed output
- Handles nested regions
EOF
)"
```

---

### Task 9: Implement JavaScript Frontmatter Parser

**Files:**
- Create: `packages/javascript/src/frontmatter.ts`
- Test: `packages/javascript/src/frontmatter.spec.ts`

**Step 1: Write the failing test**

Create `packages/javascript/src/frontmatter.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createFrontmatterParser } from './frontmatter.js';
import type { FileParseContext } from 'functional-examples';

describe('createFrontmatterParser', () => {
  const parser = createFrontmatterParser();

  function makeContext(content: string, filePath = '/test.ts'): FileParseContext {
    return {
      raw: content,
      parsed: content,
      hunks: [],
      metadata: {},
      filePath,
    };
  }

  describe('line comment frontmatter', () => {
    it('should extract YAML from // --- delimited block', () => {
      const content = `// ---
// id: my-example
// title: My Example
// ---
const x = 1;`;

      const result = parser.parse(makeContext(content));

      expect(result.metadata).toEqual({
        id: 'my-example',
        title: 'My Example',
      });
    });

    it('should strip frontmatter from parsed content', () => {
      const content = `// ---
// id: test
// ---
const x = 1;`;

      const result = parser.parse(makeContext(content));

      expect(result.parsed).toBe('const x = 1;');
    });
  });

  describe('block comment frontmatter', () => {
    it('should extract YAML from /* --- */ wrapped block', () => {
      const content = `/*
---
id: block-example
title: Block Example
description: Multi-line
---
*/
const x = 1;`;

      const result = parser.parse(makeContext(content));

      expect(result.metadata).toEqual({
        id: 'block-example',
        title: 'Block Example',
        description: 'Multi-line',
      });
    });

    it('should strip block frontmatter from parsed content', () => {
      const content = `/*
---
id: test
---
*/
const x = 1;`;

      const result = parser.parse(makeContext(content));

      expect(result.parsed).toBe('const x = 1;');
    });
  });

  describe('no frontmatter', () => {
    it('should pass through content unchanged when no frontmatter', () => {
      const content = `const x = 1;
console.log(x);`;

      const result = parser.parse(makeContext(content));

      expect(result.parsed).toBe(content);
      expect(result.metadata).toEqual({});
    });
  });

  describe('frontmatter position', () => {
    it('should only detect frontmatter at file start', () => {
      const content = `const x = 1;
// ---
// id: not-frontmatter
// ---`;

      const result = parser.parse(makeContext(content));

      expect(result.metadata).toEqual({});
      expect(result.parsed).toBe(content);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec vitest run packages/javascript/src/frontmatter.spec.ts`
Expected: FAIL (module not found)

**Step 3: Write the implementation**

Create `packages/javascript/src/frontmatter.ts`:

```typescript
import { parse as parseYaml } from 'yaml';
import type { FileContentsParser, FileParseContext } from 'functional-examples';

const LINE_START = /^[ \t]*\/\/\s*---\s*$/;
const LINE_CONTENT = /^[ \t]*\/\/\s?(.*)$/;
const BLOCK_START = /^[ \t]*\/\*\s*$/;
const BLOCK_YAML_START = /^---\s*$/;
const BLOCK_YAML_END = /^---\s*$/;
const BLOCK_END = /^[ \t]*\*\/\s*$/;

/**
 * Create a FileContentsParser that extracts YAML frontmatter from JS/TS files.
 * Supports both line comment (// ---) and block comment (/* --- *\/) styles.
 */
export function createFrontmatterParser(): FileContentsParser {
  return {
    name: 'javascript-frontmatter',

    parse(context: FileParseContext): FileParseContext {
      const lines = context.parsed.split('\n');

      // Try line comment style first
      const lineResult = tryLineCommentFrontmatter(lines);
      if (lineResult) {
        return {
          ...context,
          parsed: lineResult.remainingLines.join('\n'),
          metadata: { ...context.metadata, ...lineResult.metadata },
        };
      }

      // Try block comment style
      const blockResult = tryBlockCommentFrontmatter(lines);
      if (blockResult) {
        return {
          ...context,
          parsed: blockResult.remainingLines.join('\n'),
          metadata: { ...context.metadata, ...blockResult.metadata },
        };
      }

      // No frontmatter found
      return context;
    },
  };
}

interface FrontmatterResult {
  metadata: Record<string, unknown>;
  remainingLines: string[];
}

function tryLineCommentFrontmatter(lines: string[]): FrontmatterResult | null {
  if (lines.length < 2) return null;

  // Must start with // ---
  if (!LINE_START.test(lines[0])) return null;

  const yamlLines: string[] = [];
  let endIndex = -1;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Check for end marker
    if (LINE_START.test(line)) {
      endIndex = i;
      break;
    }

    // Extract content after //
    const match = line.match(LINE_CONTENT);
    if (!match) {
      // Non-comment line before end marker = not frontmatter
      return null;
    }
    yamlLines.push(match[1]);
  }

  if (endIndex === -1) return null;

  try {
    const metadata = parseYaml(yamlLines.join('\n')) ?? {};
    return {
      metadata,
      remainingLines: lines.slice(endIndex + 1),
    };
  } catch {
    return null;
  }
}

function tryBlockCommentFrontmatter(lines: string[]): FrontmatterResult | null {
  if (lines.length < 4) return null;

  // Must start with /*
  if (!BLOCK_START.test(lines[0])) return null;

  // Next line must be ---
  if (!BLOCK_YAML_START.test(lines[1])) return null;

  const yamlLines: string[] = [];
  let yamlEndIndex = -1;
  let blockEndIndex = -1;

  // Collect YAML lines until ---
  for (let i = 2; i < lines.length; i++) {
    if (BLOCK_YAML_END.test(lines[i])) {
      yamlEndIndex = i;
      break;
    }
    yamlLines.push(lines[i]);
  }

  if (yamlEndIndex === -1) return null;

  // Next line must be */
  if (yamlEndIndex + 1 >= lines.length || !BLOCK_END.test(lines[yamlEndIndex + 1])) {
    return null;
  }
  blockEndIndex = yamlEndIndex + 1;

  try {
    const metadata = parseYaml(yamlLines.join('\n')) ?? {};
    return {
      metadata,
      remainingLines: lines.slice(blockEndIndex + 1),
    };
  } catch {
    return null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec vitest run packages/javascript/src/frontmatter.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/javascript/src/frontmatter.ts packages/javascript/src/frontmatter.spec.ts
git commit -m "$(cat <<'EOF'
feat(javascript): implement frontmatter parser

FileContentsParser that:
- Extracts YAML from // --- delimited blocks
- Extracts YAML from /* --- */ wrapped blocks
- Only detects frontmatter at file start
- Strips frontmatter from parsed content
EOF
)"
```

---

### Task 10: Implement JavaScript Single-File Extractor

**Files:**
- Create: `packages/javascript/src/extractor.ts`
- Test: `packages/javascript/src/extractor.spec.ts`

**Step 1: Write the failing test**

Create `packages/javascript/src/extractor.spec.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createJavaScriptExtractor } from './extractor.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('createJavaScriptExtractor', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'js-extractor-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should find files with frontmatter', async () => {
    await fs.writeFile(
      path.join(tempDir, 'example.ts'),
      `// ---
// id: my-example
// title: Test Example
// ---
const x = 1;`
    );

    const extractor = createJavaScriptExtractor();
    const result = await extractor.extract(tempDir);

    expect(result.examples).toHaveLength(1);
    expect(result.examples[0].id).toBe('my-example');
    expect(result.examples[0].title).toBe('Test Example');
  });

  it('should ignore files without frontmatter', async () => {
    await fs.writeFile(
      path.join(tempDir, 'no-frontmatter.ts'),
      'const x = 1;'
    );

    const extractor = createJavaScriptExtractor();
    const result = await extractor.extract(tempDir);

    expect(result.examples).toHaveLength(0);
  });

  it('should load raw content into files', async () => {
    await fs.writeFile(
      path.join(tempDir, 'example.js'),
      `// ---
// id: test
// title: Test
// ---
console.log('hello');`
    );

    const extractor = createJavaScriptExtractor();
    const result = await extractor.extract(tempDir);

    expect(result.examples[0].files[0].raw).toContain("console.log('hello')");
  });

  it('should respect exclude patterns', async () => {
    await fs.mkdir(path.join(tempDir, 'node_modules'), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, 'node_modules', 'dep.ts'),
      `// ---
// id: ignored
// title: Ignored
// ---`
    );
    await fs.writeFile(
      path.join(tempDir, 'example.ts'),
      `// ---
// id: included
// title: Included
// ---`
    );

    const extractor = createJavaScriptExtractor();
    const result = await extractor.extract(tempDir);

    expect(result.examples).toHaveLength(1);
    expect(result.examples[0].id).toBe('included');
  });

  it('should claim files it extracts from', async () => {
    const filePath = path.join(tempDir, 'example.ts');
    await fs.writeFile(
      filePath,
      `// ---
// id: test
// title: Test
// ---`
    );

    const extractor = createJavaScriptExtractor();
    const result = await extractor.extract(tempDir);

    expect(result.claimedFiles.has(filePath)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec vitest run packages/javascript/src/extractor.spec.ts`
Expected: FAIL (module not found)

**Step 3: Write the implementation**

Create `packages/javascript/src/extractor.ts`:

```typescript
import fg from 'fast-glob';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { Extractor, ExtractorResult, Example, ExampleFile } from 'functional-examples';
import { JAVASCRIPT_EXTENSIONS } from './index.js';

export interface JavaScriptExtractorOptions {
  /** Additional extensions to scan (merged with defaults) */
  additionalExtensions?: string[];
  /** Patterns to exclude */
  exclude?: string[];
}

const DEFAULT_EXCLUDES = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'];

const LINE_START = /^[ \t]*\/\/\s*---\s*$/;
const LINE_CONTENT = /^[ \t]*\/\/\s?(.*)$/;
const BLOCK_START = /^[ \t]*\/\*\s*$/;
const BLOCK_YAML_START = /^---\s*$/;
const BLOCK_YAML_END = /^---\s*$/;
const BLOCK_END = /^[ \t]*\*\/\s*$/;

interface FrontmatterData {
  id: string;
  title: string;
  description?: string;
  [key: string]: unknown;
}

/**
 * Create an extractor that finds single-file JS/TS examples with frontmatter.
 */
export function createJavaScriptExtractor(
  options: JavaScriptExtractorOptions = {}
): Extractor {
  const { additionalExtensions = [], exclude = [] } = options;

  const extensions = [...JAVASCRIPT_EXTENSIONS, ...additionalExtensions];
  const patterns = extensions.map((ext) => `**/*${ext}`);
  const ignorePatterns = [...DEFAULT_EXCLUDES, ...exclude];

  return {
    name: 'javascript',

    async extract(rootPath: string): Promise<ExtractorResult> {
      const examples: Example[] = [];
      const errors: Array<{ path: string; message: string; cause?: Error }> = [];
      const claimedFiles = new Set<string>();

      const files = await fg(patterns, {
        cwd: rootPath,
        absolute: true,
        ignore: ignorePatterns,
      });

      for (const filePath of files) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const frontmatter = extractFrontmatter(content);

          if (frontmatter && frontmatter.id && frontmatter.title) {
            const relativePath = path.relative(rootPath, filePath);
            const exampleFile: ExampleFile = {
              absolutePath: filePath,
              relativePath,
              raw: content,
            };

            examples.push({
              id: frontmatter.id,
              title: frontmatter.title,
              description: frontmatter.description,
              rootPath: path.dirname(filePath),
              files: [exampleFile],
              metadata: frontmatter,
              extractorName: 'javascript',
            });

            claimedFiles.add(filePath);
          }
        } catch (err) {
          errors.push({
            path: filePath,
            message: `Failed to process file: ${err instanceof Error ? err.message : String(err)}`,
            cause: err instanceof Error ? err : undefined,
          });
        }
      }

      return { examples, errors, claimedFiles };
    },
  };
}

function extractFrontmatter(content: string): FrontmatterData | null {
  const lines = content.split('\n');

  // Try line comment style
  const lineResult = tryLineComment(lines);
  if (lineResult) return lineResult;

  // Try block comment style
  const blockResult = tryBlockComment(lines);
  if (blockResult) return blockResult;

  return null;
}

function tryLineComment(lines: string[]): FrontmatterData | null {
  if (lines.length < 2 || !LINE_START.test(lines[0])) return null;

  const yamlLines: string[] = [];
  let foundEnd = false;

  for (let i = 1; i < lines.length; i++) {
    if (LINE_START.test(lines[i])) {
      foundEnd = true;
      break;
    }
    const match = lines[i].match(LINE_CONTENT);
    if (!match) return null;
    yamlLines.push(match[1]);
  }

  if (!foundEnd) return null;

  try {
    return parseYaml(yamlLines.join('\n')) as FrontmatterData;
  } catch {
    return null;
  }
}

function tryBlockComment(lines: string[]): FrontmatterData | null {
  if (lines.length < 4) return null;
  if (!BLOCK_START.test(lines[0])) return null;
  if (!BLOCK_YAML_START.test(lines[1])) return null;

  const yamlLines: string[] = [];
  let yamlEndIndex = -1;

  for (let i = 2; i < lines.length; i++) {
    if (BLOCK_YAML_END.test(lines[i])) {
      yamlEndIndex = i;
      break;
    }
    yamlLines.push(lines[i]);
  }

  if (yamlEndIndex === -1) return null;
  if (yamlEndIndex + 1 >= lines.length || !BLOCK_END.test(lines[yamlEndIndex + 1])) {
    return null;
  }

  try {
    return parseYaml(yamlLines.join('\n')) as FrontmatterData;
  } catch {
    return null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec vitest run packages/javascript/src/extractor.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/javascript/src/extractor.ts packages/javascript/src/extractor.spec.ts
git commit -m "$(cat <<'EOF'
feat(javascript): implement single-file extractor

Extractor that:
- Scans for JS/TS files with YAML frontmatter
- Supports both line and block comment styles
- Respects exclude patterns (node_modules, etc.)
- Loads raw content into ExampleFile
EOF
)"
```

---

### Task 11: Create JavaScript Plugin Entry Point

**Files:**
- Modify: `packages/javascript/src/index.ts`
- Test: `packages/javascript/src/index.spec.ts`

**Step 1: Write the failing test**

Create `packages/javascript/src/index.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createJavaScriptPlugin, JAVASCRIPT_EXTENSIONS } from './index.js';

describe('createJavaScriptPlugin', () => {
  it('should create a plugin with correct name', () => {
    const plugin = createJavaScriptPlugin();
    expect(plugin.name).toBe('javascript');
  });

  it('should register for JavaScript/TypeScript extensions', () => {
    const plugin = createJavaScriptPlugin();
    expect(plugin.extensions).toEqual(JAVASCRIPT_EXTENSIONS);
  });

  it('should include extractor', () => {
    const plugin = createJavaScriptPlugin();
    expect(plugin.extractor).toBeDefined();
    expect(plugin.extractor?.name).toBe('javascript');
  });

  it('should include file contents parser', () => {
    const plugin = createJavaScriptPlugin();
    expect(plugin.fileContentsParser).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec vitest run packages/javascript/src/index.spec.ts`
Expected: FAIL

**Step 3: Write the implementation**

Update `packages/javascript/src/index.ts`:

```typescript
import type { Plugin, FileContentsParser, FileParseContext } from 'functional-examples';
import { createJavaScriptExtractor, type JavaScriptExtractorOptions } from './extractor.js';
import { createJavaScriptParser } from './parser.js';
import { createFrontmatterParser } from './frontmatter.js';

export const JAVASCRIPT_EXTENSIONS = [
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
] as const;

export type { JavaScriptExtractorOptions };
export { createJavaScriptExtractor } from './extractor.js';
export { createJavaScriptParser } from './parser.js';
export { createFrontmatterParser } from './frontmatter.js';

export interface JavaScriptPluginOptions extends JavaScriptExtractorOptions {
  /** Skip frontmatter parsing (useful if using external metadata) */
  skipFrontmatter?: boolean;
  /** Skip region parsing */
  skipRegions?: boolean;
}

/**
 * Create a combined parser that runs frontmatter then region parsing.
 */
function createCombinedParser(options: JavaScriptPluginOptions = {}): FileContentsParser {
  const { skipFrontmatter = false, skipRegions = false } = options;

  const frontmatterParser = skipFrontmatter ? null : createFrontmatterParser();
  const regionParser = skipRegions ? null : createJavaScriptParser();

  return {
    name: 'javascript-combined',
    parse(context: FileParseContext): FileParseContext {
      let result = context;

      if (frontmatterParser) {
        result = frontmatterParser.parse(result) as FileParseContext;
      }

      if (regionParser) {
        result = regionParser.parse(result) as FileParseContext;
      }

      return result;
    },
  };
}

/**
 * Create the JavaScript/TypeScript plugin.
 * Includes extractor for single-file examples and parser for content processing.
 */
export function createJavaScriptPlugin(options: JavaScriptPluginOptions = {}): Plugin {
  return {
    name: 'javascript',
    extensions: [...JAVASCRIPT_EXTENSIONS],
    extractor: createJavaScriptExtractor(options),
    fileContentsParser: createCombinedParser(options),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec vitest run packages/javascript/src/index.spec.ts`
Expected: PASS

**Step 5: Run all package tests**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec vitest run packages/javascript/`
Expected: All PASS

**Step 6: Commit**

```bash
git add packages/javascript/src/
git commit -m "$(cat <<'EOF'
feat(javascript): create plugin entry point

Exports createJavaScriptPlugin() which combines:
- Single-file extractor (finds examples with frontmatter)
- Combined parser (frontmatter stripping + region extraction)
- Auto-registers for all JS/TS extensions
EOF
)"
```

---

## Phase 4: Rename and Update Existing Packages

### Task 12: Rename extractor-meta-yml to yaml-manifest

**Files:**
- Move: `packages/extractor-meta-yml/` → `packages/yaml-manifest/`
- Modify: `packages/yaml-manifest/package.json`

**Step 1: Move the package directory**

Run: `cd /Users/agentender/repos/functional-examples && mv packages/extractor-meta-yml packages/yaml-manifest`

**Step 2: Update package.json**

Update `packages/yaml-manifest/package.json`:

```json
{
  "name": "@functional-examples/yaml-manifest",
  "version": "0.0.1",
  "description": "YAML manifest extractor plugin for functional-examples",
  ...
}
```

**Step 3: Update imports/exports to use Plugin interface**

Update the extractor to be wrapped in a Plugin:

```typescript
// In packages/yaml-manifest/src/index.ts
import type { Plugin } from 'functional-examples';
import { createMetaYmlExtractor, type MetaYmlExtractorOptions } from './extractor.js';

export type { MetaYmlExtractorOptions };
export { createMetaYmlExtractor } from './extractor.js';

/**
 * Create the YAML manifest plugin.
 * Provides extractor only (no file contents parser - manifest is separate from content).
 */
export function createYamlManifestPlugin(options?: MetaYmlExtractorOptions): Plugin {
  return {
    name: 'yaml-manifest',
    // No extensions - this isn't file-type specific
    extractor: createMetaYmlExtractor(options),
    // No fileContentsParser - manifest files aren't example content
  };
}
```

**Step 4: Update pnpm-workspace if needed**

Run: `cd /Users/agentender/repos/functional-examples && pnpm install`

**Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: rename extractor-meta-yml to yaml-manifest

- Package renamed to @functional-examples/yaml-manifest
- Added createYamlManifestPlugin() wrapper
- Extractor-only plugin (no file contents parser needed)
EOF
)"
```

---

### Task 13: Remove extractor-frontmatter Package

**Files:**
- Delete: `packages/extractor-frontmatter/`

**Step 1: Remove the package**

Run: `cd /Users/agentender/repos/functional-examples && rm -rf packages/extractor-frontmatter`

**Step 2: Update pnpm workspace**

Run: `cd /Users/agentender/repos/functional-examples && pnpm install`

**Step 3: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: remove extractor-frontmatter package

Functionality replaced by @functional-examples/javascript plugin which
provides language-aware frontmatter extraction with comment support.
EOF
)"
```

---

## Phase 5: Update Core Package and Clean Up

### Task 14: Update Core Package Exports and Documentation

**Files:**
- Modify: `packages/functional-examples/src/index.ts`
- Modify: `packages/functional-examples/README.md`

**Step 1: Ensure all plugin exports are in place**

Verify `packages/functional-examples/src/index.ts` exports:

```typescript
// Types
export type {
  // Core types
  BaseMetadata,
  Example,
  ExampleFile,
  Extractor,
  ExtractorFactory,
  ExtractorError,
  ExtractorOptions,
  ExtractorResult,
  // Plugin system
  Plugin,
  FileContentsParser,
  FileParseContext,
  ParsedRegion,
  // Scanner
  FileConflict,
  PathMapping,
  ScanOptions,
  ScanResult,
  // Config
  Config,
  ExtractorConfig,
  ExtractorConfigOrFunction,
  ExtractorReference,
  ScanConfig,
  ResolvedConfig,
  ValidationError,
} from './types/index.js';

// Functions
export { scanExamples } from './scanner/index.js';
export { PluginRegistry, runParsePipeline, createInitialContext } from './plugins/index.js';
export { readExampleFile, readExampleFiles } from './files/index.js';
export {
  findConfigFile,
  loadConfig,
  mergeConfigs,
  resolveConfig,
  validateConfig,
} from './config/index.js';

// Region utilities (kept for direct use, though plugins handle this)
export {
  parseRegions,
  extractRegion,
  stripRegionMarkers,
  listRegions,
  LANGUAGE_CONFIGS,
} from './regions/index.js';
```

**Step 2: Commit**

```bash
git add packages/functional-examples/
git commit -m "feat: finalize core package exports for plugin architecture"
```

---

### Task 15: Update TODO.md with Completed Work

**Files:**
- Modify: `.ai/plans/TODO.md`

**Step 1: Update TODO to reflect completed refactor**

Update `.ai/plans/TODO.md`:

```markdown
# Completed in Plugin Architecture Refactor

- [x] Plugin system with Extractors + FileContentsParsers
- [x] ExampleFile extended with raw/parsed/hunks
- [x] Region detection via #region/#endregion with language-aware comments
- [x] Frontmatter extractor with comment prefix detection (in @functional-examples/javascript)
- [x] Multi-line block comment frontmatter support
- [x] Per-language plugins (starting with @functional-examples/javascript)

# Future Work (Separate Plan)

- [ ] Plugin schema/validation support
  - validate: (x) => ValidationResult
  - schema: string (JSON schema descriptor)
- [ ] Plugin generics for options and metadata types
- [ ] CLI command: generate JSON schema in .functional-examples/schema
- [ ] CLI command: generate metadata.d.ts from registered plugins
- [ ] Additional language plugins (Python, Go, Rust, etc.)
```

**Step 2: Commit**

```bash
git add .ai/plans/TODO.md
git commit -m "docs: update TODO with completed refactor work"
```

---

### Task 16: Run Full Test Suite and Verify Build

**Step 1: Run all tests**

Run: `cd /Users/agentender/repos/functional-examples && pnpm test`
Expected: All PASS

**Step 2: Build all packages**

Run: `cd /Users/agentender/repos/functional-examples && pnpm build`
Expected: Success

**Step 3: Run linting**

Run: `cd /Users/agentender/repos/functional-examples && pnpm lint`
Expected: No errors

**Step 4: Final commit if any formatting changes**

```bash
git add -A
git commit -m "chore: fix formatting and lint issues" || true
```

---

## Summary

This plan refactors the functional-examples library from an Extractor-only architecture to a Plugin system with:

1. **New Types**: `Plugin`, `FileContentsParser`, `FileParseContext`, `ParsedRegion`
2. **Plugin Registry**: Manages plugins, extension mapping, extractor/parser aggregation
3. **Parse Pipeline**: Accumulator pattern for chaining file content parsers
4. **Scanner Integration**: Uses plugins, runs content through parser pipelines
5. **JavaScript Plugin**: Full implementation with frontmatter + region parsing
6. **Package Cleanup**: Rename meta-yml, remove frontmatter (replaced by language plugins)

The architecture enables:
- Language-specific content processing
- Auto-registration by file extension
- Pipeline-based content transformation
- Clean separation of concerns (finding vs. processing)
