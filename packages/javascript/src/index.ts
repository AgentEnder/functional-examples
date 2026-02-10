import type {
  Plugin,
  FileContentsParser,
  FileParseContext,
  ValidationResult,
} from '@functional-examples/devkit';
import { createJavaScriptParser } from './parser.js';
import { createFrontmatterParser } from './frontmatter.js';
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
] as const;

export { createJavaScriptParser } from './parser.js';
export { createFrontmatterParser } from './frontmatter.js';
export { createJavaScriptExtractor } from './extractor.js';

/**
 * Options for the JavaScript plugin.
 */
export interface JavaScriptPluginOptions {
  /** Skip frontmatter extraction (default: false) */
  skipFrontmatter?: boolean;
  /** Skip region extraction (default: false) */
  skipRegions?: boolean;
}

/**
 * JSON Schema for JavaScript plugin options.
 */
const OPTIONS_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    skipFrontmatter: {
      type: 'boolean',
      description: 'Skip frontmatter parsing',
    },
    skipRegions: {
      type: 'boolean',
      description: 'Skip region parsing',
    },
  },
});

/**
 * JSON Schema for metadata this plugin expects.
 */
const METADATA_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Unique example identifier',
    },
    title: {
      type: 'string',
      description: 'Example title',
    },
    description: {
      type: 'string',
      description: 'Example description',
    },
  },
  required: ['id', 'title'],
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
 * - Extracts YAML frontmatter from line/block comments
 * - Extracts code regions from #region/#endregion markers
 * - Provides a single-file extractor for discovering examples
 *
 * The combined parser runs frontmatter parsing FIRST, then region parsing.
 * This ensures frontmatter is stripped before region markers are processed.
 *
 * @param options - Optional plugin configuration
 * @returns A configured JavaScript plugin
 */
export function createJavaScriptPlugin(
  options?: JavaScriptPluginOptions
): Plugin {
  const { skipFrontmatter = false, skipRegions = false } = options ?? {};

  // Create a combined parser that chains frontmatter → regions
  const combinedParser: FileContentsParser = {
    name: 'javascript-combined-parser',

    async parse(context: FileParseContext): Promise<FileParseContext> {
      let result = context;

      // Run frontmatter parser first (extracts metadata, strips frontmatter)
      if (!skipFrontmatter) {
        result = await createFrontmatterParser().parse(result);
      }

      // Run region parser second (extracts hunks, strips markers)
      if (!skipRegions) {
        result = createJavaScriptParser().parse(result) as FileParseContext;
      }

      return result;
    },
  };

  return {
    name: 'javascript',
    extensions: [...JAVASCRIPT_EXTENSIONS],
    extractor: createJavaScriptExtractor(),
    fileContentsParser: combinedParser,
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
