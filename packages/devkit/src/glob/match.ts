import type picomatchType from 'picomatch';

let picomatchPromise: Promise<typeof picomatchType> | null = null;

function importPicomatch(): Promise<typeof picomatchType> {
  if (!picomatchPromise) {
    picomatchPromise = import('picomatch')
      .then((mod) => (mod.default ?? mod) as typeof picomatchType)
      .catch(() => {
        picomatchPromise = null;
        throw new Error(
          'picomatch is required to use @functional-examples/devkit/glob. ' +
            'Install it with: pnpm add picomatch'
        );
      });
  }
  return picomatchPromise;
}

/**
 * Resets the cached import promise. Used for testing only.
 * @internal
 */
export function _resetMatchImportCache(): void {
  picomatchPromise = null;
}

/**
 * Test whether a path matches one or more glob patterns.
 *
 * Requires the `picomatch` peer dependency to be installed.
 *
 * @param path - The path to test
 * @param pattern - One or more glob patterns
 * @returns True if the path matches any of the patterns
 */
export async function isMatch(
  path: string,
  pattern: string | string[]
): Promise<boolean> {
  const picomatch = await importPicomatch();
  return picomatch.isMatch(path, pattern);
}

/**
 * Create a reusable matcher function from one or more glob patterns.
 *
 * Prefer this over repeated {@link isMatch} calls when matching
 * many paths against the same pattern—the compiled matcher is
 * significantly faster for repeated use.
 *
 * Requires the `picomatch` peer dependency to be installed.
 *
 * @param pattern - One or more glob patterns
 * @returns A function that tests a path against the compiled patterns
 */
export async function createMatcher(
  pattern: string | string[]
): Promise<(path: string) => boolean> {
  const picomatch = await importPicomatch();
  return picomatch(pattern);
}
