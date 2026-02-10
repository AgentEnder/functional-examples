import { describe, it, expect } from 'vitest';
import {
  createJavaScriptPlugin,
  createJavaScriptParser,
  createFrontmatterParser,
  createJavaScriptExtractor,
  JAVASCRIPT_EXTENSIONS,
} from './index.js';
import type { FileParseContext } from '@functional-examples/devkit';

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
    it('should run frontmatter parsing first, then region parsing', async () => {
      const plugin = createJavaScriptPlugin();
      const parser = plugin.fileContentsParser;
      if (!parser) throw new Error('Expected fileContentsParser');

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

      const result = (await parser.parse(makeContext(content))) as FileParseContext;

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

    it('should handle content with only frontmatter', async () => {
      const plugin = createJavaScriptPlugin();
      const parser = plugin.fileContentsParser;
      if (!parser) throw new Error('Expected fileContentsParser');

      const content = `// ---
// title: Frontmatter Only
// ---
const x = 1;`;

      const result = (await parser.parse(makeContext(content))) as FileParseContext;

      expect(result.metadata).toEqual({ title: 'Frontmatter Only' });
      expect(result.parsed).toBe('const x = 1;');
      expect(result.hunks).toHaveLength(0);
    });

    it('should handle content with only regions', async () => {
      const plugin = createJavaScriptPlugin();
      const parser = plugin.fileContentsParser;
      if (!parser) throw new Error('Expected fileContentsParser');

      const content = `// #region example
const x = 1;
// #endregion example`;

      const result = (await parser.parse(makeContext(content))) as FileParseContext;

      expect(result.metadata).toEqual({});
      expect(result.hunks).toHaveLength(1);
      expect(result.hunks[0].id).toBe('example');
      expect(result.parsed).toBe('const x = 1;');
    });

    it('should handle content with neither frontmatter nor regions', async () => {
      const plugin = createJavaScriptPlugin();
      const parser = plugin.fileContentsParser;
      if (!parser) throw new Error('Expected fileContentsParser');

      const content = `const x = 1;
const y = 2;`;

      const result = (await parser.parse(makeContext(content))) as FileParseContext;

      expect(result.metadata).toEqual({});
      expect(result.hunks).toHaveLength(0);
      expect(result.parsed).toBe(content);
    });
  });

  describe('skipFrontmatter option', () => {
    it('should skip frontmatter parsing when skipFrontmatter is true', async () => {
      const plugin = createJavaScriptPlugin({ skipFrontmatter: true });
      const parser = plugin.fileContentsParser;
      if (!parser) throw new Error('Expected fileContentsParser');

      const content = `// ---
// title: Should Not Extract
// ---
const x = 1;`;

      const result = (await parser.parse(makeContext(content))) as FileParseContext;

      // Frontmatter should NOT be extracted
      expect(result.metadata).toEqual({});

      // Frontmatter should remain in the parsed content
      expect(result.parsed).toContain('// ---');
      expect(result.parsed).toContain('title: Should Not Extract');
    });

    it('should still parse regions when skipFrontmatter is true', async () => {
      const plugin = createJavaScriptPlugin({ skipFrontmatter: true });
      const parser = plugin.fileContentsParser;
      if (!parser) throw new Error('Expected fileContentsParser');

      const content = `// #region example
const x = 1;
// #endregion example`;

      const result = (await parser.parse(makeContext(content))) as FileParseContext;

      expect(result.hunks).toHaveLength(1);
      expect(result.hunks[0].id).toBe('example');
    });
  });

  describe('skipRegions option', () => {
    it('should skip region parsing when skipRegions is true', async () => {
      const plugin = createJavaScriptPlugin({ skipRegions: true });
      const parser = plugin.fileContentsParser;
      if (!parser) throw new Error('Expected fileContentsParser');

      const content = `// #region example
const x = 1;
// #endregion example`;

      const result = (await parser.parse(makeContext(content))) as FileParseContext;

      // Regions should NOT be extracted
      expect(result.hunks).toHaveLength(0);

      // Region markers should remain in the parsed content
      expect(result.parsed).toContain('// #region example');
      expect(result.parsed).toContain('// #endregion example');
    });

    it('should still parse frontmatter when skipRegions is true', async () => {
      const plugin = createJavaScriptPlugin({ skipRegions: true });
      const parser = plugin.fileContentsParser;
      if (!parser) throw new Error('Expected fileContentsParser');

      const content = `// ---
// title: Should Extract
// ---
const x = 1;`;

      const result = (await parser.parse(makeContext(content))) as FileParseContext;

      expect(result.metadata).toEqual({ title: 'Should Extract' });
      expect(result.parsed).toBe('const x = 1;');
    });
  });

  describe('both options combined', () => {
    it('should skip both when both options are true', async () => {
      const plugin = createJavaScriptPlugin({
        skipFrontmatter: true,
        skipRegions: true,
      });
      const parser = plugin.fileContentsParser;
      if (!parser) throw new Error('Expected fileContentsParser');

      const content = `// ---
// title: Should Not Extract
// ---
// #region example
const x = 1;
// #endregion example`;

      const result = (await parser.parse(makeContext(content))) as FileParseContext;

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

describe('schemas', () => {
  it('should include options schema', () => {
    const plugin = createJavaScriptPlugin();
    const optionsSchema = plugin.schemas?.options;
    expect(optionsSchema).toBeDefined();
    if (optionsSchema) {
      expect(() => JSON.parse(optionsSchema)).not.toThrow();
    }
  });

  it('should include metadata schema', () => {
    const plugin = createJavaScriptPlugin();
    const metadataSchema = plugin.schemas?.metadata;
    expect(metadataSchema).toBeDefined();
    if (metadataSchema) {
      expect(() => JSON.parse(metadataSchema)).not.toThrow();
    }
  });

  it('should have valid options schema structure', () => {
    const plugin = createJavaScriptPlugin();
    const optionsSchema = plugin.schemas?.options;
    expect(optionsSchema).toBeDefined();
    if (!optionsSchema) return;

    const schema = JSON.parse(optionsSchema);
    expect(schema.type).toBe('object');
    expect(schema.properties).toHaveProperty('skipFrontmatter');
    expect(schema.properties).toHaveProperty('skipRegions');
  });

  it('should have valid metadata schema structure', () => {
    const plugin = createJavaScriptPlugin();
    const metadataSchema = plugin.schemas?.metadata;
    expect(metadataSchema).toBeDefined();
    if (!metadataSchema) return;

    const schema = JSON.parse(metadataSchema);
    expect(schema.type).toBe('object');
    expect(schema.properties).toHaveProperty('id');
    expect(schema.properties).toHaveProperty('title');
    expect(schema.required).toContain('id');
    expect(schema.required).toContain('title');
  });
});

describe('validators', () => {
  // Note: id and title are validated by the extractor (required fields in
  // frontmatter or package.json). The metadata validator only validates
  // optional fields like tags.

  it('should accept metadata with valid tags', () => {
    const plugin = createJavaScriptPlugin();
    const validate = plugin.validators?.metadata;
    expect(validate).toBeDefined();
    if (!validate) return;

    const result = validate({ tags: ['foo', 'bar'] });
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept metadata without tags', () => {
    const plugin = createJavaScriptPlugin();
    const validate = plugin.validators?.metadata;
    expect(validate).toBeDefined();
    if (!validate) return;

    const result = validate({});
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject non-array tags', () => {
    const plugin = createJavaScriptPlugin();
    const validate = plugin.validators?.metadata;
    expect(validate).toBeDefined();
    if (!validate) return;

    const result = validate({ tags: 'not-an-array' });
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.path === 'tags')).toBe(true);
  });

  it('should reject tags with non-string elements', () => {
    const plugin = createJavaScriptPlugin();
    const validate = plugin.validators?.metadata;
    expect(validate).toBeDefined();
    if (!validate) return;

    const result = validate({ tags: ['valid', 123, 'also-valid'] });
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.path === 'tags')).toBe(true);
  });
});

describe('_options tracking', () => {
  it('should track options for validation introspection', () => {
    const options = { skipFrontmatter: true, skipRegions: false };
    const plugin = createJavaScriptPlugin(options);
    expect(plugin._options).toEqual(options);
  });

  it('should track undefined options', () => {
    const plugin = createJavaScriptPlugin();
    expect(plugin._options).toBeUndefined();
  });
});
