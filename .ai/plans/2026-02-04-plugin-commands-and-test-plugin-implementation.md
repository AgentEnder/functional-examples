# Plugin Commands & Test Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable plugins to expose CLI commands and create a test runner plugin for validating examples.

**Architecture:** Extend the Plugin interface with a `commands` property that can be static or dynamic. Create `@functional-examples/test` package with Zod schemas, test runner, and pluggable reporters. Commands are namespaced under the plugin name with `@functional-examples/` scope stripped.

**Tech Stack:** TypeScript, cli-forge, Zod, zod-to-json-schema, child_process for test execution, Vitest for testing.

---

## Task 1: Extend Plugin Type with Commands Property

**Files:**
- Modify: `packages/functional-examples/src/types/index.ts:249-284`

**Step 1: Add CLI import type and PluginCommands type**

Add at the top of the file with other imports:

```typescript
import type { CLI } from 'cli-forge';
```

Add after the existing type definitions (around line 245):

```typescript
/**
 * Plugin commands can be a static array or a function that receives
 * the resolved config and returns commands (sync or async).
 */
export type PluginCommands<TMetadata = Record<string, unknown>> =
  | CLI[]
  | ((config: ResolvedConfig<TMetadata>) => CLI[] | Promise<CLI[]>);
```

**Step 2: Update Plugin interface**

Add the `commands` property to the Plugin interface:

```typescript
export interface Plugin<TMetadata = Record<string, unknown>> {
  readonly name: string;
  readonly extensions?: string[];
  readonly extractor?: Extractor<TMetadata>;
  readonly fileContentsParser?: FileContentsParser;
  readonly schemas?: PluginSchemas;
  readonly validators?: PluginValidators<TMetadata>;
  readonly commands?: PluginCommands<TMetadata>;
  readonly _options?: unknown;
}
```

**Step 3: Verify types compile**

Run: `cd packages/functional-examples && pnpm build`
Expected: Build succeeds with no type errors

**Step 4: Commit**

```bash
git add packages/functional-examples/src/types/index.ts
git commit -m "feat(types): add commands property to Plugin interface"
```

---

## Task 2: Create Plugin Commands Loader

**Files:**
- Create: `packages/functional-examples/src/cli/plugin-commands.ts`
- Modify: `packages/functional-examples/src/cli/index.ts`

**Step 1: Create plugin-commands.ts**

```typescript
import { cli, type CLI } from 'cli-forge';
import type { Plugin, ResolvedConfig } from '../types/index.js';

/**
 * Get the CLI namespace for a plugin.
 * Strips @functional-examples/ scope, keeps everything else.
 */
export function getCommandNamespace(pluginName: string): string {
  if (pluginName.startsWith('@functional-examples/')) {
    return pluginName.replace('@functional-examples/', '');
  }
  return pluginName;
}

/**
 * Resolve commands from a plugin (handles static array or function).
 */
export async function resolvePluginCommands<T>(
  plugin: Plugin<T>,
  config: ResolvedConfig<T>
): Promise<CLI[]> {
  if (!plugin.commands) return [];

  const commands =
    typeof plugin.commands === 'function'
      ? plugin.commands(config)
      : plugin.commands;

  return Promise.resolve(commands);
}

/**
 * Load all plugin commands, wrapping each plugin's commands
 * under its namespace.
 */
export async function loadPluginCommands<T>(
  plugins: Plugin<T>[],
  config: ResolvedConfig<T>
): Promise<CLI[]> {
  const result: CLI[] = [];

  for (const plugin of plugins) {
    const commands = await resolvePluginCommands(plugin, config);
    if (commands.length === 0) continue;

    const namespace = getCommandNamespace(plugin.name);

    // If plugin has a single command with same name as namespace,
    // use it directly (for $0 pattern like test plugin)
    if (commands.length === 1 && commands[0].name === namespace) {
      result.push(commands[0]);
    } else {
      // Wrap multiple commands under namespace
      const namespaced = cli(namespace, {
        description: `Commands from ${plugin.name}`,
      }).commands(...commands);

      result.push(namespaced);
    }
  }

  return result;
}
```

**Step 2: Export from cli module**

Create or update `packages/functional-examples/src/cli/commands/index.ts` if needed, but primarily we need to use this in the main CLI entry.

**Step 3: Verify file created**

Run: `ls packages/functional-examples/src/cli/plugin-commands.ts`
Expected: File exists

**Step 4: Commit**

```bash
git add packages/functional-examples/src/cli/plugin-commands.ts
git commit -m "feat(cli): add plugin commands loader with namespace resolution"
```

---

## Task 3: Wire Plugin Commands into CLI Entry

**Files:**
- Modify: `packages/functional-examples/src/cli/index.ts`

**Step 1: Update CLI entry to load plugin commands**

Replace the contents of `packages/functional-examples/src/cli/index.ts`:

```typescript
#!/usr/bin/env node
import { cli } from 'cli-forge';
import { scanCommand } from './commands/scan.js';
import { validateCommand } from './commands/validate.js';
import { initCommand } from './commands/init.js';
import { generateCommand } from './commands/generate.js';
import { loadPluginCommands } from './plugin-commands.js';
import { loadConfig } from '../config/loader.js';
import { resolveConfig } from '../config/resolver.js';
import { findConfigFile } from '../config/find.js';

async function main() {
  const app = cli('functional-examples', {
    description: 'Extract and manage code examples',
  })
    .version('0.0.1')
    .commands(scanCommand, validateCommand, initCommand, generateCommand);

  // Try to load config and register plugin commands
  try {
    const configPath = await findConfigFile(process.cwd());
    if (configPath) {
      const config = await loadConfig(configPath);
      const resolved = await resolveConfig(config);

      if (resolved.plugins.length > 0) {
        const pluginCLIs = await loadPluginCommands(resolved.plugins, resolved);
        if (pluginCLIs.length > 0) {
          app.commands(...pluginCLIs);
        }
      }
    }
  } catch {
    // Config loading failed - continue without plugin commands
    // Individual commands will report config errors as needed
  }

  app.forge();
}

const app = cli('functional-examples', {
  description: 'Extract and manage code examples',
})
  .version('0.0.1')
  .commands(scanCommand, validateCommand, initCommand, generateCommand);

export default app;

main();
```

**Step 2: Verify build**

Run: `cd packages/functional-examples && pnpm build`
Expected: Build succeeds

**Step 3: Verify CLI still works**

Run: `node packages/functional-examples/dist/cli/index.js --help`
Expected: Shows help with existing commands

**Step 4: Commit**

```bash
git add packages/functional-examples/src/cli/index.ts
git commit -m "feat(cli): wire plugin commands into main CLI entry"
```

---

## Task 4: Add Plugin Commands Unit Tests

**Files:**
- Create: `packages/functional-examples/src/cli/plugin-commands.spec.ts`

**Step 1: Write tests for namespace resolution**

```typescript
import { describe, it, expect } from 'vitest';
import { getCommandNamespace, resolvePluginCommands } from './plugin-commands.js';
import { cli } from 'cli-forge';
import type { Plugin, ResolvedConfig } from '../types/index.js';

describe('getCommandNamespace', () => {
  it('strips @functional-examples/ scope', () => {
    expect(getCommandNamespace('@functional-examples/test')).toBe('test');
    expect(getCommandNamespace('@functional-examples/foo-bar')).toBe('foo-bar');
  });

  it('keeps other scopes intact', () => {
    expect(getCommandNamespace('@acme/runner')).toBe('@acme/runner');
    expect(getCommandNamespace('@other/plugin')).toBe('@other/plugin');
  });

  it('keeps unscoped names intact', () => {
    expect(getCommandNamespace('my-plugin')).toBe('my-plugin');
    expect(getCommandNamespace('simple')).toBe('simple');
  });
});

describe('resolvePluginCommands', () => {
  const mockConfig = {} as ResolvedConfig<unknown>;

  it('returns empty array when no commands', async () => {
    const plugin: Plugin = { name: 'test' };
    const result = await resolvePluginCommands(plugin, mockConfig);
    expect(result).toEqual([]);
  });

  it('returns static commands array', async () => {
    const testCmd = cli('test', {});
    const plugin: Plugin = {
      name: 'test',
      commands: [testCmd],
    };
    const result = await resolvePluginCommands(plugin, mockConfig);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(testCmd);
  });

  it('calls function and returns commands', async () => {
    const testCmd = cli('test', {});
    const plugin: Plugin = {
      name: 'test',
      commands: () => [testCmd],
    };
    const result = await resolvePluginCommands(plugin, mockConfig);
    expect(result).toHaveLength(1);
  });

  it('handles async function', async () => {
    const testCmd = cli('test', {});
    const plugin: Plugin = {
      name: 'test',
      commands: async () => [testCmd],
    };
    const result = await resolvePluginCommands(plugin, mockConfig);
    expect(result).toHaveLength(1);
  });
});
```

**Step 2: Run tests**

Run: `cd packages/functional-examples && pnpm test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add packages/functional-examples/src/cli/plugin-commands.spec.ts
git commit -m "test(cli): add unit tests for plugin commands loader"
```

---

## Task 5: Create Test Plugin Package Structure

**Files:**
- Create: `packages/test/package.json`
- Create: `packages/test/tsconfig.json`
- Create: `packages/test/tsconfig.lib.json`
- Create: `packages/test/vitest.config.ts`
- Create: `packages/test/src/index.ts` (placeholder)

**Step 1: Create package.json**

```json
{
  "name": "@functional-examples/test",
  "version": "0.0.1",
  "type": "module",
  "description": "Test runner plugin for functional-examples",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.js"
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
  "dependencies": {
    "zod": "^3.24.0",
    "zod-to-json-schema": "^3.24.0"
  },
  "devDependencies": {
    "cli-forge": "^1.1.0",
    "functional-examples": "workspace:*",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create tsconfig.lib.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "tsBuildInfoFile": "../../dist/tsc/test.lib.tsbuildinfo"
  },
  "exclude": ["src/**/*.spec.ts", "src/**/*.test.ts", "node_modules", "dist"]
}
```

**Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'src/**/types.ts'],
    },
  },
});
```

**Step 5: Create placeholder index.ts**

```typescript
// @functional-examples/test
// Test runner plugin for functional-examples

export const VERSION = '0.0.1';
```

**Step 6: Install dependencies**

Run: `pnpm install`
Expected: Dependencies installed successfully

**Step 7: Verify build**

Run: `cd packages/test && pnpm build`
Expected: Build succeeds

**Step 8: Commit**

```bash
git add packages/test/
git commit -m "feat(test): create test plugin package structure"
```

---

## Task 6: Implement Zod Schema for Test Metadata

**Files:**
- Create: `packages/test/src/schema.ts`

**Step 1: Create schema.ts with Zod definitions**

```typescript
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Assertions for stdout/stderr output
 */
const stdioAssertionsSchema = z
  .object({
    contains: z.string().optional(),
    matches: z.string().optional(),
  })
  .optional();

/**
 * Test assertions
 */
const assertionsSchema = z
  .object({
    exitCode: z.number().int().optional(),
    stdout: stdioAssertionsSchema,
    stderr: stdioAssertionsSchema,
  })
  .optional();

/**
 * Test execution options
 */
const testOptionsSchema = z.object({
  command: z.string().describe('Command to execute'),
  cwd: z.string().optional().describe('Working directory relative to example'),
  env: z.record(z.string()).optional().describe('Environment variables'),
  timeout: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Timeout in milliseconds'),
});

/**
 * Single test case
 */
export const testCaseSchema = z.object({
  name: z.string().describe('Test name'),
  options: testOptionsSchema,
  assertions: assertionsSchema,
});

/**
 * Test field can be single test or array
 */
const testFieldSchema = z.union([testCaseSchema, z.array(testCaseSchema)]);

/**
 * Metadata extension for test plugin
 */
export const testMetadataSchema = z.object({
  test: testFieldSchema.optional(),
});

// Inferred types
export type TestCase = z.infer<typeof testCaseSchema>;
export type TestOptions = z.infer<typeof testOptionsSchema>;
export type TestAssertions = z.infer<typeof assertionsSchema>;
export type TestMetadata = z.infer<typeof testMetadataSchema>;

// JSON Schema for plugin registration
export const TEST_METADATA_JSON_SCHEMA = zodToJsonSchema(testMetadataSchema, {
  name: 'TestMetadata',
  $refStrategy: 'none',
});
```

**Step 2: Verify build**

Run: `cd packages/test && pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add packages/test/src/schema.ts
git commit -m "feat(test): add Zod schema for test metadata"
```

---

## Task 7: Add Schema Unit Tests

**Files:**
- Create: `packages/test/src/schema.spec.ts`

**Step 1: Write schema validation tests**

```typescript
import { describe, it, expect } from 'vitest';
import { testCaseSchema, testMetadataSchema } from './schema.js';

describe('testCaseSchema', () => {
  it('validates minimal test case', () => {
    const result = testCaseSchema.safeParse({
      name: 'my test',
      options: { command: 'node index.js' },
    });
    expect(result.success).toBe(true);
  });

  it('validates full test case', () => {
    const result = testCaseSchema.safeParse({
      name: 'full test',
      options: {
        command: 'node index.js',
        cwd: './src',
        env: { NODE_ENV: 'test' },
        timeout: 5000,
      },
      assertions: {
        exitCode: 0,
        stdout: { contains: 'Hello', matches: 'Hello.*World' },
        stderr: { contains: 'warning' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const result = testCaseSchema.safeParse({
      options: { command: 'node index.js' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing command', () => {
    const result = testCaseSchema.safeParse({
      name: 'my test',
      options: {},
    });
    expect(result.success).toBe(false);
  });
});

describe('testMetadataSchema', () => {
  it('validates single test', () => {
    const result = testMetadataSchema.safeParse({
      test: {
        name: 'single',
        options: { command: 'echo hello' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('validates array of tests', () => {
    const result = testMetadataSchema.safeParse({
      test: [
        { name: 'first', options: { command: 'echo 1' } },
        { name: 'second', options: { command: 'echo 2' } },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('allows missing test field', () => {
    const result = testMetadataSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run tests**

Run: `cd packages/test && pnpm test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add packages/test/src/schema.spec.ts
git commit -m "test(test): add schema validation tests"
```

---

## Task 8: Create Reporter Types and Interface

**Files:**
- Create: `packages/test/src/reporters/types.ts`

**Step 1: Create reporter types**

```typescript
import type { Example } from 'functional-examples';

/**
 * Result of a single test execution
 */
export interface TestResult {
  /** Example ID or path */
  example: string;
  /** Test case name */
  test: string;
  /** Whether the test passed */
  passed: boolean;
  /** Execution duration in ms */
  duration: number;
  /** Error message if failed */
  error?: string;
  /** Actual command output */
  actual?: {
    exitCode: number;
    stdout: string;
    stderr: string;
  };
}

/**
 * Summary of test run
 */
export interface TestSummary {
  passed: number;
  failed: number;
  bail?: boolean;
}

/**
 * Reporter interface for test output
 */
export interface Reporter {
  /** Called before running tests */
  start(examples: Example[]): void | Promise<void>;
  /** Called after each test */
  report(result: TestResult, verbose: boolean): void | Promise<void>;
  /** Called after all tests complete */
  finish(summary: TestSummary): void | Promise<void>;
}

/**
 * Factory function that creates a reporter instance
 */
export type ReporterFactory = () => Reporter;

/**
 * Reporter config can be a factory or module path string
 */
export type ReporterConfig = ReporterFactory | string;
```

**Step 2: Commit**

```bash
git add packages/test/src/reporters/types.ts
git commit -m "feat(test): add reporter types and interface"
```

---

## Task 9: Implement Pretty Reporter

**Files:**
- Create: `packages/test/src/reporters/pretty.ts`

**Step 1: Create pretty reporter**

```typescript
import type { Reporter, TestResult, TestSummary } from './types.js';
import type { Example } from 'functional-examples';

const PASS = '\x1b[32m PASS \x1b[0m';
const FAIL = '\x1b[31m FAIL \x1b[0m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';

function countTests(examples: Example[]): number {
  return examples.reduce((sum, e) => {
    const test = (e.metadata as { test?: unknown })?.test;
    if (!test) return sum;
    return sum + (Array.isArray(test) ? test.length : 1);
  }, 0);
}

export function createPrettyReporter(): Reporter {
  return {
    start(examples) {
      const testCount = countTests(examples);
      console.log(
        `\nRunning ${testCount} test${testCount !== 1 ? 's' : ''} from ${examples.length} example${examples.length !== 1 ? 's' : ''}\n`
      );
    },

    report(result, verbose) {
      const status = result.passed ? PASS : FAIL;
      const duration = `${DIM}(${result.duration}ms)${RESET}`;

      console.log(`${status} ${result.example} > ${result.test} ${duration}`);

      if (!result.passed && result.error) {
        const indented = result.error
          .split('\n')
          .map((line) => `       ${line}`)
          .join('\n');
        console.log(indented);
        if (result.actual) {
          console.log(`       ${DIM}Exit code: ${result.actual.exitCode}${RESET}`);
        }
      }

      if (verbose && result.passed && result.actual) {
        if (result.actual.stdout) {
          const truncated = result.actual.stdout.slice(0, 200);
          console.log(`       ${DIM}stdout: ${truncated}${RESET}`);
        }
      }
    },

    finish({ passed, failed, bail }) {
      console.log('');
      if (bail) {
        console.log(`${YELLOW}Bailed after first failure${RESET}\n`);
      }

      const parts: string[] = [];
      if (failed > 0) parts.push(`${RED}${failed} failed${RESET}`);
      if (passed > 0) parts.push(`${GREEN}${passed} passed${RESET}`);
      parts.push(`${passed + failed} total`);

      console.log(`Tests: ${parts.join(', ')}`);
    },
  };
}
```

**Step 2: Commit**

```bash
git add packages/test/src/reporters/pretty.ts
git commit -m "feat(test): implement pretty reporter"
```

---

## Task 10: Implement TAP Reporter

**Files:**
- Create: `packages/test/src/reporters/tap.ts`

**Step 1: Create TAP reporter**

```typescript
import type { Reporter, TestResult } from './types.js';
import type { Example } from 'functional-examples';

function countTests(examples: Example[]): number {
  return examples.reduce((sum, e) => {
    const test = (e.metadata as { test?: unknown })?.test;
    if (!test) return sum;
    return sum + (Array.isArray(test) ? test.length : 1);
  }, 0);
}

export function createTapReporter(): Reporter {
  let testNumber = 0;

  return {
    start(examples) {
      const total = countTests(examples);
      console.log('TAP version 14');
      console.log(`1..${total}`);
    },

    report(result, _verbose) {
      testNumber++;
      const status = result.passed ? 'ok' : 'not ok';
      const name = `${result.example} > ${result.test}`;

      console.log(`${status} ${testNumber} - ${name}`);

      if (!result.passed) {
        console.log('  ---');
        if (result.error) {
          const escaped = result.error.replace(/"/g, '\\"');
          console.log(`  message: "${escaped}"`);
        }
        if (result.actual) {
          console.log(`  actual_exit_code: ${result.actual.exitCode}`);
          if (result.actual.stdout) {
            console.log('  stdout: |');
            result.actual.stdout.split('\n').forEach((line) => {
              console.log(`    ${line}`);
            });
          }
          if (result.actual.stderr) {
            console.log('  stderr: |');
            result.actual.stderr.split('\n').forEach((line) => {
              console.log(`    ${line}`);
            });
          }
        }
        console.log('  ...');
      }
    },

    finish({ passed, failed }) {
      console.log(`# tests ${passed + failed}`);
      console.log(`# pass ${passed}`);
      console.log(`# fail ${failed}`);
    },
  };
}
```

**Step 2: Commit**

```bash
git add packages/test/src/reporters/tap.ts
git commit -m "feat(test): implement TAP reporter"
```

---

## Task 11: Create Reporter Resolver

**Files:**
- Create: `packages/test/src/reporters/resolve.ts`
- Create: `packages/test/src/reporters/index.ts`

**Step 1: Create resolve.ts**

```typescript
import type { ReporterFactory, ReporterConfig } from './types.js';
import { createPrettyReporter } from './pretty.js';
import { createTapReporter } from './tap.js';

export const BUILTIN_REPORTERS: Record<string, ReporterFactory> = {
  pretty: createPrettyReporter,
  tap: createTapReporter,
};

/**
 * Load a reporter from a module path
 */
async function loadReporterModule(modulePath: string): Promise<ReporterFactory> {
  try {
    const mod = await import(modulePath);
    const factory = mod.default ?? mod.reporter ?? mod.createReporter;

    if (typeof factory !== 'function') {
      throw new Error(
        `Reporter module "${modulePath}" must export a factory function ` +
          `as default, 'reporter', or 'createReporter'`
      );
    }

    return factory;
  } catch (err) {
    throw new Error(
      `Failed to load reporter from "${modulePath}": ${err instanceof Error ? err.message : err}`
    );
  }
}

/**
 * Resolve reporter configs to factory functions
 */
export async function resolveReporters(
  custom: Record<string, ReporterConfig> = {}
): Promise<Record<string, ReporterFactory>> {
  const resolved: Record<string, ReporterFactory> = { ...BUILTIN_REPORTERS };

  for (const [name, config] of Object.entries(custom)) {
    if (typeof config === 'function') {
      resolved[name] = config;
    } else if (typeof config === 'string') {
      resolved[name] = await loadReporterModule(config);
    }
  }

  return resolved;
}
```

**Step 2: Create index.ts for reporters**

```typescript
export type {
  Reporter,
  ReporterFactory,
  ReporterConfig,
  TestResult,
  TestSummary,
} from './types.js';
export { createPrettyReporter } from './pretty.js';
export { createTapReporter } from './tap.js';
export { resolveReporters, BUILTIN_REPORTERS } from './resolve.js';
```

**Step 3: Commit**

```bash
git add packages/test/src/reporters/resolve.ts packages/test/src/reporters/index.ts
git commit -m "feat(test): add reporter resolver with module path support"
```

---

## Task 12: Implement Test Runner Core

**Files:**
- Create: `packages/test/src/runner.ts`

**Step 1: Create runner.ts**

```typescript
import { spawn } from 'child_process';
import { join } from 'path';
import type { TestCase, TestAssertions } from './schema.js';
import type { TestResult } from './reporters/types.js';

interface ExecuteOptions {
  cwd: string;
  env?: Record<string, string>;
  timeout: number;
}

interface ExecuteResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Execute a command and capture output
 */
async function executeCommand(
  command: string,
  options: ExecuteOptions
): Promise<ExecuteResult> {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(/\s+/);
    const proc = spawn(cmd, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`Command timed out after ${options.timeout}ms`));
    }, options.timeout);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Check assertions against actual output
 */
function checkAssertions(
  assertions: TestAssertions | undefined,
  actual: ExecuteResult
): string[] {
  const failures: string[] = [];
  if (!assertions) return failures;

  if (assertions.exitCode !== undefined && actual.exitCode !== assertions.exitCode) {
    failures.push(
      `Expected exit code ${assertions.exitCode}, got ${actual.exitCode}`
    );
  }

  if (assertions.stdout?.contains && !actual.stdout.includes(assertions.stdout.contains)) {
    failures.push(
      `Expected stdout to contain "${assertions.stdout.contains}"`
    );
  }

  if (assertions.stdout?.matches) {
    try {
      const regex = new RegExp(assertions.stdout.matches);
      if (!regex.test(actual.stdout)) {
        failures.push(
          `Expected stdout to match /${assertions.stdout.matches}/`
        );
      }
    } catch {
      failures.push(`Invalid stdout regex: ${assertions.stdout.matches}`);
    }
  }

  if (assertions.stderr?.contains && !actual.stderr.includes(assertions.stderr.contains)) {
    failures.push(
      `Expected stderr to contain "${assertions.stderr.contains}"`
    );
  }

  if (assertions.stderr?.matches) {
    try {
      const regex = new RegExp(assertions.stderr.matches);
      if (!regex.test(actual.stderr)) {
        failures.push(
          `Expected stderr to match /${assertions.stderr.matches}/`
        );
      }
    } catch {
      failures.push(`Invalid stderr regex: ${assertions.stderr.matches}`);
    }
  }

  return failures;
}

export interface RunTestOptions {
  timeout: number;
}

/**
 * Run a single test case against an example
 */
export async function runTest(
  exampleId: string,
  examplePath: string,
  testCase: TestCase,
  options: RunTestOptions
): Promise<TestResult> {
  const startTime = Date.now();
  const cwd = testCase.options.cwd
    ? join(examplePath, testCase.options.cwd)
    : examplePath;

  try {
    const actual = await executeCommand(testCase.options.command, {
      cwd,
      env: testCase.options.env,
      timeout: testCase.options.timeout ?? options.timeout,
    });

    const failures = checkAssertions(testCase.assertions, actual);

    return {
      example: exampleId,
      test: testCase.name,
      passed: failures.length === 0,
      duration: Date.now() - startTime,
      error: failures.length > 0 ? failures.join('\n') : undefined,
      actual,
    };
  } catch (err) {
    return {
      example: exampleId,
      test: testCase.name,
      passed: false,
      duration: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Normalize test field to array
 */
export function normalizeTests(test: TestCase | TestCase[]): TestCase[] {
  return Array.isArray(test) ? test : [test];
}
```

**Step 2: Commit**

```bash
git add packages/test/src/runner.ts
git commit -m "feat(test): implement test runner core with command execution"
```

---

## Task 13: Add Runner Unit Tests

**Files:**
- Create: `packages/test/src/runner.spec.ts`

**Step 1: Write runner tests**

```typescript
import { describe, it, expect } from 'vitest';
import { runTest, normalizeTests } from './runner.js';
import type { TestCase } from './schema.js';

describe('normalizeTests', () => {
  it('wraps single test in array', () => {
    const single: TestCase = {
      name: 'test',
      options: { command: 'echo hello' },
    };
    expect(normalizeTests(single)).toEqual([single]);
  });

  it('returns array as-is', () => {
    const arr: TestCase[] = [
      { name: 'test1', options: { command: 'echo 1' } },
      { name: 'test2', options: { command: 'echo 2' } },
    ];
    expect(normalizeTests(arr)).toBe(arr);
  });
});

describe('runTest', () => {
  it('passes when command succeeds with no assertions', async () => {
    const result = await runTest(
      'test-example',
      process.cwd(),
      {
        name: 'simple echo',
        options: { command: 'echo hello' },
      },
      { timeout: 5000 }
    );

    expect(result.passed).toBe(true);
    expect(result.example).toBe('test-example');
    expect(result.test).toBe('simple echo');
    expect(result.actual?.stdout).toContain('hello');
  });

  it('passes with matching exit code', async () => {
    const result = await runTest(
      'test-example',
      process.cwd(),
      {
        name: 'exit code test',
        options: { command: 'exit 0' },
        assertions: { exitCode: 0 },
      },
      { timeout: 5000 }
    );

    expect(result.passed).toBe(true);
  });

  it('fails with mismatched exit code', async () => {
    const result = await runTest(
      'test-example',
      process.cwd(),
      {
        name: 'exit code test',
        options: { command: 'exit 1' },
        assertions: { exitCode: 0 },
      },
      { timeout: 5000 }
    );

    expect(result.passed).toBe(false);
    expect(result.error).toContain('Expected exit code 0');
  });

  it('passes with stdout contains', async () => {
    const result = await runTest(
      'test-example',
      process.cwd(),
      {
        name: 'stdout test',
        options: { command: 'echo "Hello World"' },
        assertions: { stdout: { contains: 'Hello' } },
      },
      { timeout: 5000 }
    );

    expect(result.passed).toBe(true);
  });

  it('fails with missing stdout content', async () => {
    const result = await runTest(
      'test-example',
      process.cwd(),
      {
        name: 'stdout test',
        options: { command: 'echo "Hello"' },
        assertions: { stdout: { contains: 'World' } },
      },
      { timeout: 5000 }
    );

    expect(result.passed).toBe(false);
    expect(result.error).toContain('Expected stdout to contain');
  });

  it('passes with stdout regex match', async () => {
    const result = await runTest(
      'test-example',
      process.cwd(),
      {
        name: 'regex test',
        options: { command: 'echo "Hello World 123"' },
        assertions: { stdout: { matches: 'World \\d+' } },
      },
      { timeout: 5000 }
    );

    expect(result.passed).toBe(true);
  });
});
```

**Step 2: Run tests**

Run: `cd packages/test && pnpm test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add packages/test/src/runner.spec.ts
git commit -m "test(test): add runner unit tests"
```

---

## Task 14: Create Plugin Types

**Files:**
- Create: `packages/test/src/types.ts`

**Step 1: Create types.ts**

```typescript
import type { ReporterConfig, ReporterFactory } from './reporters/types.js';

/**
 * Options for the test plugin
 */
export interface TestPluginOptions {
  /**
   * Default timeout for tests in ms
   * @default 30000
   */
  timeout?: number;

  /**
   * Custom reporters keyed by name.
   * Can be a factory function or module path string.
   * Built-in: 'pretty', 'tap'
   */
  reporters?: Record<string, ReporterConfig>;

  /**
   * Default reporter when not in CI
   * @default 'pretty'
   */
  defaultReporter?: string;

  /**
   * Default reporter when in CI
   * @default 'tap'
   */
  ciReporter?: string;
}

/**
 * Resolved options with reporter factories
 */
export interface ResolvedTestPluginOptions {
  timeout: number;
  reporters: Record<string, ReporterFactory>;
  defaultReporter: string;
  ciReporter: string;
}
```

**Step 2: Commit**

```bash
git add packages/test/src/types.ts
git commit -m "feat(test): add plugin options types"
```

---

## Task 15: Implement Test CLI Commands

**Files:**
- Create: `packages/test/src/commands/test.ts`
- Create: `packages/test/src/commands/list.ts`
- Create: `packages/test/src/commands/index.ts`

**Step 1: Create test.ts (main command)**

```typescript
import { cli } from 'cli-forge';
import type { ResolvedConfig, Example } from 'functional-examples';
import { scanExamples } from 'functional-examples';
import type { ResolvedTestPluginOptions } from '../types.js';
import type { TestMetadata, TestCase } from '../schema.js';
import { testMetadataSchema } from '../schema.js';
import { runTest, normalizeTests } from '../runner.js';

function isCI(): boolean {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.JENKINS_URL ||
    process.env.TRAVIS
  );
}

function hasTests(example: Example): example is Example & { metadata: { test: TestCase | TestCase[] } } {
  const result = testMetadataSchema.safeParse(example.metadata);
  return result.success && result.data.test !== undefined;
}

export function createTestCommand(
  config: ResolvedConfig,
  pluginOpts: ResolvedTestPluginOptions
) {
  const { reporters, defaultReporter, ciReporter, timeout } = pluginOpts;

  return cli('test', {
    description: 'Run tests for functional examples',
  })
    .positional('path', {
      type: 'string',
      description: 'Path to examples directory',
      default: '.',
    })
    .option('filter', {
      type: 'string',
      alias: 'f',
      description: 'Filter examples by id pattern',
    })
    .option('bail', {
      type: 'boolean',
      alias: 'b',
      description: 'Stop on first failure',
      default: false,
    })
    .option('verbose', {
      type: 'boolean',
      alias: 'v',
      description: 'Show command output even on success',
      default: false,
    })
    .option('format', {
      type: 'string',
      description: `Output format (default: ${defaultReporter} in TTY, ${ciReporter} in CI)`,
    })
    .option('timeout', {
      type: 'number',
      description: 'Default timeout in ms',
      default: timeout,
    })
    .handler(async (args) => {
      const formatName = args.format ?? (isCI() ? ciReporter : defaultReporter);
      const reporterFactory = reporters[formatName];

      if (!reporterFactory) {
        console.error(`Unknown reporter: ${formatName}`);
        console.error(`Available: ${Object.keys(reporters).join(', ')}`);
        process.exit(1);
      }

      const reporter = reporterFactory();

      // Scan for examples
      const { examples } = await scanExamples({
        root: args.path,
        plugins: config.plugins,
        pathMappings: config.pathMappings,
        include: config.scan.include,
        exclude: config.scan.exclude,
      });

      // Filter to examples with tests
      let testableExamples = examples.filter(hasTests);

      // Apply filter pattern
      if (args.filter) {
        const pattern = args.filter.toLowerCase();
        testableExamples = testableExamples.filter(
          (e) =>
            e.id.toLowerCase().includes(pattern) ||
            e.path.toLowerCase().includes(pattern)
        );
      }

      if (testableExamples.length === 0) {
        console.log('No examples with tests found');
        process.exit(0);
      }

      await reporter.start(testableExamples);

      let passed = 0;
      let failed = 0;

      for (const example of testableExamples) {
        const tests = normalizeTests(example.metadata.test);

        for (const testCase of tests) {
          const result = await runTest(example.id, example.path, testCase, {
            timeout: args.timeout,
          });

          await reporter.report(result, args.verbose);

          if (result.passed) {
            passed++;
          } else {
            failed++;
            if (args.bail) {
              await reporter.finish({ passed, failed, bail: true });
              process.exit(1);
            }
          }
        }
      }

      await reporter.finish({ passed, failed });
      process.exit(failed > 0 ? 1 : 0);
    });
}
```

**Step 2: Create list.ts**

```typescript
import { cli } from 'cli-forge';
import type { ResolvedConfig, Example } from 'functional-examples';
import { scanExamples } from 'functional-examples';
import type { TestMetadata, TestCase } from '../schema.js';
import { testMetadataSchema } from '../schema.js';
import { normalizeTests } from '../runner.js';

function hasTests(example: Example): example is Example & { metadata: { test: TestCase | TestCase[] } } {
  const result = testMetadataSchema.safeParse(example.metadata);
  return result.success && result.data.test !== undefined;
}

export function createListCommand(config: ResolvedConfig) {
  return cli('list', {
    description: 'List available tests',
  })
    .positional('path', {
      type: 'string',
      description: 'Path to examples directory',
      default: '.',
    })
    .option('format', {
      type: 'string',
      choices: ['table', 'json'] as const,
      description: 'Output format',
      default: 'table',
    })
    .handler(async (args) => {
      const { examples } = await scanExamples({
        root: args.path,
        plugins: config.plugins,
        pathMappings: config.pathMappings,
        include: config.scan.include,
        exclude: config.scan.exclude,
      });

      const testableExamples = examples.filter(hasTests);

      const testList = testableExamples.flatMap((example) => {
        const tests = normalizeTests(example.metadata.test);
        return tests.map((t) => ({
          example: example.id,
          test: t.name,
          command: t.options.command,
        }));
      });

      if (args.format === 'json') {
        console.log(JSON.stringify(testList, null, 2));
        return;
      }

      // Table format
      if (testList.length === 0) {
        console.log('No tests found');
        return;
      }

      console.log(
        'Example'.padEnd(30) + 'Test'.padEnd(30) + 'Command'
      );
      console.log('-'.repeat(80));

      for (const t of testList) {
        console.log(
          t.example.slice(0, 28).padEnd(30) +
            t.test.slice(0, 28).padEnd(30) +
            t.command
        );
      }
    });
}
```

**Step 3: Create commands/index.ts**

```typescript
import { cli } from 'cli-forge';
import type { ResolvedConfig } from 'functional-examples';
import type { ResolvedTestPluginOptions } from '../types.js';
import { createTestCommand } from './test.js';
import { createListCommand } from './list.js';

export function createTestCommands(
  config: ResolvedConfig,
  pluginOpts: ResolvedTestPluginOptions
) {
  // Main test command with list as subcommand
  const testCommand = createTestCommand(config, pluginOpts)
    .commands(createListCommand(config));

  return [testCommand];
}
```

**Step 4: Commit**

```bash
git add packages/test/src/commands/
git commit -m "feat(test): implement test and list CLI commands"
```

---

## Task 16: Create Plugin Factory and Main Export

**Files:**
- Modify: `packages/test/src/index.ts`

**Step 1: Replace index.ts with full plugin implementation**

```typescript
import type { Plugin } from 'functional-examples';
import { testMetadataSchema, TEST_METADATA_JSON_SCHEMA } from './schema.js';
import type { TestMetadata } from './schema.js';
import type { TestPluginOptions } from './types.js';
import { resolveReporters } from './reporters/resolve.js';
import { createTestCommands } from './commands/index.js';

/**
 * Validate test metadata using Zod schema
 */
function validateTestMetadata(
  metadata: unknown
): Array<{ path: string; message: string }> {
  const result = testMetadataSchema.safeParse(metadata);
  if (result.success) return [];

  return result.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * Create the test plugin
 */
export function createTestPlugin(
  options: TestPluginOptions = {}
): Plugin<TestMetadata> {
  return {
    name: '@functional-examples/test',
    schemas: {
      metadata: TEST_METADATA_JSON_SCHEMA,
    },
    validators: {
      metadata: validateTestMetadata,
    },
    commands: async (config) => {
      const reporters = await resolveReporters(options.reporters);

      return createTestCommands(config, {
        reporters,
        defaultReporter: options.defaultReporter ?? 'pretty',
        ciReporter: options.ciReporter ?? 'tap',
        timeout: options.timeout ?? 30000,
      });
    },
    _options: options,
  };
}

// Re-export types for consumers
export type { TestPluginOptions } from './types.js';
export type { TestCase, TestMetadata, TestOptions, TestAssertions } from './schema.js';
export type {
  Reporter,
  ReporterFactory,
  ReporterConfig,
  TestResult,
  TestSummary,
} from './reporters/types.js';

// Re-export reporter factories for custom compositions
export { createPrettyReporter } from './reporters/pretty.js';
export { createTapReporter } from './reporters/tap.js';
```

**Step 2: Verify build**

Run: `cd packages/test && pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add packages/test/src/index.ts
git commit -m "feat(test): create plugin factory and main exports"
```

---

## Task 17: Add Integration Test Example

**Files:**
- Create: `examples/test-plugin-example/meta.yml`
- Create: `examples/test-plugin-example/hello.js`

**Step 1: Create example directory with test**

`examples/test-plugin-example/meta.yml`:
```yaml
id: test-plugin-example
title: Test Plugin Example
description: Demonstrates the test plugin

test:
  - name: runs hello script
    options:
      command: node hello.js
    assertions:
      exitCode: 0
      stdout:
        contains: "Hello from example"

  - name: fails with bad args
    options:
      command: node hello.js --fail
    assertions:
      exitCode: 1
      stderr:
        contains: "Error"
```

`examples/test-plugin-example/hello.js`:
```javascript
const args = process.argv.slice(2);

if (args.includes('--fail')) {
  console.error('Error: intentional failure');
  process.exit(1);
}

console.log('Hello from example!');
```

**Step 2: Commit**

```bash
git add examples/test-plugin-example/
git commit -m "feat(examples): add test plugin example"
```

---

## Task 18: Update Root Config to Include Test Plugin

**Files:**
- Modify: `examples/functional-examples.config.ts`

**Step 1: Add test plugin to config**

Add the import and plugin registration (exact changes depend on current config content - read file first):

```typescript
import { createTestPlugin } from '@functional-examples/test';

// Add to plugins array:
createTestPlugin(),
```

**Step 2: Install test plugin in examples workspace**

Update `examples/package.json` to add:
```json
"@functional-examples/test": "workspace:*"
```

Run: `pnpm install`

**Step 3: Verify CLI works**

Run: `cd examples && pnpm functional-examples test --help`
Expected: Shows test command help

**Step 4: Run test against example**

Run: `cd examples && pnpm functional-examples test ./test-plugin-example`
Expected: Tests run and show results

**Step 5: Commit**

```bash
git add examples/functional-examples.config.ts examples/package.json
git commit -m "feat(examples): integrate test plugin into config"
```

---

## Task 19: Add End-to-End Tests for Test Plugin

**Files:**
- Create: `packages/test/src/integration.spec.ts`

**Step 1: Write E2E tests**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { runTest, normalizeTests } from './runner.js';
import type { TestCase } from './schema.js';

describe('test plugin integration', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'test-plugin-'));

    // Create test example
    await writeFile(
      join(tempDir, 'script.js'),
      `console.log('Hello Test');`
    );
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('runs test against real script', async () => {
    const testCase: TestCase = {
      name: 'prints hello',
      options: { command: 'node script.js' },
      assertions: {
        exitCode: 0,
        stdout: { contains: 'Hello Test' },
      },
    };

    const result = await runTest('test-example', tempDir, testCase, {
      timeout: 5000,
    });

    expect(result.passed).toBe(true);
  });

  it('normalizes single test to array', () => {
    const single: TestCase = {
      name: 'test',
      options: { command: 'echo hi' },
    };

    expect(normalizeTests(single)).toEqual([single]);
  });

  it('handles timeout', async () => {
    const testCase: TestCase = {
      name: 'slow test',
      options: { command: 'sleep 10' },
    };

    const result = await runTest('test-example', tempDir, testCase, {
      timeout: 100,
    });

    expect(result.passed).toBe(false);
    expect(result.error).toContain('timed out');
  });
});
```

**Step 2: Run tests**

Run: `cd packages/test && pnpm test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add packages/test/src/integration.spec.ts
git commit -m "test(test): add integration tests"
```

---

## Task 20: Final Build and Verification

**Step 1: Build all packages**

Run: `pnpm -r build`
Expected: All packages build successfully

**Step 2: Run all tests**

Run: `pnpm -r test`
Expected: All tests pass

**Step 3: Verify test plugin works end-to-end**

Run: `cd examples && node ../packages/functional-examples/dist/cli/index.js test list`
Expected: Lists available tests

Run: `cd examples && node ../packages/functional-examples/dist/cli/index.js test`
Expected: Runs tests with pretty output

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete plugin commands and test plugin implementation"
```

---

## Summary

This plan implements:

1. **Plugin Commands Infrastructure** (Tasks 1-4)
   - Extended Plugin type with `commands` property
   - Namespace resolution (strips `@functional-examples/` scope)
   - CLI entry wiring

2. **Test Plugin Package** (Tasks 5-16)
   - Zod schemas for test metadata
   - Reporter interface with pretty and TAP implementations
   - Test runner with command execution and assertions
   - CLI commands (`test` as $0, `list` as subcommand)
   - Module path support for custom reporters in JSON configs

3. **Integration** (Tasks 17-20)
   - Example using test plugin
   - Config integration
   - E2E tests
