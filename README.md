# functional-examples

A language-agnostic library for treating code examples as first-class citizens.

This monorepo contains the core `functional-examples` library and related tooling.

## Packages

- [`functional-examples`](./packages/functional-examples) - Core library

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
