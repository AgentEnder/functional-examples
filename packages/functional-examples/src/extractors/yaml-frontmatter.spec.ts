import { describe, it, expect } from 'vitest';
import { YamlFrontmatterExtractor } from './yaml-frontmatter.js';
import type { ExtractionContext } from './types.js';

describe('YamlFrontmatterExtractor', () => {
  const extractor = new YamlFrontmatterExtractor();

  describe('canExtract', () => {
    it('returns true for file with frontmatter', () => {
      const context: ExtractionContext = {
        path: '/test/example.ts',
        isDirectory: false,
        content: `// ---
// title: Test
// ---
console.log('hello');`,
      };
      expect(extractor.canExtract(context)).toBe(true);
    });

    it('returns false for file without frontmatter', () => {
      const context: ExtractionContext = {
        path: '/test/example.ts',
        isDirectory: false,
        content: `console.log('hello');`,
      };
      expect(extractor.canExtract(context)).toBe(false);
    });

    it('returns false for directories', () => {
      const context: ExtractionContext = {
        path: '/test/example',
        isDirectory: true,
        entries: ['meta.yml'],
      };
      expect(extractor.canExtract(context)).toBe(false);
    });

    it('returns false for empty content', () => {
      const context: ExtractionContext = {
        path: '/test/example.ts',
        isDirectory: false,
        content: '',
      };
      expect(extractor.canExtract(context)).toBe(false);
    });
  });

  describe('extract', () => {
    it('extracts metadata from frontmatter', async () => {
      const context: ExtractionContext = {
        path: '/test/example.ts',
        isDirectory: false,
        content: `// ---
// title: My Example
// description: A test example
// ---
console.log('hello');`,
      };

      const result = await extractor.extract(context);

      expect(result.metadata.id).toBe('example');
      expect(result.metadata.title).toBe('My Example');
      expect(result.metadata.description).toBe('A test example');
      expect(result.strippedContent).toBe("console.log('hello');");
    });

    it('generates id from filename if not provided', async () => {
      const context: ExtractionContext = {
        path: '/test/my-cool-example.ts',
        isDirectory: false,
        content: `// ---
// title: Cool Example
// ---
code();`,
      };

      const result = await extractor.extract(context);

      expect(result.metadata.id).toBe('my-cool-example');
    });

    it('uses provided id over generated one', async () => {
      const context: ExtractionContext = {
        path: '/test/example.ts',
        isDirectory: false,
        content: `// ---
// id: custom-id
// title: Example
// ---
code();`,
      };

      const result = await extractor.extract(context);

      expect(result.metadata.id).toBe('custom-id');
    });

    it('handles multiline description', async () => {
      const context: ExtractionContext = {
        path: '/test/example.ts',
        isDirectory: false,
        content: `// ---
// title: Example
// description: |
//   This is a multiline
//   description
// ---
code();`,
      };

      const result = await extractor.extract(context);

      expect(result.metadata.description).toContain('multiline');
    });

    it('preserves extra metadata fields', async () => {
      const context: ExtractionContext = {
        path: '/test/example.ts',
        isDirectory: false,
        content: `// ---
// title: Example
// customField: custom value
// tags:
//   - tag1
//   - tag2
// ---
code();`,
      };

      const result = await extractor.extract(context);

      // Extra fields are preserved in metadata
      expect((result.metadata as Record<string, unknown>).customField).toBe('custom value');
      expect((result.metadata as Record<string, unknown>).tags).toEqual(['tag1', 'tag2']);
    });

    it('creates file entry with stripped content', async () => {
      const context: ExtractionContext = {
        path: '/test/example.ts',
        isDirectory: false,
        content: `// ---
// title: Example
// ---
const x = 1;`,
      };

      const result = await extractor.extract(context);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('example.ts');
      expect(result.files[0].contents).toBe('const x = 1;');
    });
  });
});
