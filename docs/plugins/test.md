---
title: "Test Plugin"
description: "Define and run executable tests for your examples with assertions for exit codes, output, files, and snapshots."
nav:
  order: 3
---

# Test Plugin

The test plugin (`@functional-examples/test`) adds testing capabilities to functional-examples. It reads test definitions from `metadata.test` on any scanned example and provides the `test` CLI command.

## Installation

```bash
npm install @functional-examples/test
```

## Setup

Add the test plugin to your config:

```typescript
import { createTestPlugin } from '@functional-examples/test';

export default {
  plugins: [
    // ... your extraction plugins
    createTestPlugin(),
  ],
};
```

### Plugin Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeout` | `number` | `30000` | Default timeout per test in milliseconds |
| `reporters` | `ReporterConfig[]` | `[]` | Additional reporters |
| `defaultReporter` | `ReporterConfig` | Pretty reporter | Reporter for local runs |
| `ciReporter` | `ReporterConfig` | TAP reporter | Reporter for CI environments |

## Defining Tests

Tests live in the `test` field of an example's metadata. The test plugin doesn't care which extractor produced the example — it works with any metadata source.

### Single Command Tests

The simplest form — run a command and check assertions:

<%= example('test-plugin-example').region('hello-test') %>

### Multi-Step Tests

For examples that require setup or multiple phases, use `steps`:

<%= example('snapshot-testing').region('snapshot-test') %>

Each step runs sequentially. If a step fails, subsequent steps in the same test are skipped.

## Assertion Reference

### Exit Code

```yaml
assertions:
  exitCode: 0      # Expected exit code (0 = success)
```

### Standard Output

```yaml
assertions:
  stdout:
    contains: "expected text"     # Substring match
    matches: "pattern.*regex"     # Regex match
```

### Standard Error

```yaml
assertions:
  stderr:
    contains: "Error"             # Substring match
    matches: "Error:\\s+.*"       # Regex match
```

### File Assertions

```yaml
assertions:
  file:
    path: output.txt              # File must exist
    contains: "expected content"  # File content substring
    matches: "pattern"            # File content regex
  files:                          # Multiple file checks
    - path: a.txt
      contains: "content a"
    - path: b.txt
```

### Directory Assertions

```yaml
assertions:
  dir:
    path: output/                 # Directory must exist
  directories:                    # Multiple directory checks
    - path: dist/
    - path: generated/
```

### Snapshot Assertions

```yaml
assertions:
  snapshot:
    path: output.txt              # File to compare
    snapshot: __snapshots__/expected.txt  # Reference snapshot
  snapshots:                      # Multiple snapshot checks
    - path: a.txt
      snapshot: __snapshots__/a.txt
```

See [Snapshot Testing](../advanced/snapshot-testing) for details on the snapshot workflow.

### Negation

Wrap any assertion in `not` to invert it:

```yaml
assertions:
  not:
    stdout:
      contains: "ERROR"
    file:
      path: should-not-exist.txt
```

## Running Tests

```bash
# Run all example tests
npx functional-examples test

# Run tests for a specific directory
npx functional-examples test examples/test-plugin-example

# Update snapshots
npx functional-examples test -u
```

## Reporters

The test plugin supports pluggable reporters:

| Reporter | Use Case | Output |
|----------|----------|--------|
| Pretty (default) | Local development | Colored, human-readable |
| TAP | CI pipelines | Machine-parseable TAP format |

Use `createTapReporter()` for CI environments — most CI systems can parse TAP output natively.

**See also:** [Snapshot Testing](../advanced/snapshot-testing) for snapshot workflows, [CI Integration](../advanced/ci-integration) for pipeline setup.
