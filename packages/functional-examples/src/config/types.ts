/**
 * Type definitions for the configuration system
 */

import type {
  BaseMetadata,
  Extractor,
  PathMapping,
  Plugin,
  ScanConfig,
} from '../types/index.js';

// Re-export for backward compatibility
export type { PathMapping, ScanConfig } from '../types/index.js';

/**
 * Reference to an extractor package (for config files)
 */
export interface ExtractorConfig {
  /** Package name */
  name: string;
  /** Module specifier (package name or path) */
  module: string;
  /** Options to pass to the extractor factory */
  options?: Record<string, unknown>;
}

/**
 * Extractor can be specified as string (package name) or full config
 */
export type ExtractorReference = string | ExtractorConfig;

/**
 * An extractor can be a reference (to load) or an instance
 */
export type ExtractorConfigOrFunction<TMetadata = Record<string, unknown>> =
  | ExtractorReference
  | Extractor<TMetadata>;

/**
 * Base configuration without resolved extractors
 */
/**
 * JSON Schema object for metadata validation.
 * Subset of JSON Schema spec used for config files.
 */
export interface JSONSchemaObject {
  type?: string;
  properties?: Record<string, JSONSchemaObject>;
  required?: string[];
  items?: JSONSchemaObject;
  enum?: unknown[];
  const?: unknown;
  description?: string;
  [key: string]: unknown;
}

/**
 * Configuration for the generate command output.
 */
export interface GenerateConfig {
  /** Output directory for generated files (default: .functional-examples) */
  outputDir?: string;
}

export interface BaseConfig<TMetadata = Record<string, unknown>> {
  /** Plugins to use for scanning and parsing (recommended) */
  plugins?: Plugin<TMetadata>[];
  /** @deprecated Use plugins instead. Extractors to use for scanning */
  extractors?: ExtractorConfigOrFunction<TMetadata>[];
  /** Scan options */
  scan?: ScanConfig;
  /** Path mappings for conflict resolution */
  pathMappings?: PathMapping[];

  /**
   * JSON Schema defining the expected metadata structure for examples.
   * This is the user's base metadata contract - all examples must conform to it.
   * Overrides plugin metadata schemas on conflict.
   *
   * @example
   * ```typescript
   * metadata: {
   *   type: 'object',
   *   properties: {
   *     id: { type: 'string' },
   *     title: { type: 'string' },
   *     category: { type: 'string', enum: ['tutorial', 'recipe', 'reference'] },
   *   },
   *   required: ['id', 'title', 'category'],
   * }
   * ```
   */
  metadata?: JSONSchemaObject;

  /** Configuration for schema/type generation */
  generate?: GenerateConfig;
}

/**
 * Full configuration (alias for BaseConfig)
 */
export type Config<TMetadata = Record<string, unknown>> =
  BaseConfig<TMetadata>;


/**
 * @deprecated Use Extractor from ../types/index.js
 */
export interface MetadataExtractorFunction<
  TMetadata extends BaseMetadata = BaseMetadata
> {
  (context: unknown, options?: Record<string, unknown>): Promise<{
    metadata: TMetadata;
    files: unknown[];
  }>;
  name?: string;
  canExtract?: (context: unknown) => boolean | Promise<boolean>;
}
