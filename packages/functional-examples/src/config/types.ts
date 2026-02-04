/**
 * Type definitions for the configuration system
 */

import type { BaseMetadata, Extractor, Plugin } from '../types/index.js';
import type { PathMapping } from '../scanner/types.js';

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
 * Scan configuration
 */
export interface ScanConfig {
  /** Include patterns (applied after extraction) */
  include?: string[];
  /** Exclude patterns (applied after extraction) */
  exclude?: string[];
}

/**
 * An extractor can be a reference (to load) or an instance
 */
export type ExtractorConfigOrFunction<TMetadata = Record<string, unknown>> =
  | ExtractorReference
  | Extractor<TMetadata>;

/**
 * Base configuration without resolved extractors
 */
export interface BaseConfig<TMetadata = Record<string, unknown>> {
  /** Plugins to use for scanning and parsing (recommended) */
  plugins?: Plugin<TMetadata>[];
  /** @deprecated Use plugins instead. Extractors to use for scanning */
  extractors?: ExtractorConfigOrFunction<TMetadata>[];
  /** Scan options */
  scan?: ScanConfig;
  /** Path mappings for conflict resolution */
  pathMappings?: PathMapping[];
}

/**
 * Full configuration
 */
export interface Config<TMetadata = Record<string, unknown>>
  extends BaseConfig<TMetadata> {
  /** Optional metadata schema for validation (Zod schema) */
  metadataSchema?: unknown;
}

// Legacy exports for backward compatibility
export type { PathMapping } from '../scanner/types.js';

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
