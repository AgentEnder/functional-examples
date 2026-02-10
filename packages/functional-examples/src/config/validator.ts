/**
 * Configuration validation using Zod
 */

import type { ConfigValidationError } from '../types/index.js';
import { ConfigSchema } from './schema.js';

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
