# Multi-Token Span Linking & Single-Package Auto-Detection

**Date**: 2026-02-27
**Status**: Proposed

## Problem Statement

Two related issues in the rehype-typedoc / vike-plugin-typedoc plugin system:

### 1. Multi-Token Spans (Code Block Linking)

The `rehypeTypedocCodeBlocks` plugin only links identifiers when a Shiki `<span>` contains
exactly one identifier (with optional whitespace). Some Shiki themes (e.g. `github-dark`)
group multiple tokens into a single span:

```html
<!-- github-dark produces: -->
<span style="color:#E1E4E8"> { DefineMessages } </span>

<!-- blueprintTheme produces individual spans: -->
<span style="color:#8FA4BE">{</span>
<span style="color:#E8EDF4"> </span>
<span style="color:#E8EDF4">DefineMessages</span>
```

The current `IDENTIFIER_RE = /^(\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*)$/` fails on the
multi-token span because `{ DefineMessages }` contains non-identifier characters `{` and `}`.

### 2. Single-Package URL Duplication

When a site has only one TypeDoc JSON file (e.g. `api.json`), the default `buildUrl`
produces doubled paths like `/api/api/create-worker`. Consumers must add a custom
`buildUrl` override to work around this.

---

## Task 1: Multi-Token Span Linking in Code Blocks

### File: `packages/rehype-typedoc/src/code-blocks.ts`

**Current behavior**: Only processes spans whose entire text matches `IDENTIFIER_RE`
(a single identifier with optional leading/trailing whitespace).

**New behavior**: Scan each span's text for *all* identifiers, and when any match known
symbols, split the span into segments — non-identifier segments stay as styled spans,
matched identifiers get wrapped in `<a>` links.

#### Implementation

Add a new function `splitSpanByIdentifiers` that takes a span element, scans its text for
identifiers, and returns replacement nodes when matches are found.

**Algorithm:**
1. Extract the single text child from the span (same guard as today)
2. Use a global regex `/[a-zA-Z_$][a-zA-Z0-9_$]*/g` to find all identifier tokens
3. For each identifier, check `SKIP_TOKENS` then `lookupSymbol` + `resolveSymbol`
4. If at least one identifier matches, split the text into segments:
   - Non-identifier text segments → `<span>` with same properties, text child
   - Matched identifiers → `<a class="typedoc-link" href="..."><span>identifier</span></a>`
   - Unmatched identifiers → `<span>` with same properties, text child
5. Return the replacement nodes array (or `null` if nothing matched)

**Changes to `collectReplacements`:**
- Remove the `IDENTIFIER_RE` single-match check
- Call `splitSpanByIdentifiers` instead
- If it returns nodes, push a replacement entry

**Key consideration**: The existing single-identifier fast path is a subset of this
algorithm. The new code handles both cases — single identifiers and multi-token spans.

#### Code

```typescript
// New regex: finds all identifier-like tokens in a string
const IDENTIFIER_GLOBAL_RE = /[a-zA-Z_$][a-zA-Z0-9_$]*/g;

interface IdentifierMatch {
  identifier: string;
  start: number;
  end: number;
  href: string;
}

/**
 * Scan a span's text for linkable identifiers and build replacement nodes.
 * Returns null if no identifiers in this span match known symbols.
 */
function splitSpanByIdentifiers(
  span: Element,
  symbols: RehypeTypedocOptions['symbols'],
  buildLink: RehypeTypedocOptions['buildLink']
): ElementContent[] | null {
  if (span.children.length !== 1 || span.children[0].type !== 'text') return null;

  const textNode = span.children[0] as Text;
  const text = textNode.value;

  // Collect all linkable identifiers with their positions
  const matches: IdentifierMatch[] = [];
  let m: RegExpExecArray | null;
  IDENTIFIER_GLOBAL_RE.lastIndex = 0;

  while ((m = IDENTIFIER_GLOBAL_RE.exec(text)) !== null) {
    const identifier = m[0];
    if (SKIP_TOKENS.has(identifier)) continue;

    const entry = lookupSymbol(symbols, identifier);
    if (!entry) continue;

    let resolved;
    try {
      resolved = resolveSymbol(entry, identifier, undefined);
    } catch {
      continue; // Ambiguous — skip silently in code blocks
    }
    if (!resolved) continue;

    const href = buildLink(resolved);
    if (!href) continue;

    matches.push({
      identifier,
      start: m.index,
      end: m.index + identifier.length,
      href,
    });
  }

  if (matches.length === 0) return null;

  // Build replacement nodes by splitting text at match boundaries
  const nodes: ElementContent[] = [];
  let cursor = 0;

  for (const match of matches) {
    // Text before this match
    if (cursor < match.start) {
      nodes.push({
        ...span,
        children: [{ type: 'text', value: text.slice(cursor, match.start) }],
      } as Element);
    }

    // The linked identifier
    const identSpan: Element = {
      ...span,
      children: [{ type: 'text', value: match.identifier }],
    };
    nodes.push({
      type: 'element',
      tagName: 'a',
      properties: { href: match.href, className: ['typedoc-link'] },
      children: [identSpan],
    } as Element);

    cursor = match.end;
  }

  // Trailing text after last match
  if (cursor < text.length) {
    nodes.push({
      ...span,
      children: [{ type: 'text', value: text.slice(cursor) }],
    } as Element);
  }

  return nodes;
}
```

**Update `collectReplacements`** to use the new function:

```typescript
function collectReplacements(
  code: Element,
  symbols: RehypeTypedocOptions['symbols'],
  buildLink: RehypeTypedocOptions['buildLink']
): Replacement[] {
  const replacements: Replacement[] = [];

  visit(code, 'element', (span, index, parent) => {
    if (span.tagName !== 'span') return;
    if (index === undefined || !parent) return;

    const nodes = splitSpanByIdentifiers(span, symbols, buildLink);
    if (!nodes) return;

    replacements.push({ parent: parent as Element, index, nodes });
  });

  return replacements;
}
```

#### Verification

Run tests from repo root:
```bash
npx nx run rehype-typedoc:test
```

All existing tests must still pass (the new algorithm is a superset of the old one).

### File: `packages/rehype-typedoc/src/code-blocks.spec.ts`

Add tests for multi-token spans:

```typescript
describe('multi-token spans', () => {
  it('links identifiers inside { Foo } import-style spans', () => {
    const input =
      '<pre><code class="language-typescript">' +
      '<span style="color:#F97583">import</span>' +
      '<span style="color:#E1E4E8"> { createMatcher } </span>' +
      '<span style="color:#F97583">from</span>' +
      '<span style="color:#9ECBFF"> \'pkg\'</span>' +
      '</code></pre>';
    const result = processHtml(input, defaultOpts);
    expect(result).toContain('href="/api/devkit/create-matcher"');
    expect(result).toContain('class="typedoc-link"');
  });

  it('links multiple identifiers in one span', () => {
    const input =
      '<pre><code class="language-typescript">' +
      '<span style="color:#E1E4E8"> { createMatcher, Extractor } </span>' +
      '</code></pre>';
    const result = processHtml(input, defaultOpts);
    expect(result).toContain('href="/api/devkit/create-matcher"');
    expect(result).toContain('href="/api/devkit/extractor"');
  });

  it('preserves non-identifier text around linked identifiers', () => {
    const input =
      '<pre><code class="language-typescript">' +
      '<span style="color:#E1E4E8"> { createMatcher } </span>' +
      '</code></pre>';
    const result = processHtml(input, defaultOpts);
    // The { and } should still be present
    expect(result).toContain('{');
    expect(result).toContain('}');
  });

  it('skips spans with no matching identifiers', () => {
    const input =
      '<pre><code class="language-typescript">' +
      '<span style="color:#E1E4E8"> { unknownThing } </span>' +
      '</code></pre>';
    const result = processHtml(input, defaultOpts);
    expect(result).not.toContain('<a');
  });

  it('handles mixed matched and unmatched identifiers', () => {
    const input =
      '<pre><code class="language-typescript">' +
      '<span style="color:#E1E4E8"> { createMatcher, unknownThing } </span>' +
      '</code></pre>';
    const result = processHtml(input, defaultOpts);
    expect(result).toContain('href="/api/devkit/create-matcher"');
    expect(result).not.toContain('href="unknownThing"');
    expect(result).toContain('unknownThing');
  });
});
```

#### Verification

```bash
npx nx run rehype-typedoc:test
```

All new and existing tests must pass.

---

## Task 2: Single-Package Auto-Detection

### File: `packages/vike-plugin-typedoc/src/context.ts`

**Current behavior**: `createDefaultBuildUrl` always includes `packageSlug` in the URL.

**New behavior**: When `packages.length === 1` and no custom `buildUrl` is provided,
use a `buildUrl` that omits the package slug.

#### Implementation

In `createTypedocContext`, detect the single-package case:

```typescript
export async function createTypedocContext(
  packages: ApiPackage[],
  options: TypedocContextOptions = {}
): Promise<TypedocContext> {
  const basePath = options.basePath ?? '/api';
  const isSinglePackage = packages.length === 1;

  // When single-package and no custom buildUrl, skip the package slug
  const buildUrl = options.buildUrl
    ?? (isSinglePackage
      ? createSinglePackageBuildUrl(basePath)
      : createDefaultBuildUrl(basePath));

  // ... rest unchanged
}
```

Add the new URL builder:

```typescript
function createSinglePackageBuildUrl(basePath: string) {
  return (_packageSlug: string, symbolSlug?: string): string =>
    symbolSlug ? `${basePath}/${symbolSlug}` : basePath;
}
```

### File: `packages/vike-plugin-typedoc/src/navigation.ts`

**Current behavior**: Always creates a package grouping node with children.

**New behavior**: When single-package, flatten — return export children directly
at the top level with no intermediate package node.

#### Implementation

Add a `singlePackage` parameter:

```typescript
export function buildApiNavigation(
  docs: ApiDocs,
  options?: { singlePackage?: boolean }
): NavigationItem[] {
  const packages = Object.values(docs.packages);

  // Single-package: flatten children to top level
  if (options?.singlePackage && packages.length === 1) {
    const pkg = packages[0];
    return pkg.exports
      .map((exp) => ({
        title: exp.name,
        path: exp.path,
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  // Multi-package: group by package (existing behavior)
  const items: NavigationItem[] = [];
  for (const pkg of packages) {
    const children: NavigationItem[] = pkg.exports.map((exp) => ({
      title: exp.name,
      path: exp.path,
    }));

    items.push({
      title: pkg.name,
      path: '',
      children,
    });
  }

  return items.sort((a, b) => a.title.localeCompare(b.title));
}
```

**In `createTypedocContext`**, pass the flag:

```typescript
const navigation = buildApiNavigation(apiDocs, { singlePackage: isSinglePackage });
```

And update the navigation path assignment to handle single-package (no package-level
nav items to update):

```typescript
if (!isSinglePackage) {
  for (const navItem of navigation) {
    const pkg = Object.values(apiDocs.packages).find(
      (p) => p.name === navItem.title
    );
    if (pkg) {
      navItem.path = buildUrl(pkg.slug);
    }
  }
}
```

### File: `packages/vike-plugin-typedoc/src/context.spec.ts`

Add tests for single-package behavior:

```typescript
describe('single-package auto-detection', () => {
  function makeSinglePackage() {
    return [
      parseTypedocJson(
        makeFunctionJson('createWorker', 'Worker'),
        'api',
        'isolated-workers'
      ),
    ];
  }

  it('omits package slug from export paths for single package', async () => {
    const ctx = await createTypedocContext(makeSinglePackage());
    const exp = ctx.apiDocs.packages['api'].exports[0];
    expect(exp.path).toBe('/api/create-worker');
  });

  it('produces basePath as the package URL for single package', async () => {
    const ctx = await createTypedocContext(makeSinglePackage());
    const urls = ctx.getPackageUrls();
    expect(urls).toEqual(['/api']);
  });

  it('flattens navigation for single package', async () => {
    const ctx = await createTypedocContext(makeSinglePackage());
    // Should be flat: no children, just export items at top level
    expect(ctx.navigation.every((n) => !n.children?.length)).toBe(true);
    expect(ctx.navigation.some((n) => n.title === 'createWorker')).toBe(true);
  });

  it('custom buildUrl still overrides single-package default', async () => {
    const ctx = await createTypedocContext(makeSinglePackage(), {
      buildUrl: (pkg, sym) => (sym ? `/docs/${pkg}/${sym}` : `/docs/${pkg}`),
    });
    const exp = ctx.apiDocs.packages['api'].exports[0];
    expect(exp.path).toBe('/docs/api/create-worker');
  });

  it('multi-package still uses package slug in URLs', async () => {
    const ctx = await createTypedocContext(makeTestPackages());
    const exp = ctx.apiDocs.packages['devkit'].exports[0];
    expect(exp.path).toBe('/api/devkit/create-matcher');
  });
});
```

#### Verification

```bash
npx nx run vike-plugin-typedoc:test
```

All new and existing tests must pass.

---

## Task 3: Remove Custom buildUrl from isolated-workers

### File: `/Users/agentender/repos/isolated-workers/docs-site/pages/+typedoc.ts`

Once Task 2 is complete, the custom `buildUrl` in isolated-workers becomes unnecessary
because the auto-detection handles it. Remove the override:

```typescript
// Before:
export default {
  typedocDir: path.join(repoRoot, '.typedoc'),
  packageNames: { api: 'isolated-workers' },
  buildUrl: (_packageSlug: string, symbolSlug?: string) =>
    symbolSlug ? `/api/${symbolSlug}` : '/api',
  rehypePlugins: [ ... ],
}

// After:
export default {
  typedocDir: path.join(repoRoot, '.typedoc'),
  packageNames: { api: 'isolated-workers' },
  rehypePlugins: [ ... ],
}
```

#### Verification

1. Rebuild the docs site and verify URLs are still correct
2. Check that the error-handling guide page renders with correct API links

---

## Execution Order

1. **Task 1** (multi-token spans) — standalone change in `rehype-typedoc`
2. **Task 2** (single-package auto-detection) — standalone change in `vike-plugin-typedoc`
3. **Task 3** (cleanup isolated-workers) — depends on Task 2 being published/linked

Tasks 1 and 2 are independent and can be done in parallel.
