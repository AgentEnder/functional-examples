# Research: Config Access in Vike's `+onBeforePrerenderStart` Hook

**Date:** 2026-02-11  
**Status:** Research Complete  
**Repository:** vike (https://github.com/vikejs/vike)

## Executive Summary

The `+onBeforePrerenderStart` hook in Vike currently does **not** have access to config values. This research explores whether it would be feasible and desirable to add such access.

**Conclusion:** Adding config access is technically feasible and relatively straightforward, but there are semantic concerns that should be carefully considered before implementation.

---

## Current Implementation

### How the Hook Works

The `+onBeforePrerenderStart` hook is defined in `/packages/vike/src/node/prerender/runPrerender.ts` and is called during the build-time prerendering process.

**Key characteristics:**
- **Environment:** Server-side only (`server: true`)
- **Production only:** Only runs during build, never in development (`production: true`)
- **No parameters:** The hook function receives no arguments

**Type signature** (from `/packages/vike/src/types/Config.ts`):
```typescript
type OnBeforePrerenderStartAsync<Data = unknown> = () => Promise<
  (
    | string
    | {
        url: string
        pageContext: Partial<Vike.PageContext & { data: Data }>
      }
  )[]
>
```

**Invocation** (from `runPrerender.ts:413`):
```typescript
const prerenderResult = await execHookSingleWithoutPageContext(hook, globalContext, () => hook.hookFn())
```

### Current Workarounds for Config Access

Users who need config values have two options:

1. **Direct import:**
   ```typescript
   import myConfig from './+config'
   
   export function onBeforePrerenderStart() {
     // Use myConfig directly
   }
   ```

2. **Use `getGlobalContext()`:**
   ```typescript
   import { getGlobalContext } from 'vike/server'
   
   export async function onBeforePrerenderStart() {
     const globalContext = await getGlobalContext()
     const pageConfig = globalContext.pages['/pages/my-page'].config
     // ...
   }
   ```

---

## Feasibility Analysis

### Technical Feasibility: **Yes**

Adding config access is straightforward. The required data is already available:

1. When collecting hooks, we have access to `pageConfigLoaded`:
   ```typescript
   const pageConfigLoaded = await loadAndParseVirtualFilePageEntry(pageConfig, false)
   ```

2. Config can be resolved using existing utilities:
   ```typescript
   const resolvedConfig = resolvePageConfigPublic({
     pageConfigGlobalValues,
     pageConfigValues: pageConfigLoaded.configValues
   })
   ```

### Files to Modify

| File | Change |
|------|--------|
| `/packages/vike/src/types/Config.ts` | Update type signatures to accept optional context parameter |
| `/packages/vike/src/node/prerender/runPrerender.ts` | Modify `callOnBeforePrerenderStartHooks()` to pass config |
| `/packages/vike/src/shared-server-client/hooks/execHook.ts` | Possibly create new exec variant or modify existing |

### Implementation Approach

**Recommended: Pass a context object**

```typescript
type OnBeforePrerenderStartAsync<Data = unknown> = (context?: {
  config: ConfigResolved
}) => Promise<...>
```

This is:
- **Backward compatible** - Old hooks without parameters continue to work
- **Consistent** - Similar to other hooks that receive context
- **Focused** - Only exposes what's relevant

---

## Concerns and Considerations

### 1. Semantic/Conceptual Mismatch (Primary Concern)

The `+onBeforePrerenderStart` hook is designed to run **before any page context exists**. It answers "what pages should exist?" rather than "how should this page behave?"

**The problem:**
- The hook is defined in a specific page's directory (e.g., `/pages/star-wars/+onBeforePrerenderStart.ts`)
- But it returns URLs for **multiple different pages** (including pages with different configs)
- We can only pass the config for the page where the hook is defined

**Potential user confusion:**
> "Why do I get the config for `/star-wars/` when I'm generating URLs for `/star-wars/@id/`?"

### 2. Config Values May Not Be Fully Resolved

During prerendering, not all config values may be available or meaningful:
- **Runtime-only configs** - computed during actual page rendering
- **Request-dependent configs** - vary based on incoming requests
- **Lazy-loaded configs** - not loaded until actually needed

Exposing partially-resolved config could lead to subtle bugs.

### 3. Encourages Anti-Patterns

The hook is intentionally minimal. Adding config access might encourage tight coupling between prerender URL generation and page-specific config, when these concerns might be better separated.

Users who need config-dependent logic could:
- Import the config directly (already possible)
- Use a shared module for the logic
- Put the logic in a different hook

### 4. `getGlobalContext()` Already Works

The existing workaround is functional and more explicit:
```typescript
import { getGlobalContext } from 'vike/server'

export async function onBeforePrerenderStart() {
  const globalContext = await getGlobalContext()
  const myPageConfig = globalContext.pages['/pages/my-page'].config
  // ...
}
```

This forces users to think about *which* page's config they need.

### 5. Breaking Change Considerations

While technically backward compatible:
- Documentation needs updating
- TypeScript types change (even if optional)
- Could cause confusion between old examples and new capability

---

## Arguments in Favor

1. **Convenience** - The current workaround is verbose and requires knowing internal page IDs

2. **Consistency** - Other hooks receive context; this one is an outlier:
   - `+data` receives `pageContext`
   - `+guard` receives `pageContext`
   - `+onBeforeRender` receives `pageContext`
   - `+onRenderHtml` receives `pageContext`
   - `+onBeforePrerenderStart` receives **nothing** (outlier)

3. **Common Use Case** - Users often want to conditionally generate URLs based on config (e.g., only prerender certain pages in certain environments)

4. **Discoverability** - New users expect hooks to receive context

---

## Recommendation

### If Implementing: Use Clear Documentation

If this feature is implemented, documentation should clearly state:

> "The `config` passed to `onBeforePrerenderStart` is from the page where the hook is defined, not the pages being generated. To access config for other pages, use `getGlobalContext().pages[pageId].config`."

### Alternative: Improve `getGlobalContext()` Ergonomics

Instead of modifying the hook signature, consider improving the ergonomics of the existing workaround:

1. Export a helper function specifically for this use case
2. Document the pattern more prominently
3. Add TypeScript helpers for page ID autocompletion

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `/packages/vike/src/types/Config.ts` | Hook type definitions |
| `/packages/vike/src/node/prerender/runPrerender.ts` | Hook invocation logic |
| `/packages/vike/src/shared-server-client/hooks/execHook.ts` | Hook execution utilities |
| `/packages/vike/src/shared-server-client/page-configs/resolveVikeConfigPublic.ts` | Config resolution logic |
| `/packages/vike/src/server/runtime/globalContext.ts` | `getGlobalContext()` implementation |
| `/packages/vike/src/types/GlobalContext.ts` | GlobalContext type definitions |

---

## Example Usage (If Implemented)

```typescript
// /pages/blog/+onBeforePrerenderStart.ts
export async function onBeforePrerenderStart({ config }) {
  // Access config values from this page's +config.ts
  if (config.prerender === false) {
    return []
  }
  
  const posts = await fetchBlogPosts()
  return posts.map(post => `/blog/${post.slug}`)
}
```

---

## Open Questions

1. Should we pass `globalContext` as well, giving access to all pages' configs?
2. Should we pass `pageId` to help users understand which page's config they have?
3. Is there a use case for accessing other pages' configs that the current `getGlobalContext()` pattern doesn't serve well?
