---
name: write-example
description: Guide for writing, modifying, or understanding examples in this repo. Use when creating new examples, adding test assertions, wiring examples into docs, or understanding the example system.
---

# Writing Examples

Examples in this repo serve **three purposes simultaneously**:

1. **Human-readable code samples** — developers browsing the repo understand how things work
2. **Type-safe, tested documentation content** — rendered on the docs site:
   - As standalone pages at `/examples/[slug]` (unless `docs.skip` is set)
   - Inlined into guide pages when `docs/guides/*.md` references them via Eta tags
3. **E2E tests** — `functional-examples test` runs assertions defined in example metadata

Every example should be written with all three audiences in mind.

## Example Directory Layout

Each example lives in `examples/<name>/` and typically contains:

```
examples/my-example/
  meta.yml                         # metadata: id, title, tags, test assertions
  functional-examples.config.json  # or .ts — required (see below)
  scan.sh                          # shell scripts with CLI commands + region tags
  setup.sh                         # multiple scripts for multi-phase flows
  src/                             # source files (may contain frontmatter + regions)
  __snapshots__/                   # snapshot files for output comparison
```

### Configuration is Required

Since our examples demonstrate usage of the functional-examples tool, every example **must** include a `functional-examples.config.json` (or `.ts`) file. The only exception is an example that showcases the project-creation flow, where the config would be generated as part of the walkthrough.

For JSON configs, reference the generated schema for IDE autocomplete:
```json
{
  "$schema": "./.functional-examples/schema.json",
  "scan": {
    "include": ["src/**/*"],
    "exclude": ["**/node_modules/**"]
  }
}
```

For TypeScript configs:
```typescript
import type { Config } from 'functional-examples';

const config: Config = {
  plugins: [/* ... */],
  scan: { include: ['src/**/*'] },
};

export default config;
```

### Generated Schemas

Running `functional-examples generate` produces a `.functional-examples/` directory containing:

- **`schema.json`** — JSON Schema for `functional-examples.config.json` (IDE autocomplete)
- **`metadata.schema.json`** — merged metadata schema from all plugins
- **`metadata.d.ts`** — TypeScript type augmentation for type-safe metadata access

Reference these in your example configs via `"$schema": "./.functional-examples/schema.json"`.

### `meta.yml` Structure

```yaml
id: my-example
title: My Example Title
description: |
  Brief description of what this example demonstrates.
tags:
  - beginner
  - scanning
include:
  - "*.json"
  - "*.ts"
  - "*.sh"
  - "README.md"
test:
  - name: CLI scan works
    options:
      command: bash scan.sh
    assertions:
      exitCode: 0
```

Required fields: `id`, `title`.
The `test` array defines E2E assertions (see [Test Assertions](#test-assertions) below).

### Alternative: `package.json` metadata

For JS/TS examples you can use the `functional-examples` key in `package.json` instead of `meta.yml`:

```json
{
  "name": "@examples/my-example",
  "description": "What this example demonstrates",
  "main": "./src/index.ts",
  "functional-examples": {
    "title": "My Example Title",
    "tags": ["testing"],
    "test": {
      "name": "runs correctly",
      "steps": [
        { "command": "node src/index.js", "assertions": { "exitCode": 0 } }
      ]
    }
  }
}
```

## Region Tags: `#_region` vs `#region`

This repo uses **two different forms** of region markers, and the distinction matters:

| Marker | Used by | Visible in rendered docs? | Purpose |
|--------|---------|--------------------------|---------|
| `#region` / `#endregion` | End users of functional-examples | Yes — extracted as hunks in scan output | Marking code regions in user-facing example source |
| `#_region` / `#_endregion` | This repo's own docs infrastructure | No — stripped by the parser pipeline | Extracting snippets for our docs site |

**Since this repo documents functional-examples itself**, we use the `#_region` / `#_endregion` form in our example files. This ensures our documentation infrastructure's markers don't leak into the rendered output on the docs site.

In TypeScript/JavaScript:
```typescript
// #_region setup
const config = loadConfig();
// #_endregion setup
```

In Bash (note the extra `#` for bash comment syntax):
```bash
# #_region scan
npx functional-examples scan
# #_endregion scan
```

### Shell Scripts with Region Tags

CLI commands that should appear in docs belong in shell scripts with region tags. The script name is arbitrary — use descriptive names, and **split into multiple scripts** when you need to test different phases independently.

```bash
#!/usr/bin/env bash
# scan.sh — Demonstrates scanning commands

# #_region scan
# Scan for examples and display results
npx functional-examples scan
# #_endregion scan

# #_region json
# Output scan results as JSON
npx functional-examples scan -f json
# #_endregion json
```

**Why split scripts:** If an example has a multi-phase flow (e.g., init → configure → scan → test), splitting into separate scripts like `init.sh`, `configure.sh`, `scan.sh` lets you:
- Write test assertions for each phase independently
- Assert file contents or state between phases
- Reference individual phases in docs via region tags

This makes the commands:
- **Runnable** — `bash scan.sh` executes them
- **Testable** — test assertions can run each script and check exit codes/output
- **Referenceable** — docs can pull individual regions from any script

### Avoid Redundant `.` in CLI Commands

Commands like `scan`, `test`, and `validate` default to the current working directory. **Do not pass `.` explicitly** — it's noise that makes the commands harder to read in documentation:

```bash
# Good — clean, concise
npx functional-examples scan
npx functional-examples scan -f json
npx functional-examples test

# Bad — redundant dot
npx functional-examples scan .
npx functional-examples scan . -f json
npx functional-examples test .
```

Shell scripts already `cd "$(dirname "$0")"` to set the cwd, so the tool will find the config file in the right place without `.`.

### Shell Scripts Are Documentation — Not Test Harnesses

**Every command in a shell script should pass the "would I show this in a guide?" test.** Shell scripts are documentation artifacts that get rendered on the docs site via region tags. They are NOT test harnesses.

Commands that exist **only** for testing purposes — cleanup (`rm`), output verification (`cat`, `diff`), internal tooling invocations, or any command a user would never run — belong **directly in `meta.yml` test definitions**, not in shell scripts.

**Good** — doc-worthy command in a script, test-only commands in meta.yml:
```bash
# scan.sh
# #_region scan
npx functional-examples scan -f json > output.txt
# #_endregion scan
```

```yaml
# meta.yml
test:
  - name: scan captures output
    options:
      command: bash scan.sh
    assertions:
      exitCode: 0
  - name: output contains expected example
    options:
      command: cat output.txt          # test-only — directly in meta.yml
    assertions:
      stdout:
        contains: my-example
  - name: cleanup
    options:
      command: rm -f output.txt        # test-only — directly in meta.yml
    assertions:
      exitCode: 0
```

**Bad** — test-only commands leaking into a shell script:
```bash
# demo.sh (don't do this)
npx functional-examples scan -f json > output.txt
echo "Scan output:"           # test utility — shouldn't be in a script
cat output.txt                 # test verification — shouldn't be in a script
rm -f output.txt               # test cleanup — shouldn't be in a script
```

## Referencing Examples in Docs

Guide files in `docs/guides/*.md` use **Eta template syntax** to embed live example code:

```markdown
<%​= example('basic-usage').file('scan.ts') %>
```

To embed a specific region from a file:
```markdown
<%​= example('my-example').region('setup') %>
```

> **Note:** There are zero-width spaces in the above to prevent Eta processing. When writing actual template tags, omit them.

Real examples from the codebase:
- `docs/guides/getting-started.md` → `<%​= example('basic-usage').file('scan.ts') %>`
- `docs/guides/plugins.md` → `<%​= example('javascript-plugin').file('src/getting-started.ts') %>`
- `docs/guides/testing-examples.md` → `<%​= example('test-plugin-example').file('hello.js') %>`

Changes to example source files automatically propagate to the rendered docs — no copy-paste drift.

### Guide Docs vs Example Renderer — When to Use Which

| Approach | Best for | How it works |
|----------|----------|-------------|
| **Standalone example page** (`/examples/[slug]`) | Self-contained examples that make sense on their own | Default behavior — just create the example, no `docs.skip` |
| **Guide doc** (`docs/guides/*.md` with Eta tags) | Guided flows, tutorials, multi-step walkthroughs | Write a narrative doc that pulls in code via Eta tags |

**Use a guide doc when:**
- The example represents a step-by-step flow where narrative context matters
- You need to interleave explanation between code snippets
- The example alone wouldn't make sense without surrounding prose
- You want to show command output alongside the commands that produced it

**Use the standalone example renderer when:**
- The code is self-explanatory with just a title and description
- Users mainly need to see the source files and config

Many examples benefit from **both** — a standalone page for browsing plus Eta references in a guide for narrative context.

## `docs.skip` Metadata

Set `docs.skip: true` to prevent an example from generating a standalone page at `/examples/[slug]`. The example remains accessible to guide templates (Eta tags) and still runs as an E2E test.

In `meta.yml`:
```yaml
docs:
  skip: true
```

In `package.json`:
```json
{
  "functional-examples": {
    "docs": { "skip": true }
  }
}
```

**When to apply `docs.skip`:**
- The example exists only to support E2E tests (not useful as a standalone page)
- The example is consumed exclusively via Eta references in guide markdown
- The example is only meant to test internal behavior, not demonstrate usage
- If it shouldn't appear in the `/examples/` listing, skip it

## Test Assertions

Examples define tests via `test` in their metadata. The test runner (`functional-examples test`) executes commands and checks assertions.

### Single command test

```yaml
test:
  - name: runs hello script
    options:
      command: node hello.js
    assertions:
      exitCode: 0
      stdout:
        contains: Hello from example
  - name: fails with bad args
    options:
      command: node hello.js --fail
    assertions:
      exitCode: 1
      stderr:
        contains: Error
```

### Multi-step test

Use steps when you need to assert state between phases:

```yaml
test:
  - name: init then scan then verify
    steps:
      - command: bash init.sh
        assertions:
          exitCode: 0
      - command: bash scan.sh
        assertions:
          exitCode: 0
          stdout:
            contains: "Found 3 examples"
      - command: bash cleanup.sh
```

### Available assertion types

- `exitCode` — expected numeric exit code
- `stdout.contains` / `stderr.contains` — substring match
- `stdout.matches` / `stderr.matches` — regex match
- `file.path` + `file.contains` / `file.matches` — assert file exists with content
- `files` — array of file assertions
- `dir.path` — assert directory exists
- `directories` — array of directory assertions
- `snapshot` / `snapshots` — compare file content against stored snapshots
- `not` — negate any inner assertion (e.g. `not.dir.path` asserts directory does NOT exist)

### Snapshot Assertions

Snapshots capture file content for comparison across test runs. They're especially useful for asserting command output in guided doc flows.

```yaml
test:
  - name: scan output matches expected
    options:
      command: bash scan.sh > output.txt
    assertions:
      exitCode: 0
      snapshot:
        path: ./output.txt
        snapshot: ./__snapshots__/output.txt
```

Multiple snapshots per test:
```yaml
assertions:
  snapshots:
    - path: ./output.txt
      snapshot: ./__snapshots__/output.txt
    - path: ./result.json
      snapshot: ./__snapshots__/result.json
```

**How snapshots work:**
- **First run**: If the snapshot file doesn't exist, it's created automatically from the actual output
- **Subsequent runs**: Both actual and snapshot are run through the parser pipeline (stripping region markers) before comparison
- **Update mode**: Run `functional-examples test --update-snapshots` (or `-u`) to refresh snapshots

**Snapshots + region tags for docs:** Since the parser pipeline strips `#_region` / `#_endregion` markers before comparing, you can **annotate snapshot files with region tags** to extract portions of command output for use in docs. The region tags won't break snapshot comparison, but they make the output referenceable via Eta tags. This is a powerful pattern for guided doc flows where you want to show the output of a command inline.

```
# __snapshots__/scan-output.txt (annotated after first run)
# #_region summary
Found 3 examples in ./examples
# #_endregion summary
# #_region details
  - basic-usage: Getting Started
  - javascript-plugin: JavaScript Plugin
  - yaml-manifest: YAML Manifest Plugin
# #_endregion details
```

Then in a guide doc:
```markdown
Running the scan produces:

<%​= example('my-example').file('__snapshots__/scan-output.txt').region('summary') %>
```

## Checklist: Adding a New Example

1. Create `examples/<name>/` with source files
2. Add a `functional-examples.config.json` (with `"$schema": "./.functional-examples/schema.json"`) or `.ts` config
3. Add a `meta.yml` with `id`, `title`, `description`, `tags`, and `include`
4. Write shell scripts with `#_region` / `#_endregion` tags around commands that should appear in docs
5. Add `test` assertions so the example doubles as an E2E test
6. Use snapshots for capturing command output you want to show in docs
7. Decide visibility:
   - **Standalone docs page + E2E test:** leave `docs.skip` unset (default)
   - **Guide-only + E2E test:** set `docs.skip: true`, reference via Eta tags in `docs/guides/*.md`
   - **E2E test only:** set `docs.skip: true`, no Eta references needed
8. If the example should appear in a guide, add `<%​= example('<name>').file('...') %>` or `.region('...')` to the appropriate `docs/guides/*.md` file

## Checklist: Modifying an Existing Example

1. Read the example's `meta.yml` (or `package.json`) to understand its current metadata
2. Check if any `docs/guides/*.md` files reference it (search for the example id)
3. Make your changes to source files
4. If you changed region boundaries, verify the docs references still make sense
5. If the example has snapshots, run `functional-examples test -u` to update them, then verify the diff looks correct
6. Run `functional-examples test` to confirm assertions still pass
