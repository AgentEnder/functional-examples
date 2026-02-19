import AjvDefault from 'ajv';
import type { ValidationError, ValidationResult } from '../types/index.js';
import type { JSONSchema } from './merger.js';

// Handle both ESM and CJS default exports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Ajv = ((AjvDefault as any).default ?? AjvDefault) as typeof AjvDefault;

/**
 * Create a validator function from a JSON Schema using AJV.
 */
export function createSchemaValidator(
  schema: JSONSchema
): (value: unknown) => ValidationResult {
  const ajv = new Ajv.Ajv({ allErrors: true });
  const validate = ajv.compile(schema);

  return (value: unknown): ValidationResult => {
    const valid = validate(value);

    if (valid) {
      return { success: true, errors: [] };
    }

    const errors: ValidationError[] = (validate.errors ?? []).map((err) => {
      // Build path from instancePath and params
      const basePath = err.instancePath ? err.instancePath.slice(1) : '';
      const missingProp = err.params?.missingProperty as string | undefined;

      let path = basePath;
      if (missingProp) {
        path = basePath ? `${basePath}/${missingProp}` : missingProp;
      }

      let message = err.message ?? 'Validation failed';

      // Include the offending property name for additionalProperties errors
      const additionalProp = err.params?.additionalProperty as
        | string
        | undefined;
      if (additionalProp) {
        message += `: '${additionalProp}'`;
      }

      return {
        path,
        message,
      };
    });

    return { success: false, errors };
  };
}
