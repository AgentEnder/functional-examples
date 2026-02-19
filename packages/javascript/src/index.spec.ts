import { describe, it, expect } from 'vitest';
import {
  createJavaScriptPlugin,
  createJavaScriptExtractor,
  JAVASCRIPT_EXTENSIONS,
} from './index.js';

describe('createJavaScriptPlugin', () => {
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

    it('should not include fileContentsParsers', () => {
      const plugin = createJavaScriptPlugin();

      expect(plugin.fileContentsParsers).toBeUndefined();
    });
  });

  describe('skipExtraction option', () => {
    it('should omit extractor when skipExtraction is true', () => {
      const plugin = createJavaScriptPlugin({ skipExtraction: true });

      expect(plugin.extractor).toBeUndefined();
    });

    it('should include extractor when skipExtraction is false', () => {
      const plugin = createJavaScriptPlugin({ skipExtraction: false });

      expect(plugin.extractor).toBeDefined();
      expect(plugin.extractor?.name).toBe('javascript-extractor');
    });
  });
});

describe('existing exports', () => {
  it('should export JAVASCRIPT_EXTENSIONS', () => {
    expect(JAVASCRIPT_EXTENSIONS).toBeDefined();
    expect(Array.isArray(JAVASCRIPT_EXTENSIONS)).toBe(true);
    expect(JAVASCRIPT_EXTENSIONS.length).toBeGreaterThan(0);
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
    expect(schema.properties).toHaveProperty('skipExtraction');
  });

  it('should have valid metadata schema structure', () => {
    const plugin = createJavaScriptPlugin();
    const metadataSchema = plugin.schemas?.metadata;
    expect(metadataSchema).toBeDefined();
    if (!metadataSchema) return;

    const schema = JSON.parse(metadataSchema);
    expect(schema.type).toBe('object');
    expect(schema.properties).toHaveProperty('tags');
    expect(schema.properties.tags.type).toBe('array');
  });
});

describe('validators', () => {
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
    const options = { skipExtraction: false };
    const plugin = createJavaScriptPlugin(options);
    expect(plugin._options).toEqual(options);
  });

  it('should track undefined options', () => {
    const plugin = createJavaScriptPlugin();
    expect(plugin._options).toBeUndefined();
  });
});
