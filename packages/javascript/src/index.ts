import type {
  Plugin,
  FileContentsParser,
  FileParseContext,
} from 'functional-examples';
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

    parse(context: FileParseContext): FileParseContext {
      let result = context;

      // Run frontmatter parser first (extracts metadata, strips frontmatter)
      if (!skipFrontmatter) {
        result = createFrontmatterParser().parse(result) as FileParseContext;
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
  };
}
