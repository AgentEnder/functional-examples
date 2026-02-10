let yamlPromise: Promise<typeof import('yaml')> | null = null;

function importYaml() {
  if (!yamlPromise) {
    yamlPromise = import('yaml').catch(() => {
      yamlPromise = null;
      throw new Error(
        'yaml is required to use @functional-examples/devkit/yaml. ' +
          'Install it with: pnpm add yaml'
      );
    });
  }
  return yamlPromise;
}

/**
 * Resets the cached import promise. Used for testing only.
 * @internal
 */
export function _resetYamlImportCache(): void {
  yamlPromise = null;
}

/**
 * Error thrown when YAML parsing fails.
 * Includes optional position information for diagnostics.
 */
export class YamlParseError extends Error {
  readonly line?: number;
  readonly column?: number;
  readonly filePath?: string;

  constructor(
    message: string,
    options?: { line?: number; column?: number; filePath?: string }
  ) {
    super(message);
    this.name = 'YamlParseError';
    this.line = options?.line;
    this.column = options?.column;
    this.filePath = options?.filePath;
  }
}

/**
 * Parse a YAML string into a typed value.
 *
 * Requires the `yaml` peer dependency to be installed.
 *
 * @param content - The YAML string to parse
 * @param filePath - Optional file path for error messages
 * @returns The parsed value
 * @throws {YamlParseError} If parsing fails
 */
export async function parseYaml<T = unknown>(
  content: string,
  filePath?: string
): Promise<T> {
  const { parse } = await importYaml();
  try {
    return parse(content) as T;
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    const posMatch = err.message.match(/at line (\d+), column (\d+)/);
    throw new YamlParseError(err.message, {
      line: posMatch ? Number(posMatch[1]) : undefined,
      column: posMatch ? Number(posMatch[2]) : undefined,
      filePath,
    });
  }
}

/**
 * Try to parse a YAML string, returning a discriminated union result
 * instead of throwing.
 *
 * Requires the `yaml` peer dependency to be installed.
 *
 * @param content - The YAML string to parse
 * @param filePath - Optional file path for error messages
 * @returns A result with either `{ success: true, data }` or `{ success: false, error }`
 */
export async function tryParseYaml<T = unknown>(
  content: string,
  filePath?: string
): Promise<
  { success: true; data: T } | { success: false; error: YamlParseError }
> {
  try {
    const data = await parseYaml<T>(content, filePath);
    return { success: true, data };
  } catch (e) {
    const error =
      e instanceof YamlParseError
        ? e
        : new YamlParseError(e instanceof Error ? e.message : String(e), {
            filePath,
          });
    return { success: false, error };
  }
}
