import type { PluginSchemaEntry } from '../plugins/registry.js';

/**
 * JSON Schema type (subset of JSON Schema spec).
 */
export interface JSONSchema {
  $schema?: string;
  $defs?: Record<string, JSONSchema>;
  type?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  anyOf?: JSONSchema[];
  $ref?: string;
  description?: string;
  [key: string]: unknown;
}

export interface MergeConfigSchemaOptions {
  pluginSchemas: PluginSchemaEntry[];
}

export interface MergeMetadataSchemasOptions {
  /** User-defined metadata schema from config (takes priority) */
  configSchema?: JSONSchema;
  /** Plugin metadata schemas */
  pluginSchemas: PluginSchemaEntry[];
}

/**
 * Base config schema structure.
 */
function createBaseConfigSchema(): JSONSchema {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
      plugins: {
        type: 'array',
        description: 'Plugins to use for scanning and parsing',
        items: { type: 'object' }, // Will be replaced with anyOf
      },
      metadata: {
        type: 'object',
        description:
          'JSON Schema defining the expected metadata structure for examples',
      },
      scan: {
        type: 'object',
        properties: {
          include: {
            type: 'array',
            items: { type: 'string' },
            description: 'Glob patterns to include',
          },
          exclude: {
            type: 'array',
            items: { type: 'string' },
            description: 'Glob patterns to exclude',
          },
        },
      },
      pathMappings: {
        type: 'array',
        description: 'Path mappings for conflict resolution',
        items: {
          type: 'object',
          properties: {
            pattern: { type: 'string' },
            extractor: { type: 'string' },
          },
          required: ['pattern', 'extractor'],
        },
      },
      generate: {
        type: 'object',
        properties: {
          outputDir: {
            type: 'string',
            description: 'Output directory for generated files',
          },
        },
      },
    },
    $defs: {},
  };
}

/**
 * Merge plugin schemas into a complete config schema.
 */
export function mergeConfigSchema(options: MergeConfigSchemaOptions): JSONSchema {
  const { pluginSchemas } = options;
  const schema = createBaseConfigSchema();
  const pluginRefs: JSONSchema[] = [];

  for (const { pluginName, options: optionsSchema } of pluginSchemas) {
    if (!optionsSchema) continue;

    const defName = `${pluginName.replace(/[^a-zA-Z0-9]/g, '')}Options`;

    try {
      const parsed = JSON.parse(optionsSchema) as JSONSchema;
      const defs = schema.$defs ?? {};
      defs[defName] = {
        ...parsed,
        description: `Options for ${pluginName} plugin`,
      };
      schema.$defs = defs;

      pluginRefs.push({
        type: 'object',
        properties: {
          name: { const: pluginName },
          options: { $ref: `#/$defs/${defName}` },
        },
      });
    } catch {
      // Invalid JSON schema, skip
      console.warn(`Invalid options schema for plugin ${pluginName}`);
    }
  }

  // Update plugins array to use anyOf if we have plugin schemas
  if (pluginRefs.length > 0) {
    const properties = schema.properties ?? {};
    properties.plugins = {
      type: 'array',
      description: 'Plugins to use for scanning and parsing',
      items: { anyOf: pluginRefs },
    };
    schema.properties = properties;
  }

  return schema;
}

/**
 * Base metadata schema with universal fields shared across all plugins.
 */
function createBaseMetadataSchema(): JSONSchema {
  return {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Unique example identifier',
      },
      title: {
        type: 'string',
        description: 'Example title',
      },
      description: {
        type: 'string',
        description: 'Example description',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags for categorizing the example',
      },
    },
    required: ['id', 'title'],
  };
}

/**
 * Deep merge two JSON Schema objects.
 * Second schema (b) takes priority on conflicts.
 */
function deepMergeSchemas(a: JSONSchema, b: JSONSchema): JSONSchema {
  const result: JSONSchema = { ...a };

  for (const [key, value] of Object.entries(b)) {
    if (
      key === 'properties' &&
      result.properties &&
      typeof value === 'object'
    ) {
      // Merge properties, b takes priority
      result.properties = {
        ...result.properties,
        ...(value as Record<string, JSONSchema>),
      };
    } else if (
      key === '$defs' &&
      result.$defs &&
      typeof value === 'object'
    ) {
      // Merge $defs, b takes priority on conflicts
      result.$defs = {
        ...result.$defs,
        ...(value as Record<string, JSONSchema>),
      };
    } else if (
      key === 'required' &&
      Array.isArray(result.required) &&
      Array.isArray(value)
    ) {
      // Union required arrays
      result.required = [...new Set([...result.required, ...value])];
    } else {
      // b takes priority for all other fields
      result[key] = value;
    }
  }

  return result;
}

/**
 * Merge metadata schemas from config and plugins.
 * Config schema takes priority on conflicts.
 */
export function mergeMetadataSchemas(
  options: MergeMetadataSchemasOptions
): JSONSchema {
  const { configSchema, pluginSchemas } = options;

  // Start with base metadata schema containing universal fields
  const base = createBaseMetadataSchema();

  // Overlay config schema on top of base (config takes priority)
  let merged: JSONSchema = configSchema
    ? deepMergeSchemas(base, configSchema)
    : base;

  // Merge in plugin schemas (config already in merged, so it has priority)
  for (const { pluginName, metadata } of pluginSchemas) {
    if (!metadata) continue;

    try {
      const pluginSchema = JSON.parse(metadata) as JSONSchema;
      // Merge plugin into current, but then overlay config again for priority
      const withPlugin = deepMergeSchemas(pluginSchema, merged);
      // Re-apply config schema to ensure it wins on conflicts
      merged = configSchema
        ? deepMergeSchemas(withPlugin, configSchema)
        : withPlugin;
    } catch {
      console.warn(`Invalid metadata schema for plugin ${pluginName}`);
    }
  }

  return merged;
}
