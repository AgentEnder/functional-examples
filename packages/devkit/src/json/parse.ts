import { formatJsonError, type FormattedJsonError } from './errors.js';

/**
 * Error thrown when JSON parsing fails across all available parsers.
 */
export class JsonParseError extends Error {
  readonly line?: number;
  readonly column?: number;
  readonly filePath?: string;

  constructor(formatted: FormattedJsonError, filePath?: string) {
    super(formatted.message);
    this.name = 'JsonParseError';
    this.line = formatted.line;
    this.column = formatted.column;
    this.filePath = filePath;
  }
}

let jsoncParserPromise: Promise<typeof import('jsonc-parser') | null> | null =
  null;
let json5Promise: Promise<typeof import('json5') | null> | null = null;

function tryImportJsoncParser() {
  if (!jsoncParserPromise) {
    jsoncParserPromise = import('jsonc-parser').catch(() => null);
  }
  return jsoncParserPromise;
}

function tryImportJson5() {
  if (!json5Promise) {
    json5Promise = import('json5').catch(() => null);
  }
  return json5Promise;
}

/**
 * Resets the cached import promises. Used for testing only.
 * @internal
 */
export function _resetImportCache(): void {
  jsoncParserPromise = null;
  json5Promise = null;
}

/**
 * Parses a JSON string with progressive fallbacks:
 * 1. Standard JSON.parse
 * 2. jsonc-parser (handles comments and trailing commas)
 * 3. json5 (handles extended JSON5 syntax)
 *
 * If all parsers fail, throws a {@link JsonParseError} with a formatted
 * code frame showing the error location.
 *
 * @param content - The JSON string to parse
 * @param filePath - Optional file path for error messages
 * @returns The parsed value
 */
export async function parseJson<T = unknown>(
  content: string,
  filePath?: string
): Promise<T> {
  // 1. Try standard JSON.parse
  try {
    return JSON.parse(content) as T;
  } catch {
    // Fall through to JSONC
  }

  // Track the best error for final reporting
  let bestError: Error | undefined;

  // 2. Try jsonc-parser
  const jsoncParser = await tryImportJsoncParser();
  if (jsoncParser) {
    const errors: import('jsonc-parser').ParseError[] = [];
    const result = jsoncParser.parse(content, errors, {
      allowTrailingComma: true,
    });
    if (errors.length === 0) {
      return result as T;
    }
    // Store JSONC error info for later
    const firstError = errors[0];
    bestError = new Error(
      `JSONC parse error at offset ${firstError.offset} (length ${firstError.length})`
    );
  }

  // 3. Try json5
  const json5 = await tryImportJson5();
  if (json5) {
    try {
      return json5.parse(content) as T;
    } catch (e) {
      bestError = e instanceof Error ? e : new Error(String(e));
    }
  }

  // 4. Nothing worked - build the best error we can
  if (!bestError) {
    // Re-run JSON.parse to capture the original error
    try {
      JSON.parse(content);
    } catch (e) {
      bestError = e instanceof Error ? e : new Error(String(e));
    }
  }

  const error = bestError ?? new Error('Failed to parse JSON');
  const formatted = formatJsonError({ content, error, filePath });
  throw new JsonParseError(formatted, filePath);
}

/**
 * Wraps {@link parseJson} in a try/catch, returning a discriminated union
 * indicating success or failure.
 *
 * @param content - The JSON string to parse
 * @param filePath - Optional file path for error messages
 * @returns A result object with either `{ success: true, data }` or `{ success: false, error }`
 */
export async function tryParseJson<T = unknown>(
  content: string,
  filePath?: string
): Promise<{ success: true; data: T } | { success: false; error: JsonParseError }> {
  try {
    const data = await parseJson<T>(content, filePath);
    return { success: true, data };
  } catch (e) {
    const error =
      e instanceof JsonParseError
        ? e
        : new JsonParseError(
            {
              message: e instanceof Error ? e.message : String(e),
            },
            filePath
          );
    return { success: false, error };
  }
}
