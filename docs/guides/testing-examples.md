---
title: "Testing Examples"
description: "Use the test plugin to verify examples run correctly, define assertions, and integrate with CI."
nav:
  order: 6
---

# Testing examples

Examples that don't run aren't examples — they're aspirational pseudocode. The `@functional-examples/test` plugin lets you define executable assertions for your examples and run them in CI.

## Setup

Install the test plugin:

```bash
npm install @functional-examples/test
```

Add it to your config:

<%= example('multi-plugin-config').region('test-only-config') %>

## Defining tests

Test definitions live in the `test` field of an example's metadata. The test plugin reads `metadata.test` from whatever extractor produced the example — it doesn't care about the source format.

For package.json-based examples (via the JavaScript plugin), tests go under `functional-examples.test`:

<%= example('test-plugin-example').region('hello-test') %>

For frontmatter-based examples, you'd add a `test` field to the YAML metadata. For YAML manifest examples, add it to `meta.yml`. The test plugin works with any metadata source.

Each test has:

- **name** — a descriptive label for the test
- **options.command** — the shell command to run
- **assertions** — what to check after the command runs

Here's the script being tested:

<%= example('test-plugin-example').region('hello-script') %>

## Available assertions

| Assertion | Description |
|-----------|-------------|
| `exitCode` | Expected process exit code (0 for success) |
| `stdout.contains` | String that must appear in stdout |
| `stdout.matches` | Regex pattern that stdout must match |
| `stderr.contains` | String that must appear in stderr |
| `stderr.matches` | Regex pattern that stderr must match |
| `file` / `files` | Check that output files exist with expected content |
| `dir` / `directories` | Check that output directories exist |

Tests also support **multi-step** definitions with a `steps` array instead of a single `command`, for examples that require setup before assertions.

## Running tests

Run all example tests:

```bash
npx functional-examples test
```

Run tests for a specific example:

```bash
npx functional-examples test examples/test-plugin-example
```

The test runner executes each command, captures output, and checks assertions. Results are reported with pass/fail status.

## CI integration

Add example tests to your CI pipeline alongside unit tests:

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm test              # unit tests
      - run: npx functional-examples test  # example tests
```

The test command exits with a non-zero code if any assertion fails, so CI will catch regressions automatically.

## Best practices

- **Test the happy path first** — verify exit code 0 and expected output
- **Test error cases** — confirm examples fail gracefully with meaningful errors
- **Keep commands fast** — example tests run in CI, so avoid long-running operations
- **Use `stdout.contains`** over exact matching — partial matches are more resilient to formatting changes

## Going further

- **[Test Plugin Reference](../../plugins/test)** — full assertion table including file, directory, and snapshot assertions
- **[Snapshot Testing](../../advanced/snapshot-testing)** — when to use snapshots, first-run behavior, and update workflow
- **[CI Integration](../../advanced/ci-integration)** — GitHub Actions setup, TAP reporter, and local workflow testing
