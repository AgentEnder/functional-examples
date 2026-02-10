export interface JsonParseErrorOptions {
  content: string;
  error: Error;
  filePath?: string;
}

export interface FormattedJsonError {
  message: string;
  line?: number;
  column?: number;
}

/**
 * Converts a character offset in a string to 1-based line and column numbers.
 */
export function positionToLineColumn(
  content: string,
  offset: number
): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(offset, content.length));
  const before = content.slice(0, clamped);
  const lines = before.split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

/**
 * Attempts to extract line/column information from a JSON parse error.
 *
 * Checks for:
 * 1. json5-style errors with `lineNumber`/`columnNumber` properties
 * 2. Node.js JSON.parse errors with "at line X column Y"
 * 3. Node.js JSON.parse errors with "at position N" (converted via positionToLineColumn)
 */
export function extractErrorPosition(
  error: Error,
  content?: string
): { line?: number; column?: number } {
  // json5 errors have lineNumber and columnNumber
  const errorRecord = error as unknown as Record<string, unknown>;
  if (
    typeof errorRecord['lineNumber'] === 'number' &&
    typeof errorRecord['columnNumber'] === 'number'
  ) {
    return {
      line: errorRecord['lineNumber'] as number,
      column: errorRecord['columnNumber'] as number,
    };
  }

  const message = error.message;

  // Node.js "at line X column Y"
  const lineColMatch = message.match(/at line (\d+) column (\d+)/);
  if (lineColMatch) {
    return {
      line: parseInt(lineColMatch[1], 10),
      column: parseInt(lineColMatch[2], 10),
    };
  }

  // Node.js "at position N"
  const posMatch = message.match(/at position (\d+)/);
  if (posMatch && content) {
    const offset = parseInt(posMatch[1], 10);
    return positionToLineColumn(content, offset);
  }

  return {};
}

/**
 * Builds a code frame showing context around an error location.
 *
 * Shows approximately 2 lines before and after the error line,
 * with a `>` marker on the error line and a `^` pointer at the column.
 */
export function buildCodeFrame(
  content: string,
  line: number,
  column?: number
): string {
  const lines = content.split('\n');
  const startLine = Math.max(1, line - 2);
  const endLine = Math.min(lines.length, line + 2);

  const gutterWidth = String(endLine).length;

  const frameLines: string[] = [];

  for (let i = startLine; i <= endLine; i++) {
    const lineContent = lines[i - 1];
    const lineNum = String(i).padStart(gutterWidth);

    if (i === line) {
      frameLines.push(`> ${lineNum} | ${lineContent}`);
      if (column !== undefined) {
        const padding = ' '.repeat(gutterWidth + 4 + column - 1);
        frameLines.push(`${padding}^`);
      }
    } else {
      frameLines.push(`  ${lineNum} | ${lineContent}`);
    }
  }

  return frameLines.join('\n');
}

/**
 * Formats a JSON parse error into a readable message with code frame.
 */
export function formatJsonError(
  options: JsonParseErrorOptions
): FormattedJsonError {
  const { content, error, filePath } = options;
  const { line, column } = extractErrorPosition(error, content);

  let location = '';
  if (filePath) {
    location = filePath;
    if (line !== undefined) {
      location += `:${line}`;
      if (column !== undefined) {
        location += `:${column}`;
      }
    }
  }

  const header = location
    ? `Failed to parse JSON (${location}): ${error.message}`
    : `Failed to parse JSON: ${error.message}`;

  let message = header;

  if (line !== undefined) {
    const frame = buildCodeFrame(content, line, column);
    message += '\n\n' + frame;
  }

  return { message, line, column };
}
