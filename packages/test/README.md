# @functional-examples/test

Test runner plugin for functional-examples.

## Installation

```bash
npm install @functional-examples/test
```

## Overview

This plugin provides test execution capabilities for functional-examples. It lets you define and run tests against your code examples to ensure they stay correct and up-to-date.

## Usage

```typescript
import { createTestPlugin } from '@functional-examples/test';
import type { Config } from 'functional-examples';

const config: Config = {
  plugins: [
    createTestPlugin(),
  ],
};

export default config;
```

## Features

- **Example validation**: Run examples to verify they work correctly
- **CLI integration**: Adds test commands to the functional-examples CLI
- **Schema validation**: Validates test metadata using Zod schemas
- **Configurable**: Customize test behavior per-example via metadata

## License

MIT
