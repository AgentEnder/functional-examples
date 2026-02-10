import { describe, it, expect } from 'vitest';
import { createJavaScriptParser } from './parser.js';
import type { FileParseContext } from '@functional-examples/devkit';

describe('createJavaScriptParser', () => {
  const parser = createJavaScriptParser();

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

  // Helper to call parse and get synchronous result (our parser is always sync)
  function parse(content: string): FileParseContext {
    return parser.parse(makeContext(content)) as FileParseContext;
  }

  describe('region parsing', () => {
    it('should extract regions from line comments', () => {
      const content = `// some code
// #region setup
const db = connect();
// #endregion setup
// more code`;

      const result = parse(content);

      expect(result.hunks).toHaveLength(1);
      expect(result.hunks[0]).toEqual({
        id: 'setup',
        content: 'const db = connect();',
        startLine: 2,
        endLine: 4,
      });
    });

    it('should extract regions from block comments', () => {
      const content = `/* #region main */
console.log('hello');
/* #endregion main */`;

      const result = parse(content);

      expect(result.hunks).toHaveLength(1);
      expect(result.hunks[0].id).toBe('main');
      expect(result.hunks[0].content).toBe("console.log('hello');");
    });

    it('should handle multiple regions', () => {
      const content = `// #region a
const a = 1;
// #endregion a
// #region b
const b = 2;
// #endregion b`;

      const result = parse(content);

      expect(result.hunks).toHaveLength(2);
      expect(result.hunks[0].id).toBe('a');
      expect(result.hunks[1].id).toBe('b');
    });

    it('should strip region markers from parsed content', () => {
      const content = `const before = 0;
// #region main
const inside = 1;
// #endregion main
const after = 2;`;

      const result = parse(content);

      expect(result.parsed).toBe(`const before = 0;
const inside = 1;
const after = 2;`);
    });

    it('should handle nested regions', () => {
      const content = `// #region outer
const outer = 1;
// #region inner
const inner = 2;
// #endregion inner
const outerEnd = 3;
// #endregion outer`;

      const result = parse(content);

      expect(result.hunks).toHaveLength(2);

      // Inner region closes first
      const innerRegion = result.hunks.find((h) => h.id === 'inner');
      expect(innerRegion).toBeDefined();
      expect(innerRegion?.content).toBe('const inner = 2;');
      expect(innerRegion?.startLine).toBe(3);
      expect(innerRegion?.endLine).toBe(5);

      // Outer region contains inner content
      const outerRegion = result.hunks.find((h) => h.id === 'outer');
      expect(outerRegion).toBeDefined();
      expect(outerRegion?.content).toBe(`const outer = 1;
const inner = 2;
const outerEnd = 3;`);
      expect(outerRegion?.startLine).toBe(1);
      expect(outerRegion?.endLine).toBe(7);
    });

    it('should handle endregion without name', () => {
      const content = `// #region example
const x = 1;
// #endregion`;

      const result = parse(content);

      expect(result.hunks).toHaveLength(1);
      expect(result.hunks[0].id).toBe('example');
      expect(result.hunks[0].content).toBe('const x = 1;');
    });
  });
});
