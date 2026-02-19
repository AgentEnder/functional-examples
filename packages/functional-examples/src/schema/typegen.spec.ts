import { describe, it, expect } from 'vitest';
import { generateTypes } from './typegen.js';

describe('generateTypes', () => {
  describe('ExampleMetadataRegistry', () => {
    it('should generate interface from merged schema', () => {
      const mergedSchema = {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          category: { type: 'string', enum: ['tutorial', 'recipe'] },
        },
        required: ['id', 'title'],
      };

      const result = generateTypes({ mergedSchema });

      expect(result).toContain('interface ExampleMetadataRegistry');
      expect(result).toContain('id: string');
      expect(result).toContain('title: string');
      expect(result).toContain('category?: "tutorial" | "recipe"');
    });

    it('should mark required fields without optional modifier', () => {
      const mergedSchema = {
        type: 'object',
        properties: {
          required: { type: 'string' },
          optional: { type: 'string' },
        },
        required: ['required'],
      };

      const result = generateTypes({ mergedSchema });

      expect(result).toContain('required: string');
      expect(result).toContain('optional?: string');
    });

    it('should generate valid TypeScript for various types', () => {
      const mergedSchema = {
        type: 'object',
        properties: {
          str: { type: 'string' },
          num: { type: 'number' },
          bool: { type: 'boolean' },
          arr: { type: 'array', items: { type: 'string' } },
          constVal: { const: 'fixed' },
        },
      };

      const result = generateTypes({ mergedSchema });

      expect(result).toContain('str?: string');
      expect(result).toContain('num?: number');
      expect(result).toContain('bool?: boolean');
      expect(result).toContain('arr?: Array<string>');
      expect(result).toContain('constVal?: "fixed"');
    });

    it('should return Record<string, unknown> when no schema provided', () => {
      const result = generateTypes({});

      expect(result).toContain('interface ExampleMetadataRegistry');
      expect(result).toContain('metadata: Record<string, unknown>');
    });

    it('should handle empty properties object', () => {
      const result = generateTypes({
        mergedSchema: { type: 'object', properties: {} },
      });

      expect(result).toContain('interface ExampleMetadataRegistry');
      expect(result).toContain('metadata: Record<string, unknown>');
    });

    it('should include auto-generated header', () => {
      const result = generateTypes({
        mergedSchema: { type: 'object', properties: { id: { type: 'string' } } },
      });

      expect(result).toContain('Auto-generated metadata types');
      expect(result).toContain('Do not edit manually');
    });

    it('should handle integer type as number', () => {
      const result = generateTypes({
        mergedSchema: {
          type: 'object',
          properties: { count: { type: 'integer' } },
        },
      });

      expect(result).toContain('count?: number');
    });

    it('should handle null type', () => {
      const result = generateTypes({
        mergedSchema: {
          type: 'object',
          properties: { empty: { type: 'null' } },
        },
      });

      expect(result).toContain('empty?: null');
    });

    it('should handle array without items as unknown[]', () => {
      const result = generateTypes({
        mergedSchema: {
          type: 'object',
          properties: { items: { type: 'array' } },
        },
      });

      expect(result).toContain('items?: unknown[]');
    });

    it('should handle nested objects', () => {
      const result = generateTypes({
        mergedSchema: {
          type: 'object',
          properties: {
            nested: {
              type: 'object',
              properties: { inner: { type: 'string' } },
              required: ['inner'],
            },
          },
        },
      });

      expect(result).toContain('nested?:');
      expect(result).toContain('inner: string');
    });
  });

  describe('PluginOptionsRegistry', () => {
    it('should omit PluginOptionsRegistry when no entries have packageName', () => {
      const result = generateTypes({
        pluginSchemas: [{ pluginName: 'yaml', options: '{"type":"object"}' }],
      });
      expect(result).not.toContain('PluginOptionsRegistry');
    });

    it('should use export {} instead of PluginReference import when no plugins have packageName', () => {
      const result = generateTypes({});
      expect(result).toContain('export {}');
      expect(result).not.toContain('import type { PluginReference }');
    });

    it('should import PluginReference when plugins have packageName', () => {
      const result = generateTypes({
        pluginSchemas: [{ pluginName: 'yaml', packageName: '@acme/yaml-plugin' }],
      });
      expect(result).toContain('import type { PluginReference }');
      expect(result).not.toContain('export {}');
    });

    it('should include PluginOptionsRegistry when plugins have packageName', () => {
      const result = generateTypes({
        pluginSchemas: [{ pluginName: 'yaml', packageName: '@acme/yaml-plugin' }],
      });
      expect(result).toContain('"@acme/yaml-plugin"');
      expect(result).toContain('interface PluginOptionsRegistry');
      expect(result).toContain('PluginReference');
    });

    it('should generate tuple ref for plugin with options schema', () => {
      const result = generateTypes({
        pluginSchemas: [
          {
            pluginName: 'js',
            packageName: '@acme/js-plugin',
            options: JSON.stringify({
              type: 'object',
              properties: { regionTag: { type: 'string' } },
            }),
          },
        ],
      });
      expect(result).toContain('"@acme/js-plugin"');
      expect(result).toContain('["@acme/js-plugin", { regionTag?: string }]');
      expect(result).toContain('PluginReference');
    });

    it('should skip tuple form for plugin with empty options schema', () => {
      const result = generateTypes({
        pluginSchemas: [
          {
            pluginName: 'js',
            packageName: '@acme/js-plugin',
            options: JSON.stringify({ type: 'object', properties: {} }),
          },
        ],
      });
      expect(result).toContain('"@acme/js-plugin"');
      expect(result).not.toContain('["@acme/js-plugin"');
    });

    it('should include all plugins with packageName and skip those without', () => {
      const result = generateTypes({
        pluginSchemas: [
          { pluginName: 'yaml', packageName: '@acme/yaml' },
          { pluginName: 'js', packageName: '@acme/js' },
          { pluginName: 'no-pkg' },
        ],
      });
      expect(result).toContain('"@acme/yaml"');
      expect(result).toContain('"@acme/js"');
      expect(result).not.toContain('"no-pkg"');
    });
  });

  describe('combined output', () => {
    it('should emit a single declare module block containing both interfaces', () => {
      const result = generateTypes({
        mergedSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
        },
        pluginSchemas: [{ pluginName: 'yaml', packageName: '@acme/yaml' }],
      });

      // Only one declare module block
      const blockCount = (result.match(/declare module/g) ?? []).length;
      expect(blockCount).toBe(1);

      expect(result).toContain('interface ExampleMetadataRegistry');
      expect(result).toContain('interface PluginOptionsRegistry');
    });

    it('should emit only one declare module block when plugins have no packageName', () => {
      const result = generateTypes({
        mergedSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
        },
        pluginSchemas: [{ pluginName: 'yaml' }],
      });

      const blockCount = (result.match(/declare module/g) ?? []).length;
      expect(blockCount).toBe(1);
      expect(result).not.toContain('PluginOptionsRegistry');
    });

    it('should augment the correct module', () => {
      const result = generateTypes({
        pluginSchemas: [{ pluginName: 'yaml', packageName: '@acme/yaml' }],
      });
      expect(result).toContain("declare module '@functional-examples/devkit'");
    });
  });
});
