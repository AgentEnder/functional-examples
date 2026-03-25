# Unify `region()` helper signature across guide docs and content.md

## Problem

The `region()` template helper has two different signatures depending on context:

- **In content.md** (example-scoped): `region('path/to/file', 'regionName')` — file path + region name
- **In guide docs** (cross-example): `example('id').region('regionName')` — region name only (no file scoping)

This means:
1. Region names must be **globally unique across all files in an example** when used from guides, but only unique within a single file when used from content.md.
2. The inconsistency is a footgun — it's natural to assume the same `(file, region)` signature works everywhere, and the error message doesn't make the distinction obvious.

## Discovered in

cli-forge docs work: added `#region middleware` to both `middleware/auth.ts` and `middleware/timing.ts` in the same example. Worked fine from content.md but broke when referenced from a guide via `example('middleware-composition').region('middleware')` (ambiguous match).

Had to rename to `auth-middleware` and `timing-middleware` to disambiguate.

## Intended design

The guide helper should chain through `.file()` before `.region()`:

```
// Embed a whole file (toString renders the full file)
<%= example('id').file('path/to/file.ts') %>

// Embed a region within a specific file
<%= example('id').file('path/to/file.ts').region('regionName') %>
```

The object returned by `.file()` should have a `toString()` method that emits the whole file as a fenced code block, so `<%= example('id').file('path.ts') %>` continues to work. Calling `.region()` on that object scopes the region lookup to that file, matching the content.md behavior of `region('file', 'name')`.

This gives a single consistent mental model across both contexts:

```
// Guide docs
<%= example('id').file('path.ts') %>
<%= example('id').file('path.ts').region('name') %>

// content.md — new chained form
<%= file('path.ts') %>
<%= file('path.ts').region('name') %>

// content.md — legacy form (keep for backwards compat)
<%= region('path/to/file', 'regionName') %>
```

- `.file()` selects a file (renders whole file by default via `toString()`)
- `.region()` narrows to a region within the selected file
- The top-level `region('file', 'name')` in content.md remains supported for backwards compatibility

## Current workaround (cli-forge)

Region names are made globally unique per example (`auth-middleware`, `timing-middleware` instead of just `middleware`), and the guide uses `.region('auth-middleware')` directly.
