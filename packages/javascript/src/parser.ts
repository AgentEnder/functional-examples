import type {
  FileContentsParser,
  FileParseContext,
  ParsedRegion,
} from '@functional-examples/devkit';

/**
 * Configuration for custom region tag markers.
 */
export interface RegionTagConfig {
  /** The start marker (default: '#region') */
  start: string;
  /** The end marker (default: '#endregion') */
  end: string;
}

const DEFAULT_REGION_TAG: RegionTagConfig = {
  start: '#region',
  end: '#endregion',
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRegionRegexes(tag: RegionTagConfig) {
  const start = escapeRegex(tag.start);
  const end = escapeRegex(tag.end);

  return {
    lineStart: new RegExp(`^[ \\t]*\\/\\/\\s*${start}\\s+(\\S+)\\s*$`),
    lineEnd: new RegExp(`^[ \\t]*\\/\\/\\s*${end}(?:\\s+(\\S+))?\\s*$`),
    blockStart: new RegExp(`^[ \\t]*\\/\\*\\s*${start}\\s+(\\S+)\\s*\\*\\/\\s*$`),
    blockEnd: new RegExp(
      `^[ \\t]*\\/\\*\\s*${end}(?:\\s+(\\S+))?\\s*\\*\\/\\s*$`
    ),
  };
}

interface RegionState {
  id: string;
  startLine: number;
  lines: string[];
}

/**
 * Create a FileContentsParser for JavaScript/TypeScript files.
 * Handles region extraction and marker stripping.
 *
 * @param regionTag - Optional custom region tag markers
 */
export function createJavaScriptParser(
  regionTag?: RegionTagConfig
): FileContentsParser {
  const tag = regionTag ?? DEFAULT_REGION_TAG;
  const regex = buildRegionRegexes(tag);

  return {
    name: 'javascript-parser',

    parse(context: FileParseContext): FileParseContext {
      const lines = context.parsed.split('\n');
      const hunks: ParsedRegion[] = [];
      const outputLines: string[] = [];
      const regionStack: RegionState[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        // Check for region start
        const startMatch =
          line.match(regex.lineStart) || line.match(regex.blockStart);

        if (startMatch) {
          regionStack.push({
            id: startMatch[1],
            startLine: lineNum,
            lines: [],
          });
          continue; // Don't include marker in output
        }

        // Check for region end
        const endMatch =
          line.match(regex.lineEnd) || line.match(regex.blockEnd);

        if (endMatch) {
          const current = regionStack.pop();
          if (current) {
            hunks.push({
              id: current.id,
              content: current.lines.join('\n'),
              startLine: current.startLine,
              endLine: lineNum,
            });
          }
          continue; // Don't include marker in output
        }

        // Regular line - add to output and any active regions
        outputLines.push(line);
        for (const region of regionStack) {
          region.lines.push(line);
        }
      }

      return {
        ...context,
        parsed: outputLines.join('\n'),
        hunks,
      };
    },
  };
}
