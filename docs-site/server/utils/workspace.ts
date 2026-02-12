import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Walk up from the current file's directory until we find `nx.json`,
 * which marks the workspace root of this Nx monorepo.
 */
export function workspaceRoot(): string {
  let dir = import.meta.dirname;
  while (dir !== '.' && dir) {
    if (existsSync(join(dir, 'nx.json'))) {
      return dir;
    }
    dir = dirname(dir);
  }
  throw new Error(
    'Unable to locate workspace root from ' + import.meta.dirname
  );
}
