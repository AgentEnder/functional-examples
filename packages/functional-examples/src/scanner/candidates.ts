/**
 * Candidate resolution for the scanner.
 * Evaluates include/exclude patterns and returns Dirent candidates.
 */

import type { Dirent, Stats } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import * as path from 'node:path';
import { glob } from 'tinyglobby';

/**
 * A list of polyglot vendor dirs and other
 * directories that probably just make sense to
 * never crawl
 */
const ALWAYS_IGNORE = ['node_modules', '.git'];

/**
 * Create a Dirent-like object from a Stats object.
 * This allows us to stat individual files instead of reading entire directories.
 */
function createDirentFromStats(
  name: string,
  parentPath: string,
  stats: Stats
): Dirent {
  return {
    name,
    path: path.join(parentPath, name),
    parentPath,
    isFile: () => stats.isFile(),
    isDirectory: () => stats.isDirectory(),
    isBlockDevice: () => stats.isBlockDevice(),
    isCharacterDevice: () => stats.isCharacterDevice(),
    isFIFO: () => stats.isFIFO(),
    isSocket: () => stats.isSocket(),
    isSymbolicLink: () => stats.isSymbolicLink(),
  } as Dirent;
}

/**
 * Resolve candidates by evaluating include patterns against the root.
 * Returns Dirent entries for files and directories that match.
 *
 * @param root - Absolute path to the config root
 * @param include - Glob patterns to include
 * @param exclude - Glob patterns to exclude
 * @returns Array of Dirent entries
 */
export async function resolveCandidates(
  root: string,
  include: string[],
  exclude: string[]
): Promise<Dirent[]> {
  // Use tinyglobby to match patterns
  const matches = await glob(include, {
    cwd: root,
    ignore: exclude.concat(ALWAYS_IGNORE),
    onlyFiles: false,
    expandDirectories: false,
    absolute: false,
  });

  // Stat each match to get Dirent-like info
  const candidates: Dirent[] = [];

  await Promise.all(
    matches.map(async (match) => {
      const fullPath = path.join(root, match);
      const name = path.basename(match);
      const parentPath = path.dirname(fullPath);
      const relativeToScanRoot = path.relative(root, parentPath);

      try {
        const stats = await stat(fullPath);
        candidates.push(createDirentFromStats(name, relativeToScanRoot, stats));
      } catch {
        // File doesn't exist or can't be stat'd, skip
      }
    })
  );

  return candidates;
}

/**
 * Determine the default include pattern based on directory structure.
 * Returns ['examples/*'] if an examples directory exists, otherwise ['*'].
 *
 * @param root - Absolute path to the config root
 * @returns Default include pattern array
 */
export async function getDefaultIncludePattern(
  root: string
): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const hasExamplesDir = entries.some(
      (entry) => entry.isDirectory() && entry.name === 'examples'
    );
    return hasExamplesDir ? ['examples/*'] : ['*'];
  } catch {
    return ['*'];
  }
}
