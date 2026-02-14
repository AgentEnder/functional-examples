# Test Plugin Example

This example demonstrates the `@functional-examples/test` plugin, which allows you to define and run tests for your examples.

## Usage

```bash
# From the repo root
npx functional-examples test examples/test-plugin-example
```

## Sub-Examples

### Hello Script

A simple script that prints a greeting:

<%= region('hello-script') %>

Test definition:

<%= region('hello-test') %>

### Error Handling

A script that demonstrates failure assertions:

<%= region('error-script') %>

Test definition:

<%= region('error-test') %>

## Assertions

Available assertions:
- `exitCode` — Expected exit code (number)
- `stdout.contains` — String that should appear in stdout
- `stderr.contains` — String that should appear in stderr

## Use Cases

- Verify examples actually run
- Ensure expected output is produced
- Catch regressions in example code
