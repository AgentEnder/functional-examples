# Docs Example Embedding & TypeDoc Directive Plugin

**Date:** 2026-02-16
**Status:** Approved

## Problem

The docs in `docs/` contain ~25 hardcoded fenced code blocks that should be embedded from live examples or auto-generated from TypeDoc data. Additionally, 4 type definition blocks (`Extractor`, `ExtractorResult`, `Plugin`, `FileContentsParser`) are manually maintained copies of interfaces that drift from source.

## Solution

Two workstreams:

1. **Directive-based TypeDoc integration** — Migrate `remarkCodeProps` to use `remark-directive`, adding a `::typedoc` leaf directive for embedding type signatures with linked types
2. **Comprehensive example extraction** — Create new examples and extend existing ones to cover all inline code blocks, replacing them with Eta template references

## Workstream 1: Directive-Based TypeDoc Plugin

### Syntax

**Type embedding (new — leaf directive):**
```markdown
::typedoc{symbol="Plugin" pkg="functional-examples"}
```
Replaced at build time with a syntax-highlighted TypeScript code block containing the full interface signature, with type tokens auto-linked to API docs.

**Inline code disambiguation (replaces `{pkg: devkit}` prefix — text directive):**
```markdown
:typedoc[createMatcher]{pkg=devkit}
```
Becomes `<code data-pkg="devkit">createMatcher()</code>`, then auto-linked by existing `rehypeTypedoc`.

### Implementation

- Add `remark-directive` as a dependency of `rehype-typedoc`
- Replace `remarkCodeProps` internals to process directive nodes instead of custom `{key: value}` parsing
- `leafDirective` named `typedoc` → look up symbol via `resolveSignature(name, pkg?)` callback → replace with `code` node (`lang: typescript`, `value: signature`)
- `textDirective` named `typedoc` → convert to `inlineCode` with `data-*` hast properties
- New option: `resolveSignature?: (symbolName: string, pkg?: string) => string | undefined`

### Pipeline Position (unchanged)

```
remarkParse → remarkGfm → remarkCodeProps (now directive-based)
  → remarkRehype → rehypeRaw → rehypeGithubAlerts
  → rehypeTypedoc → @shikijs/rehype → rehypeTypedocCodeBlocks
  → rehypeStringify
```

### Type Definitions to Replace

| Doc file | Current block | Directive |
|---|---|---|
| `advanced/custom-extractors.md` | `Extractor<TMetadata>` | `::typedoc{symbol="Extractor" pkg="devkit"}` |
| `advanced/custom-extractors.md` | `ExtractorResult<TMetadata>` | `::typedoc{symbol="ExtractorResult" pkg="devkit"}` |
| `advanced/plugin-authoring.md` | `Plugin<TMetadata>` | `::typedoc{symbol="Plugin" pkg="functional-examples"}` |
| `advanced/plugin-authoring.md` | `FileContentsParser` | `::typedoc{symbol="FileContentsParser" pkg="devkit"}` |

## Workstream 2: Comprehensive Example Extraction

### New Examples

| Example ID | Purpose | Inline blocks covered |
|---|---|---|
| `getting-started` | Minimal setup walkthrough | Config file, single-file frontmatter example, package.json metadata |
| `region-markers` | Region syntax demonstration | `#region`/`#endregion` usage patterns |
| `test-assertions` | All assertion types with regions | exitCode, stdout, stderr, file, dir, snapshot, not |
| `multi-plugin-config` | Plugin composition pattern | Config with JS + test + docs plugins |

### Existing Examples to Extend

| Example | New content |
|---|---|
| `yaml-manifest` | Region in `meta.yml` showing full YAML structure |
| `ci-integration` | Regions for individual workflow steps |
| `plugin-authoring` | Regions for `FileContentsParser`, `schemas`, `validators`, `commands` |
| `custom-extractor` | Region for plugin registration config pattern |

### Blocks That Stay Inline

- Simple CLI commands (`npm install`, `npx functional-examples scan`)
- Directory structure diagrams
- Eta template syntax documentation (showing the syntax itself)

## Migration

- Update all docs using `{pkg: devkit}` inline syntax to `:typedoc[symbol]{pkg=devkit}`
- Replace hardcoded type definition code blocks with `::typedoc` directives
- Replace inline config/code blocks with `<%= example('id').file('path') %>` or `<%= example('id').region('name') %>`
