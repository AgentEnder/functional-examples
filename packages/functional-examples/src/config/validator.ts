/**
 * Configuration validation using Zod
 */

import { ConfigSchema } from './schema.js';
import type { ConfigValidationError } from '../types/index.js';

// Re-export for backward compatibility
export type { ConfigValidationError } from '../types/index.js';

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
