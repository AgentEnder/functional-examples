# CI Integration

Demonstrates integrating functional-examples testing into a GitHub Actions CI pipeline.

## What This Shows

- A GitHub Actions workflow for scanning and testing examples
- Region-tagged workflow steps for documentation extraction
- The same `scan` and `test` commands used locally and in CI

## Running

```bash
# Scan for examples (same command used in CI)
bash demo.sh
```

## How It Works

The `.github/workflows/examples.yml` file defines a real GitHub Actions workflow
that installs dependencies, scans for examples, and runs tests. Region tags
(`#_region`) in the workflow file allow documentation to extract specific steps
for inclusion in guides.

Push to GitHub to execute the workflow, or inspect the YAML directly to
understand the CI setup.
