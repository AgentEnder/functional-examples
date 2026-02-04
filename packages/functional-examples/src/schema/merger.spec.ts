import { describe, it, expect } from 'vitest';
import { mergeConfigSchema, mergeMetadataSchemas } from './merger.js';

describe('mergeConfigSchema', () => {
  it('should create base config schema with no plugins', () => {
    const schema = mergeConfigSchema({ pluginSchemas: [] });

    expect(schema.type).toBe('object');
    expect(schema.properties).toHaveProperty('plugins');
    expect(schema.properties).toHaveProperty('scan');
    expect(schema.properties).toHaveProperty('pathMappings');
    expect(schema.properties).toHaveProperty('metadata');
  });

  it('should include plugin options schemas', () => {
    const schema = mergeConfigSchema({
      pluginSchemas: [
        {
          pluginName: 'javascript',
          options: JSON.stringify({
            type: 'object',
            properties: {
              skipFrontmatter: { type: 'boolean' },
            },
          }),
        },
      ],
    });

    expect(schema.$defs).toHaveProperty('javascriptOptions');
    expect(schema.$defs!.javascriptOptions.properties).toHaveProperty(
      'skipFrontmatter'
    );
  });

  it('should reference plugin schemas in plugins array items', () => {
    const schema = mergeConfigSchema({
      pluginSchemas: [
        { pluginName: 'javascript', options: '{"type":"object"}' },
        { pluginName: 'yaml-manifest', options: '{"type":"object"}' },
      ],
    });

    // The plugins array should allow items matching any registered plugin
    const pluginsSchema = schema.properties!.plugins as { items?: { anyOf?: unknown[] } };
    expect(pluginsSchema.items?.anyOf).toBeDefined();
    expect(pluginsSchema.items?.anyOf).toHaveLength(2);
  });

  it('should produce valid JSON Schema', () => {
    const schema = mergeConfigSchema({ pluginSchemas: [] });

    // Should be parseable as JSON
    const json = JSON.stringify(schema);
    expect(() => JSON.parse(json)).not.toThrow();

    // Should have $schema
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
  });

  it('should sanitize plugin names for $defs keys', () => {
    const schema = mergeConfigSchema({
      pluginSchemas: [
        {
          pluginName: '@scope/my-plugin',
          options: '{"type":"object"}',
        },
      ],
    });

    // Should remove non-alphanumeric characters
    expect(schema.$defs).toHaveProperty('scopemypluginOptions');
  });

  it('should skip plugins with invalid JSON in options schema', () => {
    const schema = mergeConfigSchema({
      pluginSchemas: [
        { pluginName: 'valid', options: '{"type":"object"}' },
        { pluginName: 'invalid', options: 'not-json' },
      ],
    });

    expect(schema.$defs).toHaveProperty('validOptions');
    expect(schema.$defs).not.toHaveProperty('invalidOptions');
  });
});

describe('mergeMetadataSchemas', () => {
  it('should return base schema when no plugin schemas', () => {
    const result = mergeMetadataSchemas({
      pluginSchemas: [],
    });

    expect(result.type).toBe('object');
    expect(result.properties).toEqual({});
  });

  it('should return config schema when no plugin schemas', () => {
    const configSchema = {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    };

    const result = mergeMetadataSchemas({
      configSchema,
      pluginSchemas: [],
    });

    expect(result).toEqual(configSchema);
  });

  it('should merge plugin metadata schemas', () => {
    const result = mergeMetadataSchemas({
      pluginSchemas: [
        {
          pluginName: 'a',
          metadata: '{"type":"object","properties":{"foo":{"type":"string"}}}',
        },
        {
          pluginName: 'b',
          metadata: '{"type":"object","properties":{"bar":{"type":"number"}}}',
        },
      ],
    });

    expect(result.properties).toHaveProperty('foo');
    expect(result.properties).toHaveProperty('bar');
  });

  it('should give config schema priority over plugin schemas on conflict', () => {
    const configSchema = {
      type: 'object',
      properties: {
        id: { type: 'string', minLength: 5 }, // Config says minLength: 5
      },
    };

    const result = mergeMetadataSchemas({
      configSchema,
      pluginSchemas: [
        {
          pluginName: 'plugin',
          metadata: JSON.stringify({
            type: 'object',
            properties: {
              id: { type: 'string', minLength: 1 }, // Plugin says minLength: 1
              title: { type: 'string' },
            },
          }),
        },
      ],
    });

    // Config wins - minLength should be 5, not 1
    const idProp = result.properties!.id as { minLength?: number };
    expect(idProp.minLength).toBe(5);
    // Plugin's non-conflicting property is still included
    expect(result.properties).toHaveProperty('title');
  });

  it('should merge required arrays with config taking precedence', () => {
    const configSchema = {
      type: 'object',
      properties: {},
      required: ['id', 'title'],
    };

    const result = mergeMetadataSchemas({
      configSchema,
      pluginSchemas: [
        {
          pluginName: 'plugin',
          metadata: JSON.stringify({
            type: 'object',
            properties: {},
            required: ['id', 'category'], // Plugin wants category required
          }),
        },
      ],
    });

    // Union of required fields
    expect(result.required).toContain('id');
    expect(result.required).toContain('title');
    expect(result.required).toContain('category');
  });

  it('should skip plugins with invalid metadata schema JSON', () => {
    const result = mergeMetadataSchemas({
      pluginSchemas: [
        {
          pluginName: 'valid',
          metadata: '{"type":"object","properties":{"foo":{"type":"string"}}}',
        },
        { pluginName: 'invalid', metadata: 'not-json' },
      ],
    });

    expect(result.properties).toHaveProperty('foo');
  });
});
