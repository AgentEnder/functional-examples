# Migration Guide: vike-plugin-typedoc & rehype-typedoc 0.1.x → 0.2.0

**For AI agents** — follow these steps to migrate a consumer repo from 0.1.x to 0.2.0.

## Prerequisites

- `typedoc >= 0.28.0` must be installed (now a peer dependency of both packages)
- `shiki >= 1.0.0` must be installed (now a peer dependency of `vike-plugin-typedoc`)
- `prettier` is optional — if installed, signatures are pretty-printed before highlighting

## Step 1: Update dependencies

```bash
# Update both packages
npm install vike-plugin-typedoc@0.2.0 rehype-typedoc@0.2.0

# Add new peer dependencies if not already installed
npm install typedoc shiki
```

## Step 2: Update `rehype-typedoc` plugin options

Search for: `symbols:` and `buildLink:` in files that configure rehype-typedoc.

```ts
// BEFORE (0.1.x)
import rehypeTypedoc from 'rehype-typedoc';
const options = {
  symbols: symbolsMap,      // Map<string, SymbolEntry>
  buildLink: (symbol) => symbol.path,
};

// AFTER (0.2.0)
import rehypeTypedoc from 'rehype-typedoc';
import type { TypeDocDocument } from 'rehype-typedoc';
const options = {
  documents: [{ packageSlug: 'my-pkg', json: typedocJsonData }],
  buildUrl: (packageSlug, symbolSlug) => `/api/${packageSlug}/${symbolSlug}`,
};
```

The plugin now builds its own symbols map internally using TypeDoc's `Deserializer`. No need to construct one externally.

### New exports from `rehype-typedoc`

- `buildSymbolsFromDocuments(documents, buildUrl)` — if you need the raw symbols map for custom use
- `TypeDocDocument` — type for the document input shape

### Unchanged exports

- `rehypeTypedoc` — same plugin, new options shape
- `rehypeTypedocCodeBlocks` — same plugin, new options shape
- `remarkCodeProps` — unchanged
- `RehypeTypedocSymbol`, `SymbolEntry` — unchanged (internal types)

## Step 3: Update `vike-plugin-typedoc` imports

### Removed exports — find and replace

| Old import (0.1.x) | Replacement (0.2.0) |
|---|---|
| `parseTypedocJson` | `deserializeTypedocJson` |
| `buildSymbolsMap` | Remove — symbols are built internally by `rehype-typedoc` |
| `linkifyType` | Remove — type HTML is generated internally by context |
| `linkifyApiExport` | Remove — linked exports are produced by `getLinkedExport()` |
| `typeToString` | Remove — use TypeDoc's `Type.toString()` directly |

### New exports

| Export | Purpose |
|---|---|
| `deserializeTypedocJson(json, slug, name)` | Replaces `parseTypedocJson` — uses TypeDoc's `Deserializer` |
| `renderSignatureToHtml(text, ranges, options)` | Render a signature to syntax-highlighted + linked HTML |
| `renderTypeToHtml(type, resolveUrl, options)` | Render a TypeDoc `Type` to linked HTML |
| `typeToStringWithRanges(type, resolveUrl)` | Walk a Type tree to produce string + offset ranges |
| `tokenize(code, theme)` / `codeToHtml(code, theme)` | Shiki helpers |
| `BundledTheme` | Re-exported from Shiki |
| `ApiExportWithTypeRef` | Extended `ApiExport` with `_typeRef` field |
| `LinkedApiExport`, `LinkedParameter`, etc. | Moved from removed `linkify.ts` to `types.ts` |

## Step 4: Update TypedocContext usage

### `symbolsMap` and `rehypeOptions` removed

```ts
// BEFORE (0.1.x)
const { symbolsMap, rehypeOptions } = ctx;
// Use symbolsMap for custom lookups
// Pass rehypeOptions to unified pipeline

// AFTER (0.2.0)
// Use getRehypePlugins() for pre-configured rehype-typedoc plugins
const plugins = ctx.getRehypePlugins();
// Returns [rehypeTypedoc, rehypeTypedocCodeBlocks] pre-configured with documents + buildUrl
```

### Using `getRehypePlugins()` in a custom unified pipeline

```ts
// BEFORE (0.1.x)
import rehypeTypedoc, { rehypeTypedocCodeBlocks } from 'rehype-typedoc';

const processor = unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(rehypeTypedoc, ctx.rehypeOptions)
  .use(rehypeShiki, { theme: 'github-dark' })
  .use(rehypeTypedocCodeBlocks, ctx.rehypeOptions)
  .use(rehypeStringify);

// AFTER (0.2.0)
const [rehypeTypedocPlugin, rehypeTypedocCodeBlocksPlugin] = ctx.getRehypePlugins();

const processor = unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(rehypeTypedocPlugin)                           // inline code linking
  .use(rehypeShiki, { theme: 'github-dark' })
  .use(rehypeTypedocCodeBlocksPlugin)                 // code block linking (after Shiki)
  .use(rehypeStringify);
```

## Step 5: Update TypedocContextOptions

### New options

```ts
// BEFORE (0.1.x)
const ctx = await createTypedocContext(packages, {
  buildUrl: (pkg, sym) => `/api/${pkg}/${sym}`,
  rehypePlugins: [[rehypeShiki, { theme: 'github-dark' }]],
});

// AFTER (0.2.0)
const ctx = await createTypedocContext(packages, {
  buildUrl: (pkg, sym) => `/api/${pkg}/${sym}`,
  theme: 'github-dark',        // NEW: Shiki theme for API signatures (built-in)
  documents: typedocDocuments,  // NEW: raw JSON for rehype-typedoc auto-linking
  rehypePlugins: [              // Still needed for markdown code blocks
    [rehypeShiki, { theme: 'github-dark', addLanguageClass: true }],
  ],
});
```

## Step 6: Update `+typedoc.ts` config (if using Vike extension)

```ts
// BEFORE (0.1.x)
import rehypeShiki from '@shikijs/rehype';
export default {
  typedocDir: '...',
  rehypePlugins: [
    [rehypeShiki, { theme: 'github-dark', addLanguageClass: true }],
  ],
};

// AFTER (0.2.0) — no change needed for basic usage
// loadTypedocContext() now automatically collects documents from disk
// and passes them to createTypedocContext
export default {
  typedocDir: '...',
  theme: 'github-dark',  // Optional: Shiki theme for signatures
  rehypePlugins: [
    [rehypeShiki, { theme: 'github-dark', addLanguageClass: true }],
  ],
};
```

## Step 7: Update `+onCreateGlobalContext.server.ts`

```ts
// BEFORE (0.1.x)
const typedoc = await loadTypedocContext(context);
configureRehypeTypedoc(typedoc.rehypeOptions);  // old property

// AFTER (0.2.0)
const typedoc = await loadTypedocContext(context);
configureRehypeTypedoc(typedoc.getRehypePlugins());  // new method
```

## Step 8: Verify `LinkedApiExport` usage

The shape is unchanged. Fields like `signatureCodeHtml`, `descriptionHtml`, `returnTypeHtml`, `parameters[].typeHtml` still exist. The difference is:

- `signatureCodeHtml` now includes syntax highlighting AND links (was unlinked Shiki output before)
- Type HTML fields include `<a>` links with symbol-aware precision
- All comment fields are now fully populated (no more dropped data from custom parser)

No code changes needed for consumers that read these fields.

## Step 9: Remove dead code

Search for and remove any remaining references to:

```bash
grep -rn "parseTypedocJson\|buildSymbolsMap\|linkifyType\|linkifyApiExport\|typeToString\|symbolsMap\|rehypeOptions" \
  --include="*.ts" --include="*.tsx" .
```

## Step 10: Verify

```bash
# Type-check
npx tsc --noEmit

# Run tests
npm test

# Build and verify output
npm run build
```

## Quick reference: import changes

```ts
// BEFORE (0.1.x)
import {
  createTypedocContext,
  parseTypedocJson,
  combineApiDocs,
  buildSymbolsMap,
  linkifyType,
  linkifyApiExport,
  typeToString,
  slugify,
  type LinkedApiExport,
} from 'vike-plugin-typedoc';

// AFTER (0.2.0)
import {
  createTypedocContext,
  deserializeTypedocJson,  // replaces parseTypedocJson
  combineApiDocs,          // unchanged
  slugify,                 // unchanged
  type LinkedApiExport,    // unchanged (moved to types.ts internally)
  // New:
  renderSignatureToHtml,
  typeToStringWithRanges,
  type ApiExportWithTypeRef,
  type BundledTheme,
} from 'vike-plugin-typedoc';
```
