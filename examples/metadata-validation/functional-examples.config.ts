import { createJavaScriptPlugin } from '@functional-examples/javascript';
import type { Config } from 'functional-examples';

/**
 * Configuration demonstrating metadata validation.
 *
 * The `metadata` field defines a JSON Schema that all examples must satisfy.
 * Examples missing required fields will produce validation errors.
 *
 * This is useful for enforcing consistent metadata across your examples:
 * - Required fields like category, difficulty
 * - Type constraints (string, number, enum values)
 * - Custom validation rules
 */
const config: Config = {
  plugins: [createJavaScriptPlugin()],
  scan: {
    include: ['**/*'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
  // #region schema
  // JSON Schema for example metadata
  metadata: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Category for organizing examples',
      },
      difficulty: {
        type: 'string',
        enum: ['beginner', 'intermediate', 'advanced'],
        description: 'Difficulty level',
      },
    },
    required: ['category', 'difficulty'],
  },
  // #endregion schema
};

export default config;
