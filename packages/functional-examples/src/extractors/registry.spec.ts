import { describe, it, expect } from 'vitest';
import { ExtractorRegistry, createDefaultRegistry } from './registry.js';
import type { MetadataExtractor, ExtractionContext } from './types.js';

/**
 * Helper to create a mock extractor for testing
 */
function createMockExtractor(
  name: string,
  canExtract: boolean,
  metadata: { id: string; title: string }
): MetadataExtractor {
  return {
    name,
    canExtract: () => canExtract,
    extract: async () => ({
      metadata,
      files: [],
    }),
  };
}

describe('ExtractorRegistry', () => {
  describe('register', () => {
    it('allows chaining registrations', () => {
      const registry = new ExtractorRegistry();
      const extractor1 = createMockExtractor('test1', false, { id: '1', title: '1' });
      const extractor2 = createMockExtractor('test2', false, { id: '2', title: '2' });

      const result = registry.register(extractor1).register(extractor2);

      expect(result).toBe(registry);
      expect(registry.getExtractors()).toHaveLength(2);
    });
  });

  describe('findExtractor', () => {
    it('returns first matching extractor', () => {
      const registry = new ExtractorRegistry();
      const extractor1 = createMockExtractor('never-matches', false, { id: '1', title: '1' });
      const extractor2 = createMockExtractor('always-matches', true, { id: '2', title: '2' });

      registry.register(extractor1).register(extractor2);

      const context: ExtractionContext = { path: '/test', isDirectory: false };
      const found = registry.findExtractor(context);

      expect(found?.name).toBe('always-matches');
    });

    it('returns undefined when no extractor matches', () => {
      const registry = new ExtractorRegistry();
      const extractor = createMockExtractor('never-matches', false, { id: '1', title: '1' });

      registry.register(extractor);

      const context: ExtractionContext = { path: '/test', isDirectory: false };
      const found = registry.findExtractor(context);

      expect(found).toBeUndefined();
    });
  });

  describe('extract', () => {
    it('uses first matching extractor', async () => {
      const registry = new ExtractorRegistry();
      const extractor: MetadataExtractor = {
        name: 'test',
        canExtract: () => true,
        extract: async () => ({
          metadata: { id: 'test-id', title: 'Test Title' },
          files: [{ path: 'test.ts', contents: 'code' }],
        }),
      };

      registry.register(extractor);

      const context: ExtractionContext = { path: '/test', isDirectory: false };
      const result = await registry.extract(context);

      expect(result.metadata.id).toBe('test-id');
      expect(result.metadata.title).toBe('Test Title');
    });

    it('throws when no extractor matches', async () => {
      const registry = new ExtractorRegistry();

      const context: ExtractionContext = { path: '/test', isDirectory: false };

      await expect(registry.extract(context)).rejects.toThrow(
        'No extractor found for file: /test'
      );
    });

    it('throws with directory message for directories', async () => {
      const registry = new ExtractorRegistry();

      const context: ExtractionContext = { path: '/test', isDirectory: true };

      await expect(registry.extract(context)).rejects.toThrow(
        'No extractor found for directory: /test'
      );
    });
  });
});

describe('createDefaultRegistry', () => {
  it('includes MetaYmlExtractor', () => {
    const registry = createDefaultRegistry();
    const extractors = registry.getExtractors();

    expect(extractors.some((e) => e.name === 'meta-yml')).toBe(true);
  });

  it('includes YamlFrontmatterExtractor', () => {
    const registry = createDefaultRegistry();
    const extractors = registry.getExtractors();

    expect(extractors.some((e) => e.name === 'yaml-frontmatter')).toBe(true);
  });

  it('prioritizes MetaYmlExtractor over YamlFrontmatterExtractor', () => {
    const registry = createDefaultRegistry();
    const extractors = registry.getExtractors();
    const names = extractors.map((e) => e.name);

    expect(names.indexOf('meta-yml')).toBeLessThan(names.indexOf('yaml-frontmatter'));
  });
});
