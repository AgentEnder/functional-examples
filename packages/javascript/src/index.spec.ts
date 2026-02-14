import { describe, it, expect } from 'vitest';
import {
  createJavaScriptPlugin,
  createJavaScriptParser,
  createFrontmatterParser,
  createJavaScriptExtractor,
  JAVASCRIPT_EXTENSIONS,
} from './index.js';
import type {
  FileContentsParser,
  FileParseContext,
} from '@functional-examples/devkit';

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

  /**
   * Simulate runParsePipeline: run parsers in order with hunk accumulation.
   * This mirrors what the core's runParsePipeline does.
   */
  async function runParsers(
    context: FileParseContext,
    parsers: FileContentsParser[]
  ): Promise<FileParseContext> {
    let result = context;
    for (const parser of parsers) {
      const accumulatedHunks = result.hunks ?? [];
      result = await parser.parse({ ...result, hunks: [] });
      result = {
        ...result,
        hunks: [...accumulatedHunks, ...(result.hunks ?? [])],
      };
    }
    return result;
  }

  function getParsers(
    options?: Parameters<typeof createJavaScriptPlugin>[0]
  ): FileContentsParser[] {
    const plugin = createJavaScriptPlugin(options);
    const parsers = plugin.fileContentsParsers;
    if (!parsers?.length) throw new Error('Expected fileContentsParsers');
    return parsers;
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
      expect(plugin.extensions).toContain('.json');
    });

    it('should include extractor by default', () => {
      const plugin = createJavaScriptPlugin();

      expect(plugin.extractor).toBeDefined();
      expect(plugin.extractor?.name).toBe('javascript-extractor');
    });

    it('should expose frontmatter and region parsers', () => {
      const plugin = createJavaScriptPlugin();

      expect(plugin.fileContentsParsers).toHaveLength(2);
      expect(plugin.fileContentsParsers?.[0].name).toBe(
        'javascript-frontmatter-parser'
      );
      expect(plugin.fileContentsParsers?.[1].name).toBe('javascript-parser');
    });
  });

  describe('parser pipeline behavior', () => {
    it('should run frontmatter parsing first, then region parsing', async () => {
      const parsers = getParsers();

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

      const result = await runParsers(makeContext(content), parsers);

      // Frontmatter should be extracted
      expect(result.metadata).toEqual({
        title: 'Example with Region',
        description: 'Tests parser order',
      });

      // Frontmatter should be stripped from parsed content
      expect(result.parsed).not.toContain('// ---');
      expect(result.parsed).not.toContain('title: Example');

      // Regions should be extracted after frontmatter is stripped
      expect(result.hunks).toHaveLength(2);
      expect(result.hunks[0].id).toBe('frontmatter');
      expect(result.hunks[1].id).toBe('main');
      expect(result.hunks[1].content).toBe('const inside = 2;');

      // Region markers should be stripped from final parsed content
      expect(result.parsed).not.toContain('#region');
      expect(result.parsed).not.toContain('#endregion');

      // Code should remain
      expect(result.parsed).toContain('const before = 1;');
      expect(result.parsed).toContain('const inside = 2;');
      expect(result.parsed).toContain('const after = 3;');
    });

    it('should handle content with only frontmatter', async () => {
      const parsers = getParsers();

      const content = `// ---
// title: Frontmatter Only
// ---
const x = 1;`;

      const result = await runParsers(makeContext(content), parsers);

      expect(result.metadata).toEqual({ title: 'Frontmatter Only' });
      expect(result.parsed).toBe('const x = 1;');
      expect(result.hunks).toHaveLength(1);
      expect(result.hunks[0].id).toBe('frontmatter');
      expect(result.hunks[0].content).toContain('title: Frontmatter Only');
    });

    it('should handle content with only regions', async () => {
      const parsers = getParsers();

      const content = `// #region example
const x = 1;
// #endregion example`;

      const result = await runParsers(makeContext(content), parsers);

      expect(result.metadata).toEqual({});
      expect(result.hunks).toHaveLength(1);
      expect(result.hunks[0].id).toBe('example');
      expect(result.parsed).toBe('const x = 1;');
    });

    it('should handle content with neither frontmatter nor regions', async () => {
      const parsers = getParsers();

      const content = `const x = 1;
const y = 2;`;

      const result = await runParsers(makeContext(content), parsers);

      expect(result.metadata).toEqual({});
      expect(result.hunks).toHaveLength(0);
      expect(result.parsed).toBe(content);
    });
  });

  describe('skipFrontmatter option', () => {
    it('should skip frontmatter parsing when skipFrontmatter is true', async () => {
      const parsers = getParsers({ skipFrontmatter: true });

      const content = `// ---
// title: Should Not Extract
// ---
const x = 1;`;

      const result = await runParsers(makeContext(content), parsers);

      // Frontmatter should NOT be extracted
      expect(result.metadata).toEqual({});

      // Frontmatter should remain in the parsed content
      expect(result.parsed).toContain('// ---');
      expect(result.parsed).toContain('title: Should Not Extract');
    });

    it('should still parse regions when skipFrontmatter is true', async () => {
      const parsers = getParsers({ skipFrontmatter: true });

      const content = `// #region example
const x = 1;
// #endregion example`;

      const result = await runParsers(makeContext(content), parsers);

      expect(result.hunks).toHaveLength(1);
      expect(result.hunks[0].id).toBe('example');
    });
  });

  describe('skipRegions option', () => {
    it('should skip region parsing when skipRegions is true', async () => {
      const parsers = getParsers({ skipRegions: true });

      const content = `// #region example
const x = 1;
// #endregion example`;

      const result = await runParsers(makeContext(content), parsers);

      // Regions should NOT be extracted
      expect(result.hunks).toHaveLength(0);

      // Region markers should remain in the parsed content
      expect(result.parsed).toContain('// #region example');
      expect(result.parsed).toContain('// #endregion example');
    });

    it('should still parse frontmatter when skipRegions is true', async () => {
      const parsers = getParsers({ skipRegions: true });

      const content = `// ---
// title: Should Extract
// ---
const x = 1;`;

      const result = await runParsers(makeContext(content), parsers);

      expect(result.metadata).toEqual({ title: 'Should Extract' });
      expect(result.parsed).toBe('const x = 1;');
      expect(result.hunks).toHaveLength(1);
      expect(result.hunks[0].id).toBe('frontmatter');
    });
  });

  describe('both options combined', () => {
    it('should skip both when both options are true', async () => {
      const plugin = createJavaScriptPlugin({
        skipFrontmatter: true,
        skipRegions: true,
      });

      const content = `// ---
// title: Should Not Extract
// ---
// #region example
const x = 1;
// #endregion example`;

      const result = await runParsers(
        makeContext(content),
        plugin.fileContentsParsers ?? []
      );

      // Neither should be extracted
      expect(result.metadata).toEqual({});
      expect(result.hunks).toHaveLength(0);

      // Content should be unchanged
      expect(result.parsed).toBe(content);
    });
  });

  describe('skipExtraction option', () => {
    it('should omit extractor when skipExtraction is true', () => {
      const plugin = createJavaScriptPlugin({ skipExtraction: true });

      expect(plugin.extractor).toBeUndefined();
    });

    it('should still include parsers when skipExtraction is true', () => {
      const plugin = createJavaScriptPlugin({ skipExtraction: true });

      expect(plugin.fileContentsParsers).toBeDefined();
      expect(plugin.fileContentsParsers?.length).toBeGreaterThan(0);
    });

    it('should include extractor when skipExtraction is false', () => {
      const plugin = createJavaScriptPlugin({ skipExtraction: false });

      expect(plugin.extractor).toBeDefined();
      expect(plugin.extractor?.name).toBe('javascript-extractor');
    });
  });

  describe('regionTag option', () => {
    it('should use custom region tags', async () => {
      const parsers = getParsers({
        regionTag: { start: '#_region', end: '#_endregion' },
      });

      const content = `// #_region setup
const db = connect();
// #_endregion setup
// #region visible
const x = 1;
// #endregion visible`;

      const result = await runParsers(makeContext(content), parsers);

      // Custom tags should be extracted
      expect(result.hunks).toHaveLength(1);
      expect(result.hunks[0].id).toBe('setup');

      // Default #region tags should remain visible in output
      expect(result.parsed).toContain('// #region visible');
      expect(result.parsed).toContain('// #endregion visible');
    });

    it('should combine custom region tags with frontmatter parsing', async () => {
      const parsers = getParsers({
        regionTag: { start: '#_region', end: '#_endregion' },
      });

      const content = `// ---
// title: Custom Tags
// ---
// #_region main
const x = 1;
// #_endregion main`;

      const result = await runParsers(makeContext(content), parsers);

      expect(result.metadata).toEqual({ title: 'Custom Tags' });
      expect(result.hunks).toHaveLength(2);
      expect(result.hunks[0].id).toBe('frontmatter');
      expect(result.hunks[1].id).toBe('main');
      expect(result.parsed).toBe('const x = 1;');
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
    // Universal fields (id, title, description) are now in the base schema;
    // the JS plugin contributes tags
    expect(schema.properties).toHaveProperty('tags');
    expect(schema.properties.tags.type).toBe('array');
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
