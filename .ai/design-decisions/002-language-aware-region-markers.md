# ADR 002: Language-Aware Region Markers

## Status

Accepted

## Context

Region markers (like `#region`/`#endregion`) are used to extract specific code sections from examples. Different languages have different comment syntaxes:

- JavaScript/TypeScript: `// #region name`
- Python: `# #region name`
- HTML: `<!-- #region name -->`
- SQL: `-- #region name`
- CSS: `/* #region name */`

The original isolated-workers implementation only supported JavaScript-style comments.

## Decision

Create a `LANGUAGE_CONFIGS` mapping that associates file extensions with their comment syntax:

```typescript
const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  ts: { lineComment: '//' },
  py: { lineComment: '#' },
  html: { blockComment: ['<!--', '-->'] },
  sql: { lineComment: '--' },
  css: { blockComment: ['/*', '*/'] },
  // ... 30+ languages
};
```

Region extraction functions accept an `extension` option to determine the correct comment pattern:

```typescript
const regions = parseRegions(code, { extension: 'py' });
```

## Consequences

### Positive

- Works across all major programming languages
- Same conceptual model (`#region`) everywhere
- Easy to add new languages
- File extension provides natural language detection

### Negative

- Must maintain language config mapping
- Some languages have multiple comment styles (CSS block vs line)
- Edge cases with languages that have no comments (binary files)
