# Test Plugin Example

This example demonstrates the `@functional-examples/test` plugin, which allows you to define and run tests for your examples.

## Usage

```bash
# From the repo root
npx functional-examples test examples/test-plugin-example
```

## The Script

The test target is a simple Node script:

<%= region('script') %>

## Test Definition

Tests are defined in the `functional-examples.test` field of `package.json`:

<%= file('package.json') %>

## Assertions

Available assertions:
- `exitCode` — Expected exit code (number)
- `stdout.contains` — String that should appear in stdout
- `stderr.contains` — String that should appear in stderr

## Use Cases

- Verify examples actually run
- Ensure expected output is produced
- Catch regressions in example code
