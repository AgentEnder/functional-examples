# Install dependencies
pnpm install

# Build all packages
pnpm nx run-many -t build

# Run tests
pnpm nx run-many -t test

# Lint
pnpm nx run-many -t lint
