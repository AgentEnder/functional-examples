# Global Config + onBeforePrerenderStart Pattern

## Overview

This document describes a pattern for accessing config values in Vike's `+onBeforePrerenderStart` hook using global configs. The plan is to integrate this into `vike-plugin-typedoc`.

## Problem Statement

Vike's `+onBeforePrerenderStart` hook receives **no parameters** - it's called as `hook.hookFn()` with no arguments. This makes it impossible to access page configs or custom settings needed to generate prerender URLs.

## Solution: Global Configs

By marking a config as `global: true`, it becomes accessible via `getGlobalContext().config`.

## Key Research Findings

### 1. Route Matching is Dynamic

Routes returned by `onBeforePrerenderStart` are matched to pages via Vike's **standard routing system**:

```
+onBeforePrerenderStart() returns URLs
        ↓
For each URL → route(pageContext)
        ↓
Vike matches against ALL page routes
        ↓
Matching pageId determined dynamically
```

This means:
- A single hook can generate URLs for **multiple different pages**
- The hook doesn't "own" the URLs - routing determines the target page
- If no route matches, Vike throws an error with helpful context

### 2. Global vs Page-Level Configs

| Aspect | Global Config | Page Config |
|--------|--------------|-------------|
| Access | `getGlobalContext().config` | Only in page context |
| Scope | All pages | Inherits per-page |
| Override | No per-page overrides | Yes |
| Availability | Build-time | Runtime |

## Implementation Pattern

### Reference Implementation

See: [`../vike-global-config-prerender/`](../vike-global-config-prerender/)

### Core Pattern

```typescript
// pages/+config.ts
export default {
  meta: {
    myPrerenderData: {
      env: { server: true },
      global: true,  // <-- Makes it available globally
    },
  },
  myPrerenderData: [/* data for URL generation */],
} satisfies Config

// pages/my-route/+onBeforePrerenderStart.ts
import { getGlobalContext } from 'vike/server'

export const onBeforePrerenderStart = async () => {
  const ctx = await getGlobalContext()
  const data = ctx.config.myPrerenderData ?? []
  
  return data.map(item => `/my-route/${item.slug}`)
}
```

### Type Augmentation

```typescript
declare global {
  namespace Vike {
    interface Config {
      myPrerenderData?: Array<{ slug: string; /* ... */ }>
    }
  }
}
```

## Integration Plan for vike-plugin-typedoc

### Use Case

`vike-plugin-typedoc` needs to:
1. Know which TypeDoc pages to prerender
2. Access TypeDoc configuration (entry points, output paths, etc.)
3. Generate URLs for all documented symbols

### Proposed Config Structure

```typescript
// In vike-plugin-typedoc's +config.ts
export default {
  meta: {
    typedoc: {
      env: { server: true, config: true },
      global: true,
    },
  },
}

// User's pages/+config.ts
export default {
  extends: [vikeTypedoc],
  typedoc: {
    entryPoints: ['./src/index.ts'],
    prerenderSymbols: true,  // Generate URLs for all symbols
    baseUrl: '/api',
  },
}
```

### Plugin's onBeforePrerenderStart

```typescript
// vike-plugin-typedoc/pages/api/@symbol/+onBeforePrerenderStart.ts
import { getGlobalContext } from 'vike/server'
import { generateTypedocUrls } from '../utils'

export const onBeforePrerenderStart = async () => {
  const ctx = await getGlobalContext()
  const config = ctx.config.typedoc
  
  if (!config?.prerenderSymbols) {
    return []
  }
  
  // Generate URLs for all documented symbols
  const urls = await generateTypedocUrls(config)
  return urls.map(url => ({
    url,
    pageContext: { /* pre-populated data */ },
  }))
}
```

## Files Reference

| File | Description |
|------|-------------|
| [`../vike-global-config-prerender/README.md`](../vike-global-config-prerender/README.md) | Pattern overview |
| [`../vike-global-config-prerender/pages/+config.ts`](../vike-global-config-prerender/pages/+config.ts) | Global config definition example |
| [`../vike-global-config-prerender/pages/products/@slug/+onBeforePrerenderStart.ts`](../vike-global-config-prerender/pages/products/@slug/+onBeforePrerenderStart.ts) | Hook accessing global config |
| [`../vike-global-config-prerender/advanced-events-pattern.ts`](../vike-global-config-prerender/advanced-events-pattern.ts) | Complex nested routes example |

## Vike Source References

Key files in Vike codebase for understanding this pattern:

| File | Relevance |
|------|-----------|
| `vike/src/node/prerender/runPrerender.ts` | Hook invocation, route matching |
| `vike/src/node/vite/shared/resolveVikeConfigInternal/configDefinitionsBuiltIn.ts` | Global config definitions |
| `vike/src/shared-server-client/page-configs/resolveVikeConfigPublic.ts` | Config resolution for `getGlobalContext()` |
| `vike/src/node/plugin/plugins/commonConfig.ts` | How configs flow from plugin to runtime |

## Limitations

1. **No per-page overrides**: Global configs apply uniformly to all pages
2. **Build-time data**: Values must be available when config is loaded
3. **Global location required**: Must be defined in a directory inherited by all pages

## Alternative Approaches Considered

1. **Direct data loading in hook**: Works but doesn't leverage config system
2. **onCreateGlobalContext**: Can populate data but timing with prerender is complex
3. **Vite plugin config**: Can pass data but requires plugin configuration

## Next Steps

1. [ ] Create `vike-plugin-typedoc` skeleton with this pattern
2. [ ] Implement TypeDoc symbol URL generation
3. [ ] Test prerendering with various TypeDoc configurations
4. [ ] Document the plugin's config options
