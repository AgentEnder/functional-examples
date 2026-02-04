import { describe, it, expect } from 'vitest';
import {
  createJavaScriptPlugin,
  createJavaScriptParser,
  createFrontmatterParser,
  createJavaScriptExtractor,
  JAVASCRIPT_EXTENSIONS,
} from './index.js';
import type { FileParseContext } from 'functional-examples';

describe('createJavaScriptPlugin', () => {
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

  describe('plugin structure', () => {
    it('should have correct name', () => {
      const plugin = createJavaScriptPlugin();

      expect(plugin.name).toBe('javascript');
    });

    it('should register for all JS/TS extensions', () => {
      const plugin = createJavaScriptPlugin();

      expect(plugin.extensions).toEqual([...JAVASCRIPT_EXTENSIONS]);
      expect(plugin.extensions).toContain('.js');
      expect(plugin.extensions).toContain('.jsx');
      expect(plugin.extensions).toContain('.ts');
      expect(plugin.extensions).toContain('.tsx');
      expect(plugin.extensions).toContain('.mjs');
      expect(plugin.extensions).toContain('.cjs');
      expect(plugin.extensions).toContain('.mts');
      expect(plugin.extensions).toContain('.cts');
    });

    it('should include extractor', () => {
      const plugin = createJavaScriptPlugin();

      expect(plugin.extractor).toBeDefined();
      expect(plugin.extractor?.name).toBe('javascript-extractor');
    });

    it('should include file contents parser', () => {
      const plugin = createJavaScriptPlugin();

      expect(plugin.fileContentsParser).toBeDefined();
      expect(plugin.fileContentsParser?.name).toBe('javascript-combined-parser');
    });
  });

  describe('combined parser behavior', () => {
    it('should run frontmatter parsing first, then region parsing', () => {
      const plugin = createJavaScriptPlugin();
      const parser = plugin.fileContentsParser!;

      // Content with frontmatter that contains a region marker inside
      // If region ran first, it would incorrectly process the frontmatter content
      const content = `// ---
// title: Example with Region
// description: Tests parser order
// ---
const before = 1;
// #region main
const inside = 2;
// #endregion main
const after = 3;`;

      const result = parser.parse(makeContext(content)) as FileParseContext;

      // Frontmatter should be extracted
      expect(result.metadata).toEqual({
        title: 'Example with Region',
        description: 'Tests parser order',
      });

      // Frontmatter should be stripped from parsed content
      expect(result.parsed).not.toContain('// ---');
      expect(result.parsed).not.toContain('title: Example');

      // Regions should be extracted after frontmatter is stripped
      expect(result.hunks).toHaveLength(1);
      expect(result.hunks[0].id).toBe('main');
      expect(result.hunks[0].content).toBe('const inside = 2;');

      // Region markers should be stripped from final parsed content
      expect(result.parsed).not.toContain('#region');
      expect(result.parsed).not.toContain('#endregion');

      // Code should remain
      expect(result.parsed).toContain('const before = 1;');
      expect(result.parsed).toContain('const inside = 2;');
      expect(result.parsed).toContain('const after = 3;');
    });

    it('should handle content with only frontmatter', () => {
      const plugin = createJavaScriptPlugin();
      const parser = plugin.fileContentsParser!;

      const content = `// ---
// title: Frontmatter Only
// ---
const x = 1;`;

      const result = parser.parse(makeContext(content)) as FileParseContext;

      expect(result.metadata).toEqual({ title: 'Frontmatter Only' });
      expect(result.parsed).toBe('const x = 1;');
      expect(result.hunks).toHaveLength(0);
    });

    it('should handle content with only regions', () => {
      const plugin = createJavaScriptPlugin();
      const parser = plugin.fileContentsParser!;

      const content = `// #region example
const x = 1;
// #endregion example`;

      const result = parser.parse(makeContext(content)) as FileParseContext;

      expect(result.metadata).toEqual({});
      expect(result.hunks).toHaveLength(1);
      expect(result.hunks[0].id).toBe('example');
      expect(result.parsed).toBe('const x = 1;');
    });

    it('should handle content with neither frontmatter nor regions', () => {
      const plugin = createJavaScriptPlugin();
      const parser = plugin.fileContentsParser!;

      const content = `const x = 1;
const y = 2;`;

      const result = parser.parse(makeContext(content)) as FileParseContext;

      expect(result.metadata).toEqual({});
      expect(result.hunks).toHaveLength(0);
      expect(result.parsed).toBe(content);
    });
  });

  describe('skipFrontmatter option', () => {
    it('should skip frontmatter parsing when skipFrontmatter is true', () => {
      const plugin = createJavaScriptPlugin({ skipFrontmatter: true });
      const parser = plugin.fileContentsParser!;

      const content = `// ---
// title: Should Not Extract
// ---
const x = 1;`;

      const result = parser.parse(makeContext(content)) as FileParseContext;

      // Frontmatter should NOT be extracted
      expect(result.metadata).toEqual({});

      // Frontmatter should remain in the parsed content
      expect(result.parsed).toContain('// ---');
      expect(result.parsed).toContain('title: Should Not Extract');
    });

    it('should still parse regions when skipFrontmatter is true', () => {
      const plugin = createJavaScriptPlugin({ skipFrontmatter: true });
      const parser = plugin.fileContentsParser!;

      const content = `// #region example
const x = 1;
// #endregion example`;

      const result = parser.parse(makeContext(content)) as FileParseContext;

      expect(result.hunks).toHaveLength(1);
      expect(result.hunks[0].id).toBe('example');
    });
  });

  describe('skipRegions option', () => {
    it('should skip region parsing when skipRegions is true', () => {
      const plugin = createJavaScriptPlugin({ skipRegions: true });
      const parser = plugin.fileContentsParser!;

      const content = `// #region example
const x = 1;
// #endregion example`;

      const result = parser.parse(makeContext(content)) as FileParseContext;

      // Regions should NOT be extracted
      expect(result.hunks).toHaveLength(0);

      // Region markers should remain in the parsed content
      expect(result.parsed).toContain('// #region example');
      expect(result.parsed).toContain('// #endregion example');
    });

    it('should still parse frontmatter when skipRegions is true', () => {
      const plugin = createJavaScriptPlugin({ skipRegions: true });
      const parser = plugin.fileContentsParser!;

      const content = `// ---
// title: Should Extract
// ---
const x = 1;`;

      const result = parser.parse(makeContext(content)) as FileParseContext;

      expect(result.metadata).toEqual({ title: 'Should Extract' });
      expect(result.parsed).toBe('const x = 1;');
    });
  });

  describe('both options combined', () => {
    it('should skip both when both options are true', () => {
      const plugin = createJavaScriptPlugin({
        skipFrontmatter: true,
        skipRegions: true,
      });
      const parser = plugin.fileContentsParser!;

      const content = `// ---
// title: Should Not Extract
// ---
// #region example
const x = 1;
// #endregion example`;

      const result = parser.parse(makeContext(content)) as FileParseContext;

      // Neither should be extracted
      expect(result.metadata).toEqual({});
      expect(result.hunks).toHaveLength(0);

      // Content should be unchanged
      expect(result.parsed).toBe(content);
    });
  });
});

describe('existing exports', () => {
  it('should export JAVASCRIPT_EXTENSIONS', () => {
    expect(JAVASCRIPT_EXTENSIONS).toBeDefined();
    expect(Array.isArray(JAVASCRIPT_EXTENSIONS)).toBe(true);
    expect(JAVASCRIPT_EXTENSIONS.length).toBeGreaterThan(0);
  });

  it('should export createJavaScriptParser', () => {
    expect(createJavaScriptParser).toBeDefined();
    expect(typeof createJavaScriptParser).toBe('function');
  });

  it('should export createFrontmatterParser', () => {
    expect(createFrontmatterParser).toBeDefined();
    expect(typeof createFrontmatterParser).toBe('function');
  });

  it('should export createJavaScriptExtractor', () => {
    expect(createJavaScriptExtractor).toBeDefined();
    expect(typeof createJavaScriptExtractor).toBe('function');
  });
});
