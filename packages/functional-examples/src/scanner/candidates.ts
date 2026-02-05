/**
 * Candidate resolution for the scanner.
 * Evaluates include/exclude patterns and returns Dirent candidates.
 */

import { readdir } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { glob } from 'tinyglobby';
import * as path from 'node:path';

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
    ignore: exclude,
    onlyFiles: false,
    expandDirectories: false,
    absolute: false,
  });

  // For each match, we need to get the Dirent
  // Group by parent directory to batch readdir calls
  const parentDirs = new Map<string, Set<string>>();

  for (const match of matches) {
    const parentDir = path.dirname(match);
    const name = path.basename(match);
    const parent = parentDir === '.' ? root : path.join(root, parentDir);

    const existing = parentDirs.get(parent);
    if (existing) {
      existing.add(name);
    } else {
      parentDirs.set(parent, new Set([name]));
    }
  }

  // Read each parent directory and filter to matched names
  const candidates: Dirent[] = [];

  for (const [parentPath, names] of parentDirs) {
    try {
      const entries = await readdir(parentPath, { withFileTypes: true });
      for (const entry of entries) {
        if (names.has(entry.name)) {
          candidates.push(entry);
        }
      }
    } catch {
      // Directory doesn't exist or can't be read, skip
    }
  }

  return candidates;
}

/**
 * Determine the default include pattern based on directory structure.
 * Returns ['examples/*'] if an examples directory exists, otherwise ['*'].
 *
 * @param root - Absolute path to the config root
 * @returns Default include pattern array
 */
export async function getDefaultIncludePattern(root: string): Promise<string[]> {
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
