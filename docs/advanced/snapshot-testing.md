---
title: "Snapshot Testing"
description: "Use snapshot assertions to verify example output against stored reference files."
nav:
  order: 3
---

# Snapshot Testing

Snapshot testing compares actual output against a stored reference file. This is useful for verifying that scan results, generated files, or command output haven't changed unexpectedly.

## When to Use Snapshots

| Scenario | Approach |
|----------|----------|
| Simple exit code check | `exitCode: 0` |
| Output contains a substring | `stdout.contains` |
| Exact output match | Snapshot assertion |
| Complex multi-line output | Snapshot assertion |
| Generated file verification | File + snapshot assertion |

Use snapshots when the output is complex enough that inline assertions become unwieldy.

## Defining Snapshot Assertions

Test definitions can include snapshot assertions. Here's a real example:

<%= example('snapshot-testing').region('snapshot-test') %>

Or check multiple snapshots:

```yaml
assertions:
  snapshots:
    - path: dist/index.js
      snapshot: __snapshots__/index.js
    - path: dist/types.d.ts
      snapshot: __snapshots__/types.d.ts
```

## First-Run Behavior

On the first run, if the snapshot file doesn't exist, the test runner creates it from the actual output. Subsequent runs compare against the stored snapshot.

## Updating Snapshots

When output intentionally changes, update snapshots with the `-u` flag:

```bash
npx functional-examples test -u
```

This overwrites stored snapshot files with current output.

## Multi-Step Snapshot Workflow

<%= example('snapshot-testing').region('multi-step-test') %>

This pattern:
1. Runs the scan and captures output to a file
2. Compares the file against a stored snapshot
3. Cleans up temporary files

The scan script strips non-deterministic output (like timing) before saving:

<%= example('snapshot-testing').file('scan.sh') %>

And here's the stored snapshot it compares against:

<%= example('snapshot-testing').file('__snapshots__/scan-output.txt') %>

## Snapshots for Generated Content

Snapshots are especially powerful for verifying generated files. The [documentation plugin example](../plugins/documentation) uses a snapshot to verify the markdown output produced by `functional-examples documentation`:

<%= example('documentation-plugin').file('__snapshots__/doc-sample.md') %>

This ensures that changes to the documentation template or plugin logic are caught immediately by the test suite.

## Annotating Snapshots for Documentation

Snapshot files can include region tags so documentation can extract specific sections:

```text
#_region scan-result
Found 1 example(s)
...
#_endregion scan-result
```

Documentation can then reference: `<\%= example('snapshot-testing').region('scan-result') \%>`

## Parser Pipeline Transparency

Region tags in snapshot files are processed by the parser pipeline — they're stripped before comparison. This means you can annotate snapshots with `#_region` tags for documentation without affecting test assertions.

## Anti-Patterns

- **Don't use `--update-snapshots` in CI** — CI should _detect_ drift, not silently fix it
- **Don't snapshot non-deterministic output** — timestamps, random IDs, and absolute paths make snapshots flaky
- **Don't use snapshots for simple checks** — `stdout.contains` is more resilient to formatting changes

**See also:** [Test Plugin](../plugins/test) for the full assertion reference, [CI Integration](../ci-integration) for running snapshot tests in pipelines.
