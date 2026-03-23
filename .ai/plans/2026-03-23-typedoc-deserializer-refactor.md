# TypeDoc Deserializer Refactor

**Date:** 2026-03-23
**Packages:** `vike-plugin-typedoc` (0.2.0), `rehype-typedoc` (0.2.0)

## Problem

`vike-plugin-typedoc` has a custom TypeDoc JSON parser (`parser.ts`, `utils.ts`) that reimplements what TypeDoc's `Deserializer` already provides. This causes:

- **Dropped comment data** — the custom parser misses some comment fields
- **Lossy type serialization** — `typeToString()` handles ~15 type kinds with fallbacks (`mapped` → `{}`, `templateLiteral` → `string`); TypeDoc's `Type.toString()` handles all of them correctly
- **Invalid TypeScript output** — property names like `--` weren't quoted, requiring patches
- **Maintenance burden** — every new TypeScript type construct requires updating the custom parser

## Solution

Replace the custom parsing with TypeDoc's native `Deserializer.reviveProject()` and `Type.toString()`. Own the full rendering pipeline from TypeDoc JSON to linked, syntax-highlighted HTML inside `vike-plugin-typedoc`.

## Architecture

### Package Boundaries

**`rehype-typedoc` (0.2.0)** — standalone unified plugin suite for auto-linking API symbols in markdown content.

- Input: TypeDoc JSON document(s) + `buildUrl(packageSlug, symbolSlug?) => string`
- Builds symbols map internally from the JSON
- Exports:
  - `rehypeTypedoc` — inline `<code>` → `<a>` linking (runs before Shiki)
  - `rehypeTypedocCodeBlocks` — code block span linking (runs after Shiki)
  - `remarkCodeProps` — `:typedoc[Symbol]` directive support
- No TypeDoc `Deserializer` dependency — works on raw JSON shape
- Use case: "I have other docs and want to autolink API symbols"

**`vike-plugin-typedoc` (0.2.0)** — full API docs solution for Vike sites.

- Input: `.typedoc/*.json` files on disk
- Uses TypeDoc `Deserializer` to get the full model
- Owns: deserialization, type rendering, Shiki highlighting, signature HTML
- For its markdown pipeline: wires in `rehype-typedoc` for auto-linking
- Exports: Vike hooks, context API, React hooks, `ApiExport` types
- Dependencies: `rehype-typedoc`, `typedoc`, `shiki`
- Optional peer dep: `prettier` (formats code blocks before Shiki if available)
- Use case: "I want API docs with embedded links"

Common case: use both. `vike-plugin-typedoc` for API pages, `rehype-typedoc` in a separate markdown pipeline for non-API docs that reference the API.

### File Changes in `vike-plugin-typedoc`

**Deleted:**
- `parser.ts` — replaced by `deserialize.ts`
- `utils.ts: typeToString()` — replaced by `Type.toString()` + `typeToStringWithRanges()`
- `utils.ts: parseComment()` — replaced by TypeDoc's `Comment` model
- `linkify.ts` — replaced by `type-renderer.ts`
- `types.ts` — TypeDoc JSON schema types removed; `ApiExport` and friends stay

**New:**
- `deserialize.ts` — wrapper around `Deserializer.reviveProject()`, walks `ProjectReflection` to produce `ApiExport[]`
- `type-renderer.ts` — walks `Type` tree to produce plain string + offset range map, then merges with Shiki tokens to produce linked, highlighted HTML
- `shiki.ts` — lazy Shiki highlighter singleton, exposes `tokenize(code, lang)`

**Modified:**
- `context.ts` — internals rewired, public API mostly unchanged
- `markdown.ts` — simplified pipeline, `rehype-typedoc` plugins wired in
- `server.ts` — calls `deserialize.ts` instead of `parser.ts`
- `symbols.ts` — simplified or inlined
- `navigation.ts` — unchanged
- `client.ts` — unchanged

### File Changes in `rehype-typedoc`

**Modified:**
- Plugin options change: accepts TypeDoc JSON document(s) + `buildUrl` instead of a pre-built symbols map
- Builds symbols map internally from the documents
- Core linking logic (tokenization, span splitting) stays the same

### Deserialization (`deserialize.ts`)

```
JSON file → Deserializer.reviveProject() → ProjectReflection
  → walk children (DeclarationReflection[])
  → filter: skip private, protected, underscore-prefixed
  → for each: build ApiExport from the reflection
```

Building `ApiExport` from `DeclarationReflection`:

| ApiExport field | Source |
|---|---|
| `name` | `reflection.name` |
| `slug` | `slugify(reflection.name)` |
| `kind` | Map `ReflectionKind` → `ApiExportKind` |
| `isReExport` | Check `reflection.sources` against package slug |
| `description` | `Comment.combineDisplayParts(comment?.summary)` |
| `comment.summary` | `comment.summary` display parts |
| `comment.remarks` | `comment.getTag('@remarks')` |
| `comment.examples` | `comment.getTags('@example')` |
| `comment.see` | `comment.getTags('@see')` |
| `comment.deprecated` | `comment.getTag('@deprecated')` or `comment.hasModifier('@deprecated')` |
| `signature` | `Type.toString()` for type aliases; built from `SignatureReflection` for functions |
| `parameters` | `signature.parameters[]` with `param.type.toString()` |
| `returnType` | `signature.type.toString()` |
| `properties` | `reflection.children` where kind is Property |
| `methods` | `reflection.children` where kind is Method |
| `typeParameters` | `signature.typeParameters[]` or `reflection.typeParameters[]` |

Raw TypeDoc `Type` objects are stored alongside string representations on internal fields (`_typeRef`) for use by the type renderer.

### Type Renderer (`type-renderer.ts`)

The rendering pipeline for a signature:

```
Type tree
  → typeToStringWithRanges()    → plain string + range map
  → prettier.format()           → reformatted string (if prettier available)
  → remap ranges                → adjusted range map
  → shiki.codeToTokens()        → tokens with offsets
  → merge tokens + ranges       → HTML with links + syntax highlighting
```

**Step 1: `typeToStringWithRanges(type: Type)`**

Walks the TypeDoc `Type` tree recursively, building a plain string and collecting a parallel range map. For each `ReferenceType` node that resolves to a known export, records `{ start, end, path }`.

```ts
{
  text: "function scan(options: ScanOptions): Promise<DigestOutput>",
  ranges: [
    { start: 22, end: 33, path: "/api/dependency-digest/scan-options" },
    { start: 44, end: 56, path: "/api/dependency-digest/digest-output" },
  ]
}
```

**Step 2: Prettier (optional)**

Dynamic `import('prettier')` in try/catch. If available, format with `parser: 'typescript'`. Then remap ranges by marching through Shiki tokens: we know the original symbol names and their order, so we scan the formatted string for each name in sequence, recording new offsets.

**Step 3: Shiki tokenization**

`shiki.codeToTokens(formattedString, { lang: 'ts', theme })` returns `ThemedToken[][]` where each token has `content`, `offset`, and `color`.

**Step 4: Merge and emit HTML**

For each Shiki token, check if `token.offset` falls within any range. If yes, wrap the `<span>` in `<a href="...">`. Assemble into `<pre class="shiki ..."><code>...</code></pre>`.

Token-to-range alignment is exact because:
- Shiki tokens have character-level offsets
- Symbol names are single tokens (identifiers)
- Prettier only changes whitespace, not identifier text
- We march through ranges in order since both are ordered by position

### Markdown Pipeline

For API export rendering (descriptions, remarks, examples):

```
remarkParse → remarkGfm → remarkBreaks → remarkDirective
  → [user remarkPlugins] → remarkRehype
  → rehypeTypedoc              ← inline code auto-linking
  → [user rehypePlugins]       ← consumer adds rehypeShiki here
  → rehypeTypedocCodeBlocks    ← code block auto-linking (after Shiki)
  → rehypeStringify
```

Signatures and type annotations are NOT rendered through this pipeline — they go through `type-renderer.ts` directly.

### Context API

```ts
interface TypedocContext {
  // Unchanged
  apiDocs: ApiDocs;
  getLinkedExport(pkg: string, symbol: string): LinkedApiExport | null;
  getPackage(slug: string): ApiPackage | null;
  getExportUrls(): string[];
  getPackageUrls(): string[];
  getAllPrerenderUrls(): string[];

  // New
  getRehypePlugins(): unified.Plugin[];  // pre-configured rehype-typedoc plugins

  // Removed
  // symbolsMap — internal detail
  // rehypeOptions — replaced by getRehypePlugins()
  // navigation — consumer concern
}
```

`getRehypePlugins()` returns `[rehypeTypedoc, rehypeTypedocCodeBlocks]` pre-configured with the symbols map and `buildLink` function, ready to spread into any unified pipeline.

All rendering is eager at context creation time — signatures, types, and markdown are pre-rendered and cached. `getLinkedExport()` returns synchronously.

### Shiki Configuration

The highlighter theme is configurable via plugin options:

```ts
export default {
  typedocDir: '...',
  theme: 'github-dark',        // Shiki theme for API signatures
  rehypePlugins: [...],         // For markdown content (user provides rehypeShiki)
};
```

The plugin creates one Shiki highlighter instance (lazy singleton) shared across all signature renders.

## Migration Guide (0.1.x → 0.2.0)

### For AI agents consuming these packages

#### `vike-plugin-typedoc` changes

**Config (`+typedoc.ts`):**

```ts
// BEFORE (0.1.x)
import rehypeShiki from '@shikijs/rehype';
export default {
  typedocDir: '...',
  rehypePlugins: [
    [rehypeShiki, { theme: 'github-dark', addLanguageClass: true }],
  ],
};

// AFTER (0.2.0)
export default {
  typedocDir: '...',
  theme: 'github-dark',  // Shiki for signatures is now built-in
  rehypePlugins: [
    // Only needed for user-authored markdown code blocks (examples, remarks)
    // rehypeShiki is still needed here for non-signature code
    [rehypeShiki, { theme: 'github-dark', addLanguageClass: true }],
  ],
};
```

**Context API:**

```ts
// BEFORE: accessing raw options
const { symbolsMap, rehypeOptions } = ctx;

// AFTER: use getRehypePlugins() for markdown pipelines
const plugins = ctx.getRehypePlugins();
// Returns pre-configured [rehypeTypedoc, rehypeTypedocCodeBlocks]
```

**LinkedApiExport:**

The shape is the same. Fields like `signatureCodeHtml`, `descriptionHtml`, `returnTypeHtml`, `parameters[].typeHtml` etc. still exist. The difference is:

- `signatureCodeHtml` now includes syntax highlighting AND links (was plain Shiki before)
- Type HTML fields (`typeHtml`, `returnTypeHtml`) now include `<a>` links with syntax-aware precision (was regex-based before)
- All comment fields are now fully populated (no more dropped data)

**Removed exports:**
- `linkifyType()` — no longer needed; type HTML is generated internally
- `linkifyApiExport()` — same
- `buildSymbolsMap()` — internal detail

**New peer dependency:**
- `prettier` (optional) — if installed, signatures are pretty-printed before highlighting

#### `rehype-typedoc` changes

**Plugin options:**

```ts
// BEFORE (0.1.x)
import rehypeTypedoc from 'rehype-typedoc';
const options = {
  symbols: symbolsMap,      // Map<string, SymbolEntry>
  buildLink: (symbol) => symbol.path,
};

// AFTER (0.2.0)
import rehypeTypedoc from 'rehype-typedoc';
const options = {
  documents: [typedocJson],   // Raw TypeDoc JSON document(s)
  buildUrl: (packageSlug, symbolSlug?) => `...`,
};
```

The plugin now builds its own symbols map from the documents. No need to construct one externally.

**Exports unchanged:**
- `rehypeTypedoc` — same plugin, new options shape
- `rehypeTypedocCodeBlocks` — same plugin, new options shape
- `remarkCodeProps` — unchanged

#### For consumers using both packages

If using `vike-plugin-typedoc` and also a separate markdown pipeline:

```ts
// In your custom markdown renderer
import { getTypedocContext } from 'vike-plugin-typedoc/server';

const ctx = getTypedocContext(pageContext);
const [rehypeTypedoc, rehypeTypedocCodeBlocks] = ctx.getRehypePlugins();

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeTypedoc)           // inline code linking
  .use(rehypeShiki, { theme: 'github-dark' })
  .use(rehypeTypedocCodeBlocks)  // code block linking (after Shiki)
  .use(rehypeStringify);
```

## Implementation Order

1. **`rehype-typedoc` 0.2.0** — update options to accept documents + buildUrl, build symbols map internally. Keep all linking logic. Update tests.
2. **`vike-plugin-typedoc` new files** — `deserialize.ts`, `type-renderer.ts`, `shiki.ts`. Unit test each in isolation.
3. **`vike-plugin-typedoc` rewire** — update `context.ts`, `markdown.ts`, `server.ts` to use new internals. Delete `parser.ts`, old `linkify.ts`, TypeDoc JSON types from `types.ts`.
4. **Integration test** — build the digests docs-site against the new packages, verify output.
5. **Cleanup** — remove the pnpm patch from digests, remove `remarkPrettier` plugin (prettier is now internal), update digests `+typedoc.ts` config.
