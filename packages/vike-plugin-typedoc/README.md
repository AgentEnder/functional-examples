# vike-plugin-typedoc

Headless TypeDoc integration for Vike documentation sites.

## Installation

```bash
npm install vike-plugin-typedoc
```

Peer dependencies:

- `vike >= 0.4.250`
- `vike-react >= 0.5` (if you use the React hooks)
- `react >= 18` (if you use the React hooks)

## What It Does

- Loads TypeDoc JSON files into a cached `TypedocContext`.
- Builds package and symbol URLs (default `/api/:pkg/:symbol`).
- Builds API navigation trees.
- Pre-renders markdown fields and auto-links type references.
- Provides Vike data helpers (`withApiPackage`, `withApiExport`) and React hooks (`useApiPackage`, `useApiExport`).
- Provides a Vike config extension that auto-loads context and prerender URLs.

## Quick Start

Add the plugin extension and `typedoc` config:

```ts
import { join } from 'node:path';
import vikePluginTypedoc from 'vike-plugin-typedoc/config';
import vikeReact from 'vike-react/config';
import type { Config } from 'vike/types';

const root = process.cwd();

export default {
  extends: [vikeReact, vikePluginTypedoc],
  prerender: true,
  typedoc: {
    typedocDir: join(root, '.typedoc'),
    packagesDir: join(root, 'packages'),
    basePath: '/api',
  },
} satisfies Config;
```

The plugin expects one TypeDoc JSON file per package slug in `typedocDir` (for example `.typedoc/devkit.json`).

## Package and Symbol Pages

Package route data loader:

```ts
// pages/api/@pkg/+data.ts
import { withApiPackage } from 'vike-plugin-typedoc/server';
import type { PageContextServer } from 'vike/types';

export function data(pageContext: PageContextServer) {
  return withApiPackage(pageContext, pageContext.routeParams.pkg);
}
```

Package route component:

```tsx
// pages/api/@pkg/+Page.tsx
import { useApiPackage } from 'vike-plugin-typedoc/client';

export default function Page() {
  const { apiPackage, packageName } = useApiPackage();
  if (!apiPackage) return <h1>Package not found: {packageName}</h1>;
  return <h1>{packageName}</h1>;
}
```

Symbol route data loader:

```ts
// pages/api/@pkg/@symbol/+data.ts
import { withApiExport } from 'vike-plugin-typedoc/server';
import type { PageContextServer } from 'vike/types';

export function data(pageContext: PageContextServer) {
  const { pkg, symbol } = pageContext.routeParams;
  return withApiExport(pageContext, pkg, symbol);
}
```

Symbol route component:

```tsx
// pages/api/@pkg/@symbol/+Page.tsx
import { useApiExport } from 'vike-plugin-typedoc/client';

export default function Page() {
  const { apiExport, packageName } = useApiExport();
  if (!apiExport) return <h1>Symbol not found in {packageName}</h1>;
  return <h1>{apiExport.name}</h1>;
}
```

## `typedoc` Config Options

| Option | Type | Description |
|--------|------|-------------|
| `typedocDir` | `string` | Directory containing `*.json` TypeDoc output files. |
| `packageNames` | `Record<string, string>` | Optional slug-to-npm-name overrides. |
| `packagesDir` | `string` | Reads missing package names from `<packagesDir>/<slug>/package.json`. |
| `exclude` | `string[]` | Package slugs to skip when loading docs. |
| `buildUrl` | `(packageSlug: string, symbolSlug?: string) => string` | Custom URL builder for package and symbol pages. |
| `basePath` | `string` | Prefix used by default URL builder. Defaults to `/api`. |
| `baseUrl` | `string` | Deployment base URL used when generating HTML links. |
| `remarkPlugins` | `PluggableList` | Extra remark plugins for markdown rendering. |
| `rehypePlugins` | `PluggableList` | Extra rehype plugins for markdown rendering (for example syntax highlighting). |

## Server and Client Entrypoints

- `vike-plugin-typedoc/server`:
  - `loadTypedocContext()`
  - `getTypedocContext()`
  - `withApiPackage()`
  - `withApiExport()`
- `vike-plugin-typedoc/client`:
  - `useApiPackage()`
  - `useApiExport()`

## Headless Utilities (Without Vike Hooks)

Root exports are usable even outside Vike page hooks:

```ts
import {
  buildApiNavigation,
  buildMarkdownProcessor,
  buildSymbolsMap,
  combineApiDocs,
  createTypedocContext,
  parseTypedocJson,
} from 'vike-plugin-typedoc';
```

This is useful if you want to parse TypeDoc JSON once and feed another renderer, while reusing the same symbol-linking logic.

## License

MIT
