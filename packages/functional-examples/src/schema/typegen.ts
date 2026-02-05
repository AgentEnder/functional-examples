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

/**
 * Generate TypeScript interface from JSON Schema.
 */
function generateInterface(name: string, schema: JSONSchema): string {
  const properties = schema.properties as
    | Record<string, Record<string, unknown>>
    | undefined;

  if (!properties || Object.keys(properties).length === 0) {
    return `export interface ${name} extends Record<string, unknown> {}`;
  }

  const required = new Set((schema.required as string[]) ?? []);
  const props = Object.entries(properties)
    .map(([key, propSchema]) => {
      const optional = required.has(key) ? '' : '?';
      const tsType = schemaTypeToTS(propSchema);
      return `  ${key}${optional}: ${tsType};`;
    })
    .join('\n');

  return `export interface ${name} {\n${props}\n}`;
}

const HEADER = `/**
 * Auto-generated metadata types from config and plugins.
 * Do not edit manually - regenerate with: functional-examples generate
 */

`;

/**
 * Generate TypeScript type declarations from merged metadata schema.
 */
export function generateMetadataTypes(
  options: GenerateMetadataTypesOptions
): string {
  const { mergedSchema } = options;

  if (!mergedSchema || !mergedSchema.properties) {
    return `${HEADER}export type ExampleMetadata = Record<string, unknown>;\n`;
  }

  const interfaceCode = generateInterface('ExampleMetadata', mergedSchema);

  return `${HEADER}${interfaceCode}\n`;
}
