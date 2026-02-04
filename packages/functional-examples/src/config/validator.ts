/**
 * Configuration validation using Zod
 */

import { ConfigSchema } from './schema.js';

/**
 * Error from config file validation (Zod-based).
 * Extended version with location and fix suggestions.
 */
export interface ConfigValidationError {
  path: string;
  message: string;
  location?: string;
  fix?: string;
}

/**
 * @deprecated Use ConfigValidationError instead
 */
export type ValidationError = ConfigValidationError;

export function validateConfig(config: unknown): ConfigValidationError[] {
  const schema = ConfigSchema();
  const result = schema.safeParse(config);

  if (result.success) {
    return [];
  }

  return result.error.issues.map(
    (issue): ConfigValidationError => ({
      path: issue.path.join('.'),
      message: issue.message,
      location: issue.code,
    })
  );
}
