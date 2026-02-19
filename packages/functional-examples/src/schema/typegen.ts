import type { JSONSchema } from './merger.js';
import type { PluginSchemaEntry } from '../plugins/registry.js';

export interface GenerateTypesOptions {
  /** Pre-merged metadata schema (from mergeMetadataSchemas) */
  mergedSchema?: JSONSchema;
  /** Plugin schema entries from the registry */
  pluginSchemas?: PluginSchemaEntry[];
}

/**
 * Convert JSON Schema type to TypeScript type.
 * @param schema - The JSON Schema to convert
 * @param indent - Current indentation level (number of spaces)
 */
function schemaTypeToTS(schema: Record<string, unknown>, indent = 0): string {
  const type = schema.type as string | undefined;
  const pad = ' '.repeat(indent);
  const innerPad = ' '.repeat(indent + 2);

  if (schema.const !== undefined) {
    return JSON.stringify(schema.const);
  }

  if (schema.enum) {
    return (schema.enum as unknown[]).map((v) => JSON.stringify(v)).join(' | ');
  }

  if (schema.anyOf) {
    const variants = (schema.anyOf as Record<string, unknown>[]).map((s) =>
      schemaTypeToTS(s, indent)
    );
    return variants.join(' | ');
  }

  if (schema.oneOf) {
    const variants = (schema.oneOf as Record<string, unknown>[]).map((s) =>
      schemaTypeToTS(s, indent)
    );
    return variants.join(' | ');
  }

  if (schema.allOf) {
    const variants = (schema.allOf as Record<string, unknown>[]).map((s) =>
      schemaTypeToTS(s, indent)
    );
    return variants.join(' & ');
  }

  switch (type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'array': {
      const items = schema.items as Record<string, unknown> | undefined;
      return items ? `Array<${schemaTypeToTS(items, indent)}>` : 'unknown[]';
    }
    case 'object': {
      const properties = schema.properties as
        | Record<string, Record<string, unknown>>
        | undefined;
      const additionalProps = schema.additionalProperties;

      // Dictionary type: { additionalProperties: { type: "string" } }
      if (!properties && additionalProps && typeof additionalProps === 'object') {
        return `Record<string, ${schemaTypeToTS(additionalProps as Record<string, unknown>, indent)}>`;
      }

      if (!properties) return 'Record<string, unknown>';

      const required = new Set((schema.required as string[]) ?? []);
      const props = Object.entries(properties)
        .map(([key, propSchema]) => {
          const optional = required.has(key) ? '' : '?';
          return `${innerPad}${key}${optional}: ${schemaTypeToTS(propSchema, indent + 2)};`;
        })
        .join('\n');

      return `{\n${props}\n${pad}}`;
    }
    default:
      return 'unknown';
  }
}

const HEADER_COMMENT = `/**
 * Auto-generated metadata types from config and plugins.
 * Do not edit manually - regenerate with: functional-examples generate
 *
 * This file augments the ExampleMetadataRegistry interface to provide
 * type-safe metadata for all Example types in your project.
 *
 * Include this file in your tsconfig.json to enable type checking.
 */

`;

// When PluginReference is referenced in the generated output, import it so it
// is in scope inside the augmentation block. When it isn't used, fall back to
// `export {}` which still makes this file a module (required for augmentation)
// without introducing an unused import that would fail linting.
const HEADER_WITH_PLUGIN_REFERENCE = `${HEADER_COMMENT}// PluginReference is imported so it is in scope inside augmentation blocks.
import type { PluginReference } from '@functional-examples/devkit';

`;

const HEADER_WITHOUT_PLUGIN_REFERENCE = `${HEADER_COMMENT}// export {} makes this file a TypeScript module so the augmentation below
// applies to the ambient module rather than replacing it.
export {};

`;

/**
 * Generate a metadata type object literal from JSON Schema.
 * The output is indented to fit inside the ExampleMetadataRegistry interface.
 */
function generateMetadataType(schema: JSONSchema): string {
  const properties = schema.properties as
    | Record<string, Record<string, unknown>>
    | undefined;

  if (!properties || Object.keys(properties).length === 0) {
    return 'Record<string, unknown>';
  }

  const required = new Set((schema.required as string[]) ?? []);
  // Base indent is 6 spaces (inside `metadata: { ... }` which is inside the interface)
  const baseIndent = 6;
  const props = Object.entries(properties)
    .map(([key, propSchema]) => {
      const optional = required.has(key) ? '' : '?';
      const tsType = schemaTypeToTS(propSchema, baseIndent);
      return `${' '.repeat(baseIndent)}${key}${optional}: ${tsType};`;
    })
    .join('\n');

  // Closing brace at 4 spaces (level of `metadata:`)
  return `{\n${props}\n    }`;
}

/**
 * Generate a TypeScript options type for a single plugin from its JSON Schema.
 * Returns an inline object type literal for use in a tuple reference.
 */
function generatePluginOptionsType(optionsSchema: string): string | null {
  let schema: Record<string, unknown>;
  try {
    schema = JSON.parse(optionsSchema) as Record<string, unknown>;
  } catch {
    return null;
  }

  const properties = schema.properties as
    | Record<string, Record<string, unknown>>
    | undefined;

  if (!properties || Object.keys(properties).length === 0) {
    return null;
  }

  const required = new Set((schema.required as string[]) ?? []);
  const props = Object.entries(properties)
    .map(([key, propSchema]) => {
      const optional = required.has(key) ? '' : '?';
      return `${key}${optional}: ${schemaTypeToTS(propSchema, 6)}`;
    })
    .join('; ');

  return `{ ${props} }`;
}

/**
 * Build the PluginOptionsRegistry interface body, or null if there are no
 * plugin entries with a known package name.
 */
function buildPluginOptionsInterface(
  pluginSchemas: PluginSchemaEntry[]
): string | null {
  const entries = pluginSchemas.filter((s) => s.packageName !== undefined);
  if (entries.length === 0) return null;

  const unionLines: string[] = [];

  for (const entry of entries) {
    // packageName is guaranteed by the filter above
    const pkg = entry.packageName as string;

    unionLines.push(`      | ${JSON.stringify(pkg)}`);

    if (entry.options) {
      const optionsType = generatePluginOptionsType(entry.options);
      if (optionsType) {
        unionLines.push(`      | [${JSON.stringify(pkg)}, ${optionsType}]`);
      }
    }
  }

  // PluginReference is in scope — we're inside the declare module augmentation
  unionLines.push(`      | PluginReference`);

  return `  interface PluginOptionsRegistry {
    plugins:
${unionLines.join('\n')};
  }`;
}

/**
 * Generate TypeScript type declarations from merged metadata schema and plugin
 * schemas, emitting a single `declare module` block that contains both the
 * ExampleMetadataRegistry and (when plugins are present) PluginOptionsRegistry
 * interface augmentations.
 */
export function generateTypes(options: GenerateTypesOptions): string {
  const { mergedSchema, pluginSchemas = [] } = options;

  const metadataType =
    mergedSchema && mergedSchema.properties
      ? generateMetadataType(mergedSchema)
      : 'Record<string, unknown>';

  const metadataInterface = `  interface ExampleMetadataRegistry {
    metadata: ${metadataType};
  }`;

  const pluginInterface = buildPluginOptionsInterface(pluginSchemas);

  const interfaces = pluginInterface
    ? `${metadataInterface}\n\n${pluginInterface}`
    : metadataInterface;

  const header = pluginInterface
    ? HEADER_WITH_PLUGIN_REFERENCE
    : HEADER_WITHOUT_PLUGIN_REFERENCE;

  return `${header}declare module '@functional-examples/devkit' {
${interfaces}
}
`;
}
