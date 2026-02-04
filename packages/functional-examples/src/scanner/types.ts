/**
 * Scanner types for orchestrating extractors
 */

import type {
  Example,
  Extractor,
  ExtractorError,
  Plugin,
} from '../types/index.js';

/**
 * Path-to-extractor mapping for conflict resolution
 */
export interface PathMapping {
  /** Glob pattern for paths */
  pattern: string;
  /** Extractor name that wins for matching paths */
  extractor: string;
}

/**
 * Conflict when multiple extractors claim the same file
 */
export interface FileConflict {
  /** The conflicting file path */
  filePath: string;
  /** Extractors that claimed this file */
  claimants: string[];
  /** How the conflict was resolved (if at all) */
  resolution?: 'path-mapping' | 'error';
  /** Winner extractor name (if resolved) */
  winner?: string;
}

/**
 * Options for scanning examples
 */
export interface ScanOptions<TMetadata = Record<string, unknown>> {
  /** Root directory to scan */
  root: string;

  /**
   * Plugins to use for scanning.
   * Plugins are processed in registration order.
   */
  plugins?: Plugin<TMetadata>[];

  /**
   * @deprecated Use plugins instead. Standalone extractors for backward compatibility.
   */
  extractors?: Extractor<TMetadata>[];

  /** Path mappings for conflict resolution */
  pathMappings?: PathMapping[];
  /** Include patterns (applied AFTER extraction) */
  include?: string[];
  /** Exclude patterns (applied AFTER extraction) */
  exclude?: string[];
  /** Abort signal for cancellation */
  signal?: AbortSignal;

  /**
   * Whether to process file contents through parser pipelines.
   * @default true
   */
  processFileContents?: boolean;
}

/**
 * Result of scanning for examples
 */
export interface ScanResult<TMetadata = Record<string, unknown>> {
  /** All discovered examples */
  examples: Example<TMetadata>[];
  /** Errors from all extractors */
  errors: ExtractorError[];
  /** File conflicts (including resolved ones) */
  conflicts: FileConflict[];
  /** Scan statistics */
  stats: {
    /** Total files claimed by extractors */
    filesClaimed: number;
    /** Total examples found */
    examplesFound: number;
    /** Number of conflicts detected */
    conflictsDetected: number;
    /** Number of conflicts resolved */
    conflictsResolved: number;
    /** Duration in milliseconds */
    durationMs: number;
  };
}
