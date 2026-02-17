---
generated: true
---

# Test Plugin Example

Demonstrates the test plugin with command execution and assertions.
Tests verify script behavior including exit codes and output content.


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

```javascript
const args = process.argv.slice(2);

if (args.includes('--fail')) {
  console.error('Error: intentional failure');
  process.exit(1);
}

console.log('Hello from example!');
```

Test definition:

```json
  "functional-examples": {
    "title": "Hello Script",
    "test": [
      {
        "name": "runs hello script",
        "options": { "command": "node hello.js" },
        "assertions": {
          "exitCode": 0,
          "stdout": { "contains": "Hello from example" }
        }
      }
    ]
  },
```

### Error Handling

A script that demonstrates failure assertions:

```javascript
const args = process.argv.slice(2);

if (args.includes('--fail')) {
  console.error('Error: intentional failure');
  process.exit(1);
}

console.log('No failure triggered');
```

Test definition:

```json
  "functional-examples": {
    "title": "Error Handling",
    "test": [
      {
        "name": "fails with bad args",
        "options": { "command": "node fail.js --fail" },
        "assertions": {
          "exitCode": 1,
          "stderr": { "contains": "Error" }
        }
      }
    ]
  },
```

## Assertions

Available assertions:
- `exitCode` — Expected exit code (number)
- `stdout.contains` — String that should appear in stdout
- `stderr.contains` — String that should appear in stderr

## Use Cases

- Verify examples actually run
- Ensure expected output is produced
- Catch regressions in example code


## `demo.sh`

### Region: `test`

```bash
npx functional-examples test
```

## `functional-examples.config.json`

### Region: `plugins`

```json
  "plugins": [
    "@functional-examples/javascript",
    "@functional-examples/test"
  ],
```

### Region: `scan`

```json
  "scan": {
    "include": ["examples/**/*.js", "examples/**/package.json"],
    "exclude": ["**/node_modules/**"]
  },
```

## `package.json`

```json
{
  "name": "@examples/test-plugin-example",
  "private": true,
  "type": "module",
  "description": "Demonstrates the test plugin with command execution and assertions",
  "dependencies": {
    "functional-examples": "workspace:*",
    "@functional-examples/javascript": "workspace:*",
    "@functional-examples/test": "workspace:*"
  },
  "functional-examples": {
    "title": "Test Plugin Example",
    "tags": ["testing", "assertions", "commands"]
  }
}

```

