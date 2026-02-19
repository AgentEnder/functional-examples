import type {
  FileContentsParser,
  FileParseContext,
  ParsedRegion,
} from '../types/index.js';
import path from 'node:path';

interface RegionParseResult {
  hunks: ParsedRegion[];
  parsed: string;
}

interface StackEntry {
  id: string;
  startLine: number;
  lines: string[];
}

/**
 * Get the pattern source string from a string or RegExp entry.
 */
function patternSource(pattern: string | RegExp): string {
  return typeof pattern === 'string' ? pattern : pattern.source;
}

/**
 * Build the start-pattern regex by substituting {token} with startTag.
 */
function buildStartRegex(pattern: string | RegExp, startTag: string): RegExp {
  return new RegExp(patternSource(pattern).replace('{token}', startTag));
}

/**
 * Build the end-pattern regex by substituting {token} with endTag and
 * making the ID capture group optional (since `// endregion` with no ID is valid).
 * Convention: patterns use `\s+(\w+)` for the ID portion.
 */
function buildEndRegex(pattern: string | RegExp, endTag: string): RegExp {
  const withToken = patternSource(pattern).replace('{token}', endTag);
  const withOptional = withToken.replace('\\s+(\\w+)', '(?:\\s+(\\w+))?');
  return new RegExp(withOptional);
}

/**
 * Extract region hunks from file content using the provided extension map.
 *
 * Not exported from barrel files — used directly in tests and by createGenericRegionParser.
 *
 * @param content - File content to parse (should be post-frontmatter-strip if applicable)
 * @param fileName - File name (used to derive extension for map lookup)
 * @param extensionMap - Map of extension → array of regex pattern strings with {token}
 * @param startTag - Token substituted for region start markers
 * @param endTag - Token substituted for region end markers
 * @returns Extracted hunks and content with region marker lines stripped
 */
export function extractRegionFromFileContent(
  content: string,
  fileName: string,
  extensionMap: Record<string, (string | RegExp)[]>,
  startTag: string,
  endTag: string,
): RegionParseResult {
  const ext = path.extname(fileName);
  const patterns = extensionMap[ext];

  if (!patterns || patterns.length === 0) {
    return { hunks: [], parsed: content };
  }

  const startRegexes = patterns.map(p => buildStartRegex(p, startTag));
  const endRegexes = patterns.map(p => buildEndRegex(p, endTag));

  const lines = content.split('\n');
  const outputLines: string[] = [];
  const hunks: ParsedRegion[] = [];
  const stack: StackEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Try each start pattern
    let startId: string | undefined;
    for (const regex of startRegexes) {
      const m = line.match(regex);
      if (m?.[1]) {
        startId = m[1];
        break;
      }
    }

    if (startId !== undefined) {
      stack.push({ id: startId, startLine: lineNum, lines: [] });
      continue; // strip marker line from output
    }

    // Try each end pattern
    let isEndMarker = false;
    for (const regex of endRegexes) {
      if (regex.test(line)) {
        isEndMarker = true;
        break;
      }
    }

    if (isEndMarker) {
      const entry = stack.pop();
      if (entry) {
        hunks.push({
          id: entry.id,
          content: entry.lines.join('\n'),
          startLine: entry.startLine,
          endLine: lineNum,
        });
      }
      continue; // strip marker line from output
    }

    // Regular line — add to output and to any open regions
    outputLines.push(line);
    for (const entry of stack) {
      entry.lines.push(line);
    }
  }

  return { hunks, parsed: outputLines.join('\n') };
}

/**
 * Create a FileContentsParser that extracts region hunks for any extension
 * present in the provided extension map. Used by the scanner for all files.
 */
export function createGenericRegionParser(
  extensionMap: Record<string, (string | RegExp)[]>,
  startTag: string,
  endTag: string,
): FileContentsParser {
  return {
    name: 'core-region-parser',
    parse(context: FileParseContext): FileParseContext {
      const { hunks, parsed } = extractRegionFromFileContent(
        context.parsed,
        context.filePath,
        extensionMap,
        startTag,
        endTag,
      );
      return { ...context, parsed, hunks };
    },
  };
}
