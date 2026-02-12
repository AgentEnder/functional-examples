<p align="center">
  <img src="docs-site/public/logo.svg" alt="functional-examples" width="96" />
</p>

# functional-examples

A language-agnostic library for treating code examples as first-class citizens.

This monorepo contains the core `functional-examples` library and related tooling.

## Packages

| Package | Description |
|---------|-------------|
| [`functional-examples`](./packages/functional-examples) | Core scanner, config, CLI, and type generation |
| [`@functional-examples/devkit`](./packages/devkit) | Plugin development kit — shared types and utilities |
| [`@functional-examples/javascript`](./packages/javascript) | JavaScript/TypeScript extractor plugin |
| [`@functional-examples/yaml-manifest`](./packages/yaml-manifest) | YAML manifest extractor plugin |
| [`@functional-examples/test`](./packages/test) | Test runner plugin for examples |
| [`@functional-examples/documentation`](./packages/documentation) | Documentation generation plugin |

## Quick Start

```bash
npm install functional-examples
```

```typescript
/**
 * Basic example: Scanning for examples in a directory
 */
import { resolveConfig, scanExamples } from 'functional-examples';

async function main() {
  // Resolve config (auto-detects installed plugins)
  const config = await resolveConfig({ root: './examples' });

  // Scan for examples
  const result = await scanExamples(config);

  console.log(`Found ${result.examples.length} examples:`);
  for (const example of result.examples) {
    console.log(`  - ${example.title} (${example.id})`);
  }

  if (result.errors.length > 0) {
    console.log(`\n${result.errors.length} errors occurred:`);
    for (const error of result.errors) {
      console.log(`  - ${error.path}: ${error.message}`);
    }
  }
}

main().catch(console.error);

```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm nx run-many -t build

# Run tests
pnpm nx run-many -t test

# Lint
pnpm nx run-many -t lint
```

## License

MIT
