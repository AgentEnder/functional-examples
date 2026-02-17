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
    const defs = schema.$defs ?? {};
    expect(defs.javascriptOptions?.properties).toHaveProperty('skipFrontmatter');
  });

  it('should reference plugin schemas in plugins array items', () => {
    const schema = mergeConfigSchema({
      pluginSchemas: [
        { pluginName: 'javascript', options: '{"type":"object"}' },
        { pluginName: 'yaml-manifest', options: '{"type":"object"}' },
      ],
    });

    // The plugins array should allow items matching any registered plugin
    const properties = schema.properties ?? {};
    const pluginsSchema = properties.plugins as { items?: { anyOf?: unknown[] } };
    expect(pluginsSchema.items?.anyOf).toBeDefined();
    expect(pluginsSchema.items?.anyOf).toHaveLength(2);
  });

  it('should support string plugin references', () => {
    const schema = mergeConfigSchema({
      pluginSchemas: [
        { pluginName: '@functional-examples/javascript', options: '{"type":"object"}' },
        { pluginName: '@functional-examples/yaml-manifest', options: '{"type":"object"}' },
      ],
    });

    const properties = schema.properties ?? {};
    const pluginsSchema = properties.plugins as { items?: { anyOf?: unknown[] } };
    const anyOf = pluginsSchema.items?.anyOf ?? [];

    // Should include string const for each plugin
    const stringRefs = anyOf.filter((item: any) => item.const);
    expect(stringRefs).toHaveLength(2);
    expect(stringRefs).toContainEqual({ const: '@functional-examples/javascript' });
    expect(stringRefs).toContainEqual({ const: '@functional-examples/yaml-manifest' });
  });

  it('should support tuple plugin references with options', () => {
    const schema = mergeConfigSchema({
      pluginSchemas: [
        {
          pluginName: '@functional-examples/javascript',
          options: JSON.stringify({
            type: 'object',
            properties: { skipFrontmatter: { type: 'boolean' } },
          }),
        },
      ],
    });

    const properties = schema.properties ?? {};
    const pluginsSchema = properties.plugins as { items?: { anyOf?: unknown[] } };
    const anyOf = pluginsSchema.items?.anyOf ?? [];

    // Should include tuple schema with const name + options ref
    const tupleRefs = anyOf.filter((item: any) =>
      item.type === 'array' && item.prefixItems?.[0]?.const
    );
    expect(tupleRefs.length).toBeGreaterThan(0);

    const jsTuple = tupleRefs.find((item: any) =>
      item.prefixItems[0].const === '@functional-examples/javascript'
    );
    expect(jsTuple).toBeDefined();
    expect(jsTuple.prefixItems).toHaveLength(2);
    expect(jsTuple.prefixItems[0]).toEqual({ const: '@functional-examples/javascript' });
    expect(jsTuple.prefixItems[1]).toEqual({ $ref: '#/$defs/functionalexamplesjavascriptOptions' });
    expect(jsTuple.minItems).toBe(2);
    expect(jsTuple.maxItems).toBe(2);
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
  it('should return base schema with universal fields when no plugin schemas', () => {
    const result = mergeMetadataSchemas({
      pluginSchemas: [],
    });

    expect(result.type).toBe('object');
    // Base schema provides universal fields
    expect(result.properties).toHaveProperty('id');
    expect(result.properties).toHaveProperty('title');
    expect(result.properties).toHaveProperty('description');
    expect(result.properties).toHaveProperty('tags');
    expect(result.required).toContain('id');
    expect(result.required).toContain('title');
  });

  it('should merge config schema over base schema', () => {
    const configSchema = {
      type: 'object',
      properties: { id: { type: 'string', minLength: 3 } },
      required: ['id'],
    };

    const result = mergeMetadataSchemas({
      configSchema,
      pluginSchemas: [],
    });

    // Config overrides base's id property
    const properties = result.properties ?? {};
    const idProp = properties.id as { minLength?: number };
    expect(idProp.minLength).toBe(3);
    // Base fields still present
    expect(result.properties).toHaveProperty('title');
    expect(result.properties).toHaveProperty('tags');
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

    // Plugin fields merged in
    expect(result.properties).toHaveProperty('foo');
    expect(result.properties).toHaveProperty('bar');
    // Base fields still present
    expect(result.properties).toHaveProperty('id');
    expect(result.properties).toHaveProperty('tags');
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
    const properties = result.properties ?? {};
    const idProp = properties.id as { minLength?: number };
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

    // Union of required fields (includes base + config + plugin)
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

  it('should merge $defs from multiple plugins', () => {
    const result = mergeMetadataSchemas({
      pluginSchemas: [
        {
          pluginName: 'a',
          metadata: JSON.stringify({
            type: 'object',
            properties: {},
            $defs: { FooType: { type: 'string' } },
          }),
        },
        {
          pluginName: 'b',
          metadata: JSON.stringify({
            type: 'object',
            properties: {},
            $defs: { BarType: { type: 'number' } },
          }),
        },
      ],
    });

    expect(result.$defs).toHaveProperty('FooType');
    expect(result.$defs).toHaveProperty('BarType');
  });

  it('should keep earlier $defs on key conflicts (merged accumulator wins)', () => {
    const result = mergeMetadataSchemas({
      pluginSchemas: [
        {
          pluginName: 'a',
          metadata: JSON.stringify({
            type: 'object',
            properties: {},
            $defs: { Shared: { type: 'string' } },
          }),
        },
        {
          pluginName: 'b',
          metadata: JSON.stringify({
            type: 'object',
            properties: {},
            $defs: { Shared: { type: 'number' } },
          }),
        },
      ],
    });

    // The accumulated merged schema is the `b` arg in deepMergeSchemas,
    // so plugin a's Shared (already in merged) takes priority over plugin b's.
    const defs = result.$defs ?? {};
    const shared = defs.Shared as { type?: string };
    expect(shared.type).toBe('string');
  });
});
