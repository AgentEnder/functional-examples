# ADR 001: Pluggable Metadata Extractors

## Status

Accepted

## Context

Different projects use different conventions for example metadata:

1. **cli-forge/flexibench**: YAML frontmatter in comments at file start
   ```typescript
   // ---
   // title: Example Title
   // ---
   ```

2. **isolated-workers**: Separate `meta.yml` file in example directory
   ```
   examples/
     basic-ping/
       meta.yml
       host.ts
       worker.ts
   ```

3. **Potential future**: TOML, JSON, or custom formats

We need to support multiple patterns without coupling the scanner to any specific format.

## Decision

Implement a pluggable extractor system:

```typescript
interface MetadataExtractor {
  readonly name: string;
  canExtract(context: ExtractionContext): boolean;
  extract<T>(context: ExtractionContext): Promise<ExtractedMetadata<T>>;
}
```

- `ExtractorRegistry` holds registered extractors
- `createDefaultRegistry()` includes YAML frontmatter and meta.yml extractors
- Scanner receives registry via options or uses default
- Extractors are tried in registration order

## Consequences

### Positive

- Projects can use their preferred metadata format
- Easy to add new extractors without modifying core
- Default extractors cover 90%+ of use cases
- Clear extension point for custom formats

### Negative

- Slightly more complex API than hardcoded formats
- Users must understand registry concept for custom extractors
- Order-dependent extraction (first match wins)
