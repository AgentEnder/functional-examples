# Plugin Commands & Test Plugin Design

**Date:** 2026-02-04
**Status:** Approved

## Overview

This design covers two related features:

1. **Plugin Commands** — Allow plugins to expose CLI commands that get registered under the plugin's namespace
2. **`@functional-examples/test` Plugin** — A test runner plugin for validating examples via command execution and assertions

---

## Feature 1: Plugin Commands

### Plugin Type Extension

```typescript
// packages/functional-examples/src/types/index.ts
import type { CLI } from 'cli-forge';

type PluginCommands<TMetadata> =
  | CLI[]
  | ((config: ResolvedConfig<TMetadata>) => CLI[] | Promise<CLI[]>);

interface Plugin<TMetadata = Record<string, unknown>> {
  name: string;
  extensions?: string[];
  extractor?: Extractor<TMetadata>;
  fileContentsParser?: FileContentsParser;
  schemas?: PluginSchemas;
  validators?: PluginValidators<TMetadata>;
  commands?: PluginCommands<TMetadata>;  // NEW
  _options?: unknown;
}
```

### Command Namespace Resolution

- `@functional-examples/*` → strip scope, use package name only (e.g., `@functional-examples/test` → `test`)
- Everything else → use full package name (e.g., `@acme/runner` → `@acme/runner`)

```typescript
// packages/functional-examples/src/cli/plugin-commands.ts
function getCommandNamespace(pluginName: string): string {
  if (pluginName.startsWith('@functional-examples/')) {
    return pluginName.replace('@functional-examples/', '');
  }
  return pluginName;
}

async function resolvePluginCommands<T>(
  plugin: Plugin<T>,
  config: ResolvedConfig<T>
): Promise<CLI[]> {
  if (!plugin.commands) return [];

  const commands = typeof plugin.commands === 'function'
    ? plugin.commands(config)
    : plugin.commands;

  return Promise.resolve(commands);
}

async function loadPluginCommands<T>(
  plugins: Plugin<T>[],
  config: ResolvedConfig<T>
): Promise<CLI[]> {
  const results: CLI[] = [];

  for (const plugin of plugins) {
    const commands = await resolvePluginCommands(plugin, config);
    if (commands.length === 0) continue;

    const namespace = getCommandNamespace(plugin.name);

    // Wrap commands under the plugin namespace
    const namespaced = cli(namespace, {})
      .commands(...commands);

    results.push(namespaced);
  }

  return results;
}
```

### CLI Registration

```typescript
// packages/functional-examples/src/cli/index.ts
const app = cli('functional-examples', {...})
  .commands(scanCommand, validateCommand, initCommand, generateCommand);

// Load and register plugin commands
const resolvedConfig = await resolveConfig(loadedConfig);
const pluginCLIs = await loadPluginCommands(resolvedConfig.plugins, resolvedConfig);
app.commands(...pluginCLIs);

app.forge();
```

---

## Feature 2: `@functional-examples/test` Plugin

### Metadata Schema

Tests are defined inline in example metadata. Uses Zod for validation, converted to JSON Schema for the plugin's `schemas.metadata`.

```typescript
// packages/test/src/schema.ts
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const stdioAssertionsSchema = z.object({
  contains: z.string().optional(),
  matches: z.string().optional(),  // regex pattern
}).optional();

const assertionsSchema = z.object({
  exitCode: z.number().int().optional(),
  stdout: stdioAssertionsSchema,
  stderr: stdioAssertionsSchema,
}).optional();

const testOptionsSchema = z.object({
  command: z.string(),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
  timeout: z.number().int().positive().optional(),
});

const testCaseSchema = z.object({
  name: z.string(),
  options: testOptionsSchema,
  assertions: assertionsSchema,
});

// Support single test or array
const testSchema = z.union([
  testCaseSchema,
  z.array(testCaseSchema),
]);

export const testMetadataSchema = z.object({
  test: testSchema.optional(),
});

export type TestCase = z.infer<typeof testCaseSchema>;
export type TestMetadata = z.infer<typeof testMetadataSchema>;

export const TEST_METADATA_JSON_SCHEMA = zodToJsonSchema(testMetadataSchema);
```

### Example Usage

**Single test:**
```yaml
id: hello-world
title: Hello World Example

test:
  name: prints greeting
  options:
    command: node index.js
  assertions:
    exitCode: 0
    stdout:
      contains: "Hello, World!"
```

**Multiple tests:**
```yaml
id: calculator
title: Calculator Example

test:
  - name: adds numbers
    options:
      command: node calc.js add 2 3
    assertions:
      exitCode: 0
      stdout:
        contains: "5"
  - name: shows help
    options:
      command: node calc.js --help
    assertions:
      stdout:
        matches: "Usage:.*"
```

### Plugin Options

```typescript
// packages/test/src/types.ts
export type ReporterConfig = ReporterFactory | string;

export interface TestPluginOptions {
  /** Default timeout for tests in ms. @default 30000 */
  timeout?: number;

  /** Custom reporters keyed by name. Built-in: 'pretty', 'tap' */
  reporters?: Record<string, ReporterConfig>;

  /** Default reporter when not in CI. @default 'pretty' */
  defaultReporter?: string;

  /** Default reporter when in CI. @default 'tap' */
  ciReporter?: string;
}
```

### Reporter Interface

```typescript
// packages/test/src/reporters/types.ts
export interface TestResult {
  example: string;
  test: string;
  passed: boolean;
  duration: number;
  error?: string;
  actual?: {
    exitCode: number;
    stdout: string;
    stderr: string;
  };
}

export interface TestSummary {
  passed: number;
  failed: number;
  bail?: boolean;
}

export interface Reporter {
  start(examples: Example[]): void | Promise<void>;
  report(result: TestResult, verbose: boolean): void | Promise<void>;
  finish(summary: TestSummary): void | Promise<void>;
}

export type ReporterFactory = () => Reporter;
```

### Built-in Reporters

**Pretty (default for TTY):**
```
Running 4 tests from 2 examples

 PASS  hello-world > prints greeting (42ms)
 PASS  hello-world > shows help (38ms)
 FAIL  calculator > adds numbers (51ms)
       Expected stdout to contain "Result: 5"
       Exit code: 0
 PASS  calculator > handles errors (45ms)

Tests: 1 failed, 3 passed, 4 total
```

**TAP (default for CI):**
```
TAP version 14
1..4
ok 1 - hello-world > prints greeting
ok 2 - hello-world > shows help
not ok 3 - calculator > adds numbers
  ---
  message: "Expected stdout to contain \"Result: 5\""
  actual_exit_code: 0
  ...
ok 4 - calculator > handles errors
# tests 4
# pass 3
# fail 1
```

### Custom Reporter Configuration

**TypeScript config:**
```typescript
import { createTestPlugin, Reporter } from '@functional-examples/test';

export default {
  plugins: [
    createTestPlugin({
      reporters: {
        junit: () => ({
          start() { /* write XML header */ },
          report(result) { /* write test case */ },
          finish() { /* close XML */ },
        }),
      },
      ciReporter: 'junit',
    }),
  ],
};
```

**JSON config (module path):**
```json
{
  "plugins": [
    {
      "name": "@functional-examples/test",
      "options": {
        "reporters": {
          "junit": "./reporters/junit.js"
        },
        "ciReporter": "junit"
      }
    }
  ]
}
```

Reporter modules must export a factory function as `default`, `reporter`, or `createReporter`.

### CLI Commands

```
functional-examples test [path]           # runs tests ($0 handler)
functional-examples test list [path]      # lists available tests
```

**Options for `test`:**
- `--filter, -f <pattern>` — Filter examples by id or path pattern
- `--bail, -b` — Stop on first failure
- `--verbose, -v` — Show command output even on success
- `--format <name>` — Output format (default: pretty in TTY, tap in CI)
- `--timeout <ms>` — Default timeout for all tests (default: 30000)

**Options for `test list`:**
- `--format <table|json>` — Output format (default: table)

### Test Runner Core

```typescript
// packages/test/src/runner.ts
async function runTest(
  examplePath: string,
  testCase: TestCase,
  options: { timeout: number }
): Promise<TestResult> {
  const startTime = Date.now();
  const cwd = testCase.options.cwd
    ? join(examplePath, testCase.options.cwd)
    : examplePath;

  const { exitCode, stdout, stderr } = await executeCommand(
    testCase.options.command,
    {
      cwd,
      env: testCase.options.env,
      timeout: testCase.options.timeout ?? options.timeout
    }
  );

  const failures = checkAssertions(testCase.assertions, { exitCode, stdout, stderr });

  return {
    example: examplePath,
    test: testCase.name,
    passed: failures.length === 0,
    duration: Date.now() - startTime,
    error: failures.length > 0 ? failures.join('\n') : undefined,
    actual: { exitCode, stdout, stderr },
  };
}

function checkAssertions(
  assertions: TestCase['assertions'],
  actual: { exitCode: number; stdout: string; stderr: string }
): string[] {
  const failures: string[] = [];
  if (!assertions) return failures;

  if (assertions.exitCode !== undefined && actual.exitCode !== assertions.exitCode) {
    failures.push(`Expected exit code ${assertions.exitCode}, got ${actual.exitCode}`);
  }

  if (assertions.stdout?.contains && !actual.stdout.includes(assertions.stdout.contains)) {
    failures.push(`Expected stdout to contain "${assertions.stdout.contains}"`);
  }

  if (assertions.stdout?.matches && !new RegExp(assertions.stdout.matches).test(actual.stdout)) {
    failures.push(`Expected stdout to match /${assertions.stdout.matches}/`);
  }

  if (assertions.stderr?.contains && !actual.stderr.includes(assertions.stderr.contains)) {
    failures.push(`Expected stderr to contain "${assertions.stderr.contains}"`);
  }

  if (assertions.stderr?.matches && !new RegExp(assertions.stderr.matches).test(actual.stderr)) {
    failures.push(`Expected stderr to match /${assertions.stderr.matches}/`);
  }

  return failures;
}
```

### Plugin Factory

```typescript
// packages/test/src/index.ts
import { createPrettyReporter } from './reporters/pretty';
import { createTapReporter } from './reporters/tap';

const BUILTIN_REPORTERS: Record<string, ReporterFactory> = {
  pretty: createPrettyReporter,
  tap: createTapReporter,
};

export function createTestPlugin(options: TestPluginOptions = {}): Plugin<TestMetadata> {
  return {
    name: '@functional-examples/test',
    schemas: {
      metadata: TEST_METADATA_JSON_SCHEMA,
      options: OPTIONS_JSON_SCHEMA,
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
        defaultTimeout: options.timeout ?? 30000,
      });
    },
    _options: options,
  };
}

// Re-exports for custom reporter authors
export { Reporter, ReporterFactory, TestResult, TestSummary } from './reporters/types';
export { createPrettyReporter } from './reporters/pretty';
export { createTapReporter } from './reporters/tap';
```

---

## Package Structure

```
packages/
└── test/
    ├── package.json          # @functional-examples/test
    ├── src/
    │   ├── index.ts          # Plugin factory + exports
    │   ├── schema.ts         # Zod schemas + JSON Schema
    │   ├── types.ts          # TypeScript types
    │   ├── runner.ts         # Test execution engine
    │   ├── commands/
    │   │   ├── index.ts      # Command factory
    │   │   ├── test.ts       # Main test command ($0)
    │   │   └── list.ts       # List command
    │   └── reporters/
    │       ├── types.ts      # Reporter interface
    │       ├── resolve.ts    # Reporter resolution (fn vs module path)
    │       ├── pretty.ts     # Pretty reporter
    │       └── tap.ts        # TAP reporter
    └── tsconfig.json
```

---

## Implementation Order

1. **Plugin Commands Infrastructure**
   - Extend Plugin type with `commands` property
   - Implement namespace resolution
   - Wire up command loading in CLI entry

2. **Test Plugin Foundation**
   - Create package structure
   - Implement Zod schemas
   - Set up plugin factory

3. **Test Runner**
   - Command execution with spawn
   - Assertion checking
   - Timeout handling

4. **Reporters**
   - Reporter interface
   - Pretty reporter
   - TAP reporter
   - Module path resolution for JSON configs

5. **CLI Commands**
   - Test command ($0)
   - List command
   - CI detection + format auto-selection

6. **Integration**
   - Wire up to example config
   - Add example tests to existing examples
   - Documentation
