/**
 * Scanner types for orchestrating extractors
 */

import type {
  ExtractorError,
  ScannedExample,
} from '../types/index.js';

// Re-export for backward compatibility
export type { PathMapping } from '../types/index.js';

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
 * Result of scanning for examples
 */
export interface ScanResult<TMetadata = Record<string, unknown>> {
  /** All discovered examples (with computed fields like displayPath) */
  examples: ScannedExample<TMetadata>[];
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
