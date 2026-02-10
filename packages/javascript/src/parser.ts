import type {
  FileContentsParser,
  FileParseContext,
  ParsedRegion,
} from '@functional-examples/devkit';

const LINE_COMMENT_REGION = /^[ \t]*\/\/\s*#region\s+(\S+)\s*$/;
const LINE_COMMENT_ENDREGION = /^[ \t]*\/\/\s*#endregion(?:\s+(\S+))?\s*$/;
const BLOCK_COMMENT_REGION = /^[ \t]*\/\*\s*#region\s+(\S+)\s*\*\/\s*$/;
const BLOCK_COMMENT_ENDREGION =
  /^[ \t]*\/\*\s*#endregion(?:\s+(\S+))?\s*\*\/\s*$/;

interface RegionState {
  id: string;
  startLine: number;
  lines: string[];
}

/**
 * Create a FileContentsParser for JavaScript/TypeScript files.
 * Handles region extraction and marker stripping.
 */
export function createJavaScriptParser(): FileContentsParser {
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
          line.match(LINE_COMMENT_REGION) || line.match(BLOCK_COMMENT_REGION);

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
          line.match(LINE_COMMENT_ENDREGION) ||
          line.match(BLOCK_COMMENT_ENDREGION);

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
