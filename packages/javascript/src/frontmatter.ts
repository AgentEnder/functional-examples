import {
  type FileContentsParser,
  type FileParseContext,
  type ParsedRegion,
  parseYaml,
} from '@functional-examples/devkit';

/** Pattern matching line comment frontmatter start: // --- */
const LINE_COMMENT_START = /^[ \t]*\/\/\s*---\s*$/;
/** Pattern matching line comment frontmatter end: // --- */
const LINE_COMMENT_END = /^[ \t]*\/\/\s*---\s*$/;
/** Pattern matching line comment content: // <content> */
const LINE_COMMENT_CONTENT = /^[ \t]*\/\/\s?(.*)$/;

/** Pattern matching block comment frontmatter start: /* --- */
const BLOCK_COMMENT_START = /^[ \t]*\/\*\s*---\s*$/;
/** Pattern matching block comment frontmatter end: --- */
const BLOCK_COMMENT_END = /^[ \t]*---\s*\*\/\s*$/;

interface FrontmatterResult {
  /** Parsed YAML metadata */
  metadata: Record<string, unknown>;
  /** Number of lines consumed by frontmatter (including delimiters) */
  linesConsumed: number;
  /** Raw frontmatter block (including delimiters) for hunk output */
  rawBlock: string;
}

/**
 * Try to extract line comment style frontmatter from the start of the file.
 * Format:
 * // ---
 * // key: value
 * // ---
 */
async function extractLineCommentFrontmatter(
  lines: string[]
): Promise<FrontmatterResult | null> {
  if (lines.length < 2) return null;

  // First line must be // ---
  if (!LINE_COMMENT_START.test(lines[0])) {
    return null;
  }

  // Find closing delimiter
  const yamlLines: string[] = [];
  let endIndex = -1;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Check for closing delimiter
    if (LINE_COMMENT_END.test(line)) {
      endIndex = i;
      break;
    }

    // Extract content from line comment
    const match = line.match(LINE_COMMENT_CONTENT);
    if (match) {
      yamlLines.push(match[1]);
    } else {
      // Non-comment line before closing delimiter - invalid frontmatter
      return null;
    }
  }

  if (endIndex === -1) {
    // No closing delimiter found
    return null;
  }

  const yamlContent = yamlLines.join('\n');
  const metadata = yamlContent.trim()
    ? ((await parseYaml(yamlContent)) as Record<string, unknown>) ?? {}
    : {};

  const rawBlock = lines.slice(0, endIndex + 1).join('\n');

  return {
    metadata,
    linesConsumed: endIndex + 1,
    rawBlock,
  };
}

/**
 * Try to extract block comment style frontmatter from the start of the file.
 * Format:
 * /* ---
 * key: value
 * --- *\/
 */
async function extractBlockCommentFrontmatter(
  lines: string[]
): Promise<FrontmatterResult | null> {
  if (lines.length < 2) return null;

  // First line must be /* ---
  if (!BLOCK_COMMENT_START.test(lines[0])) {
    return null;
  }

  // Find closing delimiter
  const yamlLines: string[] = [];
  let endIndex = -1;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Check for closing delimiter
    if (BLOCK_COMMENT_END.test(line)) {
      endIndex = i;
      break;
    }

    // Content lines are raw YAML (no prefix stripping needed)
    yamlLines.push(line);
  }

  if (endIndex === -1) {
    // No closing delimiter found
    return null;
  }

  const yamlContent = yamlLines.join('\n');
  const metadata = yamlContent.trim()
    ? ((await parseYaml(yamlContent)) as Record<string, unknown>) ?? {}
    : {};

  const rawBlock = lines.slice(0, endIndex + 1).join('\n');

  return {
    metadata,
    linesConsumed: endIndex + 1,
    rawBlock,
  };
}

/**
 * Create a FileContentsParser that extracts YAML frontmatter from JavaScript/TypeScript files.
 *
 * Supports two formats:
 * 1. Line comment style:
 *    ```javascript
 *    // ---
 *    // title: Example
 *    // ---
 *    ```
 *
 * 2. Block comment wrapped style:
 *    ```javascript
 *    /* ---
 *    title: Example
 *    --- *\/
 *    ```
 *
 * Frontmatter must be at the very start of the file (line 1).
 * Extracted metadata is merged into context.metadata.
 * The frontmatter block is stripped from context.parsed.
 */
export function createFrontmatterParser(): FileContentsParser {
  return {
    name: 'javascript-frontmatter-parser',

    async parse(context: FileParseContext): Promise<FileParseContext> {
      const lines = context.parsed.split('\n');

      // Try line comment style first, then block comment style
      const result =
        (await extractLineCommentFrontmatter(lines)) ??
        (await extractBlockCommentFrontmatter(lines));

      if (!result) {
        // No frontmatter found, return context unchanged
        return context;
      }

      // Strip frontmatter lines from parsed content
      const remainingLines = lines.slice(result.linesConsumed);
      const parsed = remainingLines.join('\n');

      // Merge extracted metadata with existing metadata
      const metadata = {
        ...context.metadata,
        ...result.metadata,
      };

      // Emit a "frontmatter" hunk so docs can reference it via region('frontmatter')
      const frontmatterHunk: ParsedRegion = {
        id: 'frontmatter',
        content: result.rawBlock,
        startLine: 1,
        endLine: result.linesConsumed,
      };

      const hunks = [frontmatterHunk];

      return {
        ...context,
        parsed,
        metadata,
        hunks,
      };
    },
  };
}
