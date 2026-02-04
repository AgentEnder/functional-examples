/**
 * Configuration resolver - converts config references to actual extractors
 */

import type { Extractor } from '../types/index.js';
import type {
  Config,
  ExtractorConfig,
  ExtractorConfigOrFunction,
  ScanConfig,
} from './types.js';
import type { PathMapping } from '../scanner/types.js';

/**
 * Resolved configuration with actual extractor instances
 */
export interface ResolvedConfig<TMetadata = Record<string, unknown>> {
  /** Resolved extractor instances */
  extractors: Extractor<TMetadata>[];
  /** Path mappings for conflict resolution */
  pathMappings: PathMapping[];
  /** Scan configuration with defaults applied */
  scan: Required<ScanConfig>;
}

/**
 * Known extractor packages that can be auto-detected
 */
const KNOWN_EXTRACTORS = [
  '@functional-examples/extractor-frontmatter',
  '@functional-examples/yaml-manifest',
] as const;

/**
 * Default scan configuration
 */
const DEFAULT_SCAN: Required<ScanConfig> = {
  include: ['**/*'],
  exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
};

/**
 * Resolve a configuration to actual extractor instances.
 *
 * If no extractors are specified, attempts to auto-detect installed extractors.
 *
 * @example
 * ```typescript
 * import { resolveConfig } from 'functional-examples';
 *
 * // Auto-detect extractors
 * const config = await resolveConfig({});
 *
 * // Use with scanExamples
 * const result = await scanExamples({
 *   root: './examples',
 *   extractors: config.extractors,
 *   pathMappings: config.pathMappings,
 * });
 * ```
 */
export async function resolveConfig<TMetadata = Record<string, unknown>>(
  config: Config<TMetadata>
): Promise<ResolvedConfig<TMetadata>> {
  let extractors: Extractor<TMetadata>[];

  if (!config.extractors || config.extractors.length === 0) {
    // Auto-detect installed extractors
    extractors = await autoDetectExtractors<TMetadata>();
  } else {
    // Resolve configured extractors
    extractors = await resolveExtractors<TMetadata>(config.extractors);
  }

  return {
    extractors,
    pathMappings: config.pathMappings ?? [],
    scan: {
      ...DEFAULT_SCAN,
      ...config.scan,
    },
  };
}

/**
 * Auto-detect installed extractor packages
 */
async function autoDetectExtractors<
  TMetadata = Record<string, unknown>
>(): Promise<Extractor<TMetadata>[]> {
  const extractors: Extractor<TMetadata>[] = [];

  for (const packageName of KNOWN_EXTRACTORS) {
    try {
      const extractor = await loadExtractorFromPackage<TMetadata>(packageName);
      if (extractor) {
        extractors.push(extractor);
      }
    } catch {
      // Package not installed, skip silently
    }
  }

  return extractors;
}

/**
 * Resolve an array of extractor references to actual instances
 */
async function resolveExtractors<TMetadata = Record<string, unknown>>(
  refs: ExtractorConfigOrFunction<TMetadata>[]
): Promise<Extractor<TMetadata>[]> {
  const extractors: Extractor<TMetadata>[] = [];

  for (const ref of refs) {
    const extractor = await resolveExtractor<TMetadata>(ref);
    if (extractor) {
      extractors.push(extractor);
    }
  }

  return extractors;
}

/**
 * Resolve a single extractor reference
 */
async function resolveExtractor<TMetadata = Record<string, unknown>>(
  ref: ExtractorConfigOrFunction<TMetadata>
): Promise<Extractor<TMetadata> | null> {
  // Already an extractor instance
  if (isExtractorInstance<TMetadata>(ref)) {
    return ref;
  }

  // String reference (package name)
  if (typeof ref === 'string') {
    return loadExtractorFromPackage<TMetadata>(ref);
  }

  // Full config object
  return loadExtractorFromConfig<TMetadata>(ref);
}

/**
 * Load extractor from package name
 */
async function loadExtractorFromPackage<TMetadata = Record<string, unknown>>(
  packageName: string,
  options?: Record<string, unknown>
): Promise<Extractor<TMetadata> | null> {
  try {
    const module = await import(packageName);

    // Try common export patterns
    const factory =
      module.createFrontmatterExtractor ??
      module.createYamlManifestExtractor ??
      module.createMetaYmlExtractor ??
      module.createExtractor ??
      module.default?.createExtractor ??
      module.default;

    if (typeof factory === 'function') {
      return factory(options) as Extractor<TMetadata>;
    }

    // Module might export extractor directly
    if (isExtractorInstance(module.default)) {
      return module.default as Extractor<TMetadata>;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Load extractor from config object
 */
async function loadExtractorFromConfig<TMetadata = Record<string, unknown>>(
  config: ExtractorConfig
): Promise<Extractor<TMetadata> | null> {
  return loadExtractorFromPackage<TMetadata>(config.module, config.options);
}

/**
 * Check if value is an extractor instance
 */
function isExtractorInstance<TMetadata>(
  value: unknown
): value is Extractor<TMetadata> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'extract' in value &&
    typeof (value as Extractor).name === 'string' &&
    typeof (value as Extractor).extract === 'function'
  );
}
