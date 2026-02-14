---
title: "CI Integration"
description: "Run example tests in GitHub Actions and other CI pipelines with TAP reporting and snapshot management."
nav:
  order: 4
---

# CI Integration

functional-examples tests integrate into any CI system. The test command exits with a non-zero code on failure, making it compatible with all CI runners.

## GitHub Actions Workflow

<%= example('ci-integration').file('.github/workflows/examples.yml') %>

### Key Steps

1. **Install dependencies** — Standard npm/pnpm install
2. **Scan for examples** — Verify examples are discovered correctly
3. **Run example tests** — Execute all test definitions

## Exit Code Semantics

| Exit Code | Meaning |
|-----------|---------|
| `0` | All tests passed |
| `1` | One or more tests failed |

CI systems interpret non-zero exit codes as failures, so no special configuration is needed.

## TAP Reporter for CI

Use the TAP reporter for machine-parseable output:

```typescript
import { createTestPlugin, createTapReporter } from '@functional-examples/test';

export default {
  plugins: [
    createTestPlugin({
      ciReporter: createTapReporter(),
    }),
  ],
};
```

Most CI systems can parse TAP output natively and display structured test results.

## Snapshot Management in CI

**Always run snapshot tests without `-u` in CI.** The CI pipeline should _detect_ snapshot drift, not silently update snapshots:

```yaml
# Good — detects drift
- run: npx functional-examples test

# Bad — silently updates snapshots
- run: npx functional-examples test -u
```

When snapshots drift, the CI will fail with a diff showing what changed. Developers should update snapshots locally and commit the changes.

## Testing CI Workflows Locally

Use the workflow runner script to test GitHub Actions workflows without pushing to GitHub:

```bash
npx tsx scripts/run-workflow.mts .github/workflows/examples.yml
```

The workflow runner:
- Parses the YAML workflow file
- Skips CI-only actions (checkout, setup-node, cache)
- Executes `run:` steps locally
- Reports pass/fail per step

### Selective Job Execution

```bash
npx tsx scripts/run-workflow.mts workflow.yml --job test-examples
```

## Best Practices

- **Run example tests alongside unit tests** — they catch different classes of regressions
- **Use `stdout.contains`** over exact matching — more resilient to formatting changes
- **Set reasonable timeouts** — example tests should be fast; long timeouts hide hangs
- **Separate scan from test** — run `scan` first to verify discovery, then `test` for assertions
- **Pin Node.js version** — avoid environment-specific failures

**See also:** [Test Plugin](../plugins/test) for assertion reference, [Snapshot Testing](../snapshot-testing) for snapshot workflows.
