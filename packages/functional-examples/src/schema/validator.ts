import AjvDefault from 'ajv';
import type { JSONSchema } from './merger.js';
import type { ValidationResult, ValidationError } from '../types/index.js';

// Handle both ESM and CJS default exports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Ajv = (AjvDefault as any).default ?? AjvDefault;

/**
 * Create a validator function from a JSON Schema using AJV.
 */
export function createSchemaValidator(
  schema: JSONSchema
): (value: unknown) => ValidationResult {
  const ajv = new Ajv({ allErrors: true });
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

      return {
        path,
        message: err.message ?? 'Validation failed',
      };
    });

    return { success: false, errors };
  };
}
