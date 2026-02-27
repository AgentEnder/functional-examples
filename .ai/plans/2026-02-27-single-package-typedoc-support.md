# Single-Package Site Support for vike-plugin-typedoc

**Date**: 2026-02-27
**Status**: Proposed
**Priority**: Low

## Problem

When a site has only one TypeDoc JSON file (e.g., `api.json`), the default `buildUrl` produces doubled paths like `/api/api/create-worker`. The package slug (`api`) duplicates the base path (`/api`).

Currently, consumers must add a custom `buildUrl` override to work around this:

```ts
typedoc: {
  buildUrl: (_packageSlug, symbolSlug) =>
    symbolSlug ? `/api/${symbolSlug}` : '/api',
}
```

## Proposed Solution

Add a `singlePackage: true` option to vike-plugin-typedoc that automatically strips the package slug from generated URLs when there is exactly one TypeDoc JSON file.

### Behavior

When `singlePackage: true`:
- `buildUrl` defaults to `(_, symbolSlug) => symbolSlug ? '/api/' + symbolSlug : '/api'`
- Navigation omits the package-level grouping (no intermediate "isolated-workers" node)
- The `@pkg` route parameter in API pages becomes optional

### Fallback

If `singlePackage: true` but multiple JSON files are found, emit a warning and fall back to the standard multi-package URL scheme.

## Scope

- Config type change in `TypedocContextOptions`
- Default `buildUrl` logic in `context.ts`
- Navigation builder adjustment in `navigation.ts`
- Documentation update

## Workaround (Current)

Sites can pass a custom `buildUrl` function — this plan just makes the common single-package case zero-config.
