# Snapshot Testing

Demonstrates snapshot assertions for verifying scan output.

## What This Shows

- Using the `snapshot` assertion type to compare actual output against a reference file
- First-run auto-creation of snapshot files
- Updating snapshots with `functional-examples test -u`
- Multi-step test definitions (scan → verify → cleanup)

## Sub-Examples

### Greeting Function

<%= region('greet') %>

Test definition with snapshot assertions:

<%= region('snapshot-test') %>

## Running

```bash
bash scan.sh          # Scan and save output to output.txt
```

## How It Works

1. `scan.sh` runs `functional-examples scan` and redirects output to `output.txt`
2. The `snapshot` assertion compares `output.txt` against `__snapshots__/scan-output.txt`
3. On first run, the snapshot is auto-created from the actual output
4. On subsequent runs, mismatches fail the test — run `functional-examples test -u` to update
