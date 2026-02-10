/**
 * Convenience function for scanning examples with minimal boilerplate.
 *
 * Wraps the full config discovery pipeline:
 * `findConfigFile` → `loadConfig` → `resolveConfig` → `scanExamples`
 */

import type { ResolvedConfig } from '../types/index.js';
import { findConfigFile, loadConfig } from '../config/loader.js';
import { resolveConfig } from '../config/resolver.js';
import { scanExamples } from './scanner.js';
import type { ScanResult } from './types.js';

/**
 * Options for the convenience `scan()` function.
 */
export interface ScanOptions {
  /** Working directory to search for config. Defaults to process.cwd() */
  root?: string;
  /** Pre-built config — skips file discovery + loading */
  config?: ResolvedConfig;
}

/**
 * Scan for examples using automatic config discovery.
 *
 * This is the simplest entry point for programmatic scanning.
 * It discovers the nearest config file, loads it, resolves plugins,
 * and runs the scanner — all in one call.
 *
 * @example
 * ```typescript
 * import { scan } from 'functional-examples';
 *
 * // Auto-discover config from cwd
 * const result = await scan();
 *
 * // Discover config from a specific directory
 * const result = await scan({ root: '/path/to/project' });
 *
 * // Skip discovery and use a pre-resolved config
 * const result = await scan({ config: myResolvedConfig });
 * ```
 */
export async function scan(options?: ScanOptions): Promise<ScanResult> {
  if (options?.config) {
    return scanExamples(options.config);
  }

  const root = options?.root ?? process.cwd();
  const configPath = await findConfigFile(root);

  if (!configPath) {
    throw new Error(
      `No functional-examples config found starting from ${root}`
    );
  }

  const rawConfig = await loadConfig(configPath);
  const resolved = await resolveConfig(rawConfig);
  return scanExamples(resolved);
}
