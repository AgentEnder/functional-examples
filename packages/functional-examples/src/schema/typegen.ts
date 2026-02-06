import type { JSONSchema } from './merger.js';

export interface GenerateMetadataTypesOptions {
  /** Pre-merged metadata schema (from mergeMetadataSchemas) */
  mergedSchema?: JSONSchema;
}

/**
 * Convert JSON Schema type to TypeScript type.
 */
function schemaTypeToTS(schema: Record<string, unknown>): string {
  const type = schema.type as string | undefined;

  if (schema.const !== undefined) {
    return JSON.stringify(schema.const);
  }

  if (schema.enum) {
    return (schema.enum as unknown[]).map((v) => JSON.stringify(v)).join(' | ');
  }

  if (schema.anyOf) {
    const variants = (schema.anyOf as Record<string, unknown>[]).map((s) =>
      schemaTypeToTS(s)
    );
    return variants.join(' | ');
  }

  if (schema.oneOf) {
    const variants = (schema.oneOf as Record<string, unknown>[]).map((s) =>
      schemaTypeToTS(s)
    );
    return variants.join(' | ');
  }

  if (schema.allOf) {
    const variants = (schema.allOf as Record<string, unknown>[]).map((s) =>
      schemaTypeToTS(s)
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
      return items ? `Array<${schemaTypeToTS(items)}>` : 'unknown[]';
    }
    case 'object': {
      const properties = schema.properties as
        | Record<string, Record<string, unknown>>
        | undefined;
      const additionalProps = schema.additionalProperties;

      // Dictionary type: { additionalProperties: { type: "string" } }
      if (!properties && additionalProps && typeof additionalProps === 'object') {
        return `Record<string, ${schemaTypeToTS(additionalProps as Record<string, unknown>)}>`;
      }

      if (!properties) return 'Record<string, unknown>';

      const required = new Set((schema.required as string[]) ?? []);
      const props = Object.entries(properties)
        .map(([key, propSchema]) => {
          const optional = required.has(key) ? '' : '?';
          return `  ${key}${optional}: ${schemaTypeToTS(propSchema)};`;
        })
        .join('\n');

      return `{\n${props}\n}`;
    }
    default:
      return 'unknown';
  }
}

const HEADER = `/**
 * Auto-generated metadata types from config and plugins.
 * Do not edit manually - regenerate with: functional-examples generate
 *
 * This file augments the ExampleMetadataRegistry interface to provide
 * type-safe metadata for all Example types in your project.
 *
 * Include this file in your tsconfig.json to enable type checking.
 */

`;

/**
 * Generate a metadata type object literal from JSON Schema.
 */
function generateMetadataType(schema: JSONSchema): string {
  const properties = schema.properties as
    | Record<string, Record<string, unknown>>
    | undefined;

  if (!properties || Object.keys(properties).length === 0) {
    return 'Record<string, unknown>';
  }

  const required = new Set((schema.required as string[]) ?? []);
  const props = Object.entries(properties)
    .map(([key, propSchema]) => {
      const optional = required.has(key) ? '' : '?';
      const tsType = schemaTypeToTS(propSchema);
      return `      ${key}${optional}: ${tsType};`;
    })
    .join('\n');

  return `{\n${props}\n    }`;
}

/**
 * Generate TypeScript type declarations from merged metadata schema.
 *
 * Outputs a module augmentation that extends ExampleMetadataRegistry,
 * which automatically provides types for all Example<> usages.
 */
export function generateMetadataTypes(
  options: GenerateMetadataTypesOptions
): string {
  const { mergedSchema } = options;

  if (!mergedSchema || !mergedSchema.properties) {
    // No schema properties - output empty augmentation
    return `${HEADER}declare module 'functional-examples' {
  interface ExampleMetadataRegistry {
    metadata: Record<string, unknown>;
  }
}
`;
  }

  const metadataType = generateMetadataType(mergedSchema);

  return `${HEADER}declare module 'functional-examples' {
  interface ExampleMetadataRegistry {
    metadata: ${metadataType};
  }
}
`;
}
