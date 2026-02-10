let tinyglobbyPromise: Promise<typeof import('tinyglobby')> | null = null;

function importTinyglobby() {
  if (!tinyglobbyPromise) {
    tinyglobbyPromise = import('tinyglobby').catch(() => {
      tinyglobbyPromise = null;
      throw new Error(
        'tinyglobby is required to use @functional-examples/devkit/glob. ' +
          'Install it with: pnpm add tinyglobby'
      );
    });
  }
  return tinyglobbyPromise;
}

/**
 * Resets the cached import promise. Used for testing only.
 * @internal
 */
export function _resetGlobImportCache(): void {
  tinyglobbyPromise = null;
}

/**
 * Options for the glob function.
 */
export interface GlobOptions {
  /** Working directory for pattern resolution */
  cwd?: string;
  /** Patterns to exclude from results */
  ignore?: string[];
  /** Return absolute paths instead of relative */
  absolute?: boolean;
  /** Only return files (not directories) */
  onlyFiles?: boolean;
  /** Expand directory matches to their contents */
  expandDirectories?: boolean;
}

/**
 * Find files matching glob patterns.
 *
 * Thin wrapper around tinyglobby that normalizes input
 * and provides a consistent interface across the monorepo.
 *
 * Requires the `tinyglobby` peer dependency to be installed.
 *
 * @param patterns - One or more glob patterns
 * @param options - Glob options
 * @returns Array of matching file paths
 */
export async function glob(
  patterns: string | string[],
  options?: GlobOptions
): Promise<string[]> {
  const { glob: tinyGlob } = await importTinyglobby();
  const patternArray = Array.isArray(patterns) ? patterns : [patterns];
  return tinyGlob(patternArray, options);
}
