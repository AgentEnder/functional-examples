/**
 * Configuration validation using Zod
 */

import { ConfigSchema } from './schema.js';

export interface ValidationError {
  path: string;
  message: string;
  location?: string;
  fix?: string;
}

export function validateConfig(config: unknown): ValidationError[] {
  const schema = ConfigSchema();
  const result = schema.safeParse(config);

  if (result.success) {
    return [];
  }

  return result.error.issues.map(
    (issue): ValidationError => ({
      path: issue.path.join('.'),
      message: issue.message,
      location: issue.code,
    })
  );
}
