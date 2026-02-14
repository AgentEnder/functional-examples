---
generated: true
---

# Sample for Documentation

A simple example demonstrating documentation generation

## `src/sample.ts`

### Region: `frontmatter`

```typescript
// ---
// id: doc-sample
// title: Sample for Documentation
// description: A simple example demonstrating documentation generation
// tags:
//   - documentation
//   - sample
// ---
```

### Region: `setup`

```typescript
import { readFileSync } from 'node:fs';

/**
 * Read and parse a configuration file.
 */
export function loadConfig(path: string): Record<string, unknown> {
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content);
}
```

### Region: `usage`

```typescript
// Load configuration from a JSON file
const config = loadConfig('config.json');
console.log('Loaded config:', config);
```

