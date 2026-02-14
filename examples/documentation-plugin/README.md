# Documentation Plugin

Demonstrates using `@functional-examples/documentation` to generate markdown from scanned examples.

## What This Shows

- Configuring the documentation plugin alongside the JavaScript plugin
- Running the `documentation` command to generate markdown files
- Generated output structure: per-example pages with regions + an index page
- Snapshot testing to verify generated output doesn't drift

## Running

```bash
# Scan for examples
bash demo.sh

# Generate documentation from scanned examples
bash generate.sh
```

## Generated Output

The `documentation` command produces:
- **`generated-docs/doc-sample.md`** — per-example page with title, description, and code regions
- **`generated-docs/index.md`** — index linking to all generated example pages

The snapshot in `__snapshots__/doc-sample.md` shows the expected output structure.

## Configuration

The `functional-examples.config.ts` registers both the JavaScript plugin (for extraction) and the documentation plugin (for generation). The documentation plugin adds the `documentation` CLI command with `outputDir` and `format` options.
