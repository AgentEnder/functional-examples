/**
 * Deep merge for configuration sources
 */

import type { PathMapping } from '../scanner/types.js';
import type { Config, ExtractorConfigOrFunction, ScanConfig } from './types.js';

/**
 * Merged configuration with all required fields
 */
export interface MergedConfig<TMetadata = Record<string, unknown>> {
  extractors: ExtractorConfigOrFunction<TMetadata>[];
  scan: Required<ScanConfig>;
  pathMappings: PathMapping[];
}

/**
 * Merge multiple configuration sources with later configs taking precedence.
 *
 * @example
 * ```typescript
 * const config = mergeConfigs(
 *   defaultConfig,
 *   projectConfig,
 *   cliOverrides
 * );
 * ```
 */
export function mergeConfigs<TMetadata = Record<string, unknown>>(
  ...configs: Array<Partial<Config<TMetadata>> | null | undefined>
): MergedConfig<TMetadata> {
  const defaults: Required<ScanConfig> = {
    include: ['**/*'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    root: '.',
  };

  const mergedExtractors: ExtractorConfigOrFunction<TMetadata>[] = [];
  const mergedPathMappings: PathMapping[] = [];
  const mergedScan: Partial<ScanConfig> = {};

  for (const config of configs) {
    if (!config) continue;

    if (config.pathMappings) {
      mergedPathMappings.push(...config.pathMappings);
    }

    if (config.scan) {
      Object.assign(mergedScan, config.scan);
    }
  }

  return {
    extractors: mergedExtractors,
    scan: { ...defaults, ...mergedScan },
    pathMappings: mergedPathMappings,
  };
}
