---
generated: true
---

# Snapshot Testing

Demonstrates snapshot assertions for verifying scan output.
Shows how to annotate snapshot files with region tags for
extracting documentation snippets.


# Snapshot Testing

Demonstrates snapshot assertions for verifying scan output.

## What This Shows

- Using the `snapshot` assertion type to compare actual output against a reference file
- First-run auto-creation of snapshot files
- Updating snapshots with `functional-examples test -u`
- Multi-step test definitions (scan → verify → cleanup)

## Sub-Examples

### Greeting Function

```typescript
/**
 * Generate a greeting message.
 */
export function greet(name: string): string {
  return `Hello, ${name}!`;
}
```

Test definition with snapshot assertions:

```json
  "functional-examples": {
    "title": "Greeting Function",
    "test": [
      {
        "name": "scan output matches snapshot",
        "steps": [
          {
            "command": "bash ../../scan.sh",
            "assertions": {
              "exitCode": 0
            }
          },
          {
            "command": "true",
            "assertions": {
              "snapshot": {
                "path": "../../output.txt",
                "snapshot": "../../__snapshots__/scan-output.txt"
              }
            }
          }
        ]
      },
      {
        "name": "cleanup",
        "options": {
          "command": "rm -f ../../output.txt"
        },
        "assertions": {
          "exitCode": 0
        }
      }
    ]
  },
```

## Running

```bash
bash scan.sh          # Scan and save output to output.txt
```

## How It Works

1. `scan.sh` runs `functional-examples scan` and redirects output to `output.txt`
2. The `snapshot` assertion compares `output.txt` against `__snapshots__/scan-output.txt`
3. On first run, the snapshot is auto-created from the actual output
4. On subsequent runs, mismatches fail the test — run `functional-examples test -u` to update


Found 2 example(s)

ID                            Title                                   Files     Extractor
------------------------------------------------------------------------------------------
snapshot-greeting             Greeting Function                       1         javascript-extractor
greeting-example              Greeting Function                       2         javascript-extractor



## `functional-examples.config.json`

```json
{
  "$schema": "./.functional-examples/schema.json",
  "scan": {
    "include": ["examples/**/*.ts", "examples/**/*.js", "examples/**/package.json"],
    "exclude": ["**/node_modules/**", "**/dist/**"]
  }
}

```

## `package.json`

```json
{
  "name": "@examples/snapshot-testing",
  "private": true,
  "type": "module",
  "description": "Demonstrates snapshot assertions for verifying scan output",
  "dependencies": {
    "functional-examples": "workspace:*",
    "@functional-examples/javascript": "workspace:*",
    "@functional-examples/test": "workspace:*"
  },
  "functional-examples": {
    "title": "Snapshot Testing",
    "tags": ["testing", "snapshots", "advanced"]
  }
}

```

## `scan.sh`

### Region: `scan`

```bash
# Run the scan and capture output, stripping the timing line (non-deterministic)
npx functional-examples scan | sed '/^Scan completed in/d' > output.txt
```

