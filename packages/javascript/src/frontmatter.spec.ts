import { describe, it, expect } from 'vitest';
import { createFrontmatterParser } from './frontmatter.js';
import type { FileParseContext } from 'functional-examples';

describe('createFrontmatterParser', () => {
  const parser = createFrontmatterParser();

  function makeContext(
    content: string,
    filePath = '/test.ts'
  ): FileParseContext {
    return {
      raw: content,
      parsed: content,
      hunks: [],
      metadata: {},
      filePath,
    };
  }

  function parse(content: string): FileParseContext {
    return parser.parse(makeContext(content)) as FileParseContext;
  }

  describe('line comment frontmatter', () => {
    it('should extract metadata from line comment frontmatter', () => {
      const content = `// ---
// title: My Example
// description: A demo
// ---
const x = 1;`;

      const result = parse(content);

      expect(result.metadata).toEqual({
        title: 'My Example',
        description: 'A demo',
      });
    });

    it('should handle nested YAML in line comments', () => {
      const content = `// ---
// title: Example
// tags:
//   - demo
//   - tutorial
// ---
const x = 1;`;

      const result = parse(content);

      expect(result.metadata).toEqual({
        title: 'Example',
        tags: ['demo', 'tutorial'],
      });
    });

    it('should strip frontmatter from parsed content', () => {
      const content = `// ---
// title: My Example
// ---
const x = 1;
const y = 2;`;

      const result = parse(content);

      expect(result.parsed).toBe(`const x = 1;
const y = 2;`);
    });
  });

  describe('block comment frontmatter', () => {
    it('should extract metadata from block comment frontmatter', () => {
      const content = `/* ---
title: My Example
description: A demo
--- */
const x = 1;`;

      const result = parse(content);

      expect(result.metadata).toEqual({
        title: 'My Example',
        description: 'A demo',
      });
    });

    it('should handle nested YAML in block comments', () => {
      const content = `/* ---
title: Example
config:
  debug: true
  level: 3
--- */
const x = 1;`;

      const result = parse(content);

      expect(result.metadata).toEqual({
        title: 'Example',
        config: {
          debug: true,
          level: 3,
        },
      });
    });

    it('should strip block comment frontmatter from parsed content', () => {
      const content = `/* ---
title: My Example
--- */
const x = 1;
const y = 2;`;

      const result = parse(content);

      expect(result.parsed).toBe(`const x = 1;
const y = 2;`);
    });
  });

  describe('no frontmatter passthrough', () => {
    it('should return context unchanged when no frontmatter present', () => {
      const content = `const x = 1;
const y = 2;`;

      const result = parse(content);

      expect(result.metadata).toEqual({});
      expect(result.parsed).toBe(content);
    });

    it('should preserve existing metadata when no frontmatter present', () => {
      const context: FileParseContext = {
        raw: 'const x = 1;',
        parsed: 'const x = 1;',
        hunks: [],
        metadata: { existing: 'value' },
        filePath: '/test.ts',
      };

      const result = parser.parse(context) as FileParseContext;

      expect(result.metadata).toEqual({ existing: 'value' });
    });
  });

  describe('top-of-file detection only', () => {
    it('should ignore line comment frontmatter mid-file', () => {
      const content = `const x = 1;
// ---
// title: Ignored
// ---
const y = 2;`;

      const result = parse(content);

      expect(result.metadata).toEqual({});
      expect(result.parsed).toBe(content);
    });

    it('should ignore block comment frontmatter mid-file', () => {
      const content = `const x = 1;
/* ---
title: Ignored
--- */
const y = 2;`;

      const result = parse(content);

      expect(result.metadata).toEqual({});
      expect(result.parsed).toBe(content);
    });

    it('should detect frontmatter with leading whitespace on first line', () => {
      const content = `  // ---
  // title: Indented Example
  // ---
const x = 1;`;

      const result = parse(content);

      expect(result.metadata).toEqual({
        title: 'Indented Example',
      });
    });
  });

  describe('metadata merging', () => {
    it('should merge frontmatter with existing metadata', () => {
      const context: FileParseContext = {
        raw: `// ---
// title: From Frontmatter
// ---
const x = 1;`,
        parsed: `// ---
// title: From Frontmatter
// ---
const x = 1;`,
        hunks: [],
        metadata: { existing: 'value', title: 'Old Title' },
        filePath: '/test.ts',
      };

      const result = parser.parse(context) as FileParseContext;

      // Frontmatter should override existing
      expect(result.metadata).toEqual({
        existing: 'value',
        title: 'From Frontmatter',
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty frontmatter', () => {
      const content = `// ---
// ---
const x = 1;`;

      const result = parse(content);

      expect(result.metadata).toEqual({});
      expect(result.parsed).toBe('const x = 1;');
    });

    it('should handle frontmatter with only whitespace content', () => {
      const content = `/* ---
--- */
const x = 1;`;

      const result = parse(content);

      expect(result.metadata).toEqual({});
      expect(result.parsed).toBe('const x = 1;');
    });

    it('should preserve original raw content', () => {
      const content = `// ---
// title: Example
// ---
const x = 1;`;

      const result = parse(content);

      expect(result.raw).toBe(content);
    });
  });
});
