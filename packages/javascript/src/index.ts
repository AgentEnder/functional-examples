import type {
  Plugin,
  ValidationResult,
} from '@functional-examples/devkit';
import { createJavaScriptExtractor } from './extractor.js';

export const JAVASCRIPT_EXTENSIONS = [
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.json',
] as const;

export { createJavaScriptExtractor } from './extractor.js';

/**
 * Options for the JavaScript plugin.
 */
export interface JavaScriptPluginOptions {
  /** Skip file extraction/discovery — only contribute parsing (default: false) */
  skipExtraction?: boolean;
}

/**
 * JSON Schema for JavaScript plugin options.
 */
const OPTIONS_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    skipExtraction: {
      type: 'boolean',
      description: 'Skip file extraction/discovery',
    },
  },
});

/**
 * JSON Schema for metadata fields contributed by the JavaScript plugin.
 * Universal fields (id, title, description) are provided by the base schema;
 * this plugin adds tags, which it validates at runtime.
 */
const METADATA_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Tags for categorizing the example',
    },
  },
});

/**
 * Validate metadata extracted by this plugin.
 * Note: id and title are validated by the extractor and are top-level example fields,
 * not part of the metadata object passed here.
 */
function validateMetadata(metadata: Record<string, unknown>): ValidationResult {
  const errors: Array<{ path: string; message: string }> = [];

  // Validate tags array if present
  if (metadata.tags !== undefined) {
    if (!Array.isArray(metadata.tags)) {
      errors.push({ path: 'tags', message: 'must be an array' });
    } else if (!metadata.tags.every((t) => typeof t === 'string')) {
      errors.push({ path: 'tags', message: 'must be an array of strings' });
    }
  }

  return { success: errors.length === 0, errors };
}

/**
 * Create a JavaScript/TypeScript plugin for functional-examples.
 *
 * This plugin:
 * - Handles .js, .jsx, .mjs, .cjs, .ts, .tsx, .mts, .cts files
 * - Provides a single-file extractor for discovering examples
 *
 * @param options - Optional plugin configuration
 * @returns A configured JavaScript plugin
 */
export function createJavaScriptPlugin(
  options?: JavaScriptPluginOptions
): Plugin {
  const { skipExtraction = false } = options ?? {};

  return {
    name: 'javascript',
    extensions: [...JAVASCRIPT_EXTENSIONS],
    extractor: skipExtraction ? undefined : createJavaScriptExtractor(),
    schemas: {
      options: OPTIONS_SCHEMA,
      metadata: METADATA_SCHEMA,
    },
    validators: {
      metadata: validateMetadata,
    },
    _options: options,
  };
}
