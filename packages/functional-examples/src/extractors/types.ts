/**
 * Types for the metadata extraction system
 */

import type { BaseMetadata, ExampleFile } from '../types/index.js';

/**
 * Context provided to extractors for metadata extraction
 */
export interface ExtractionContext {
  /** Absolute path to the file or directory being examined */
  path: string;
  /** Whether this is a directory */
  isDirectory: boolean;
  /** File contents (for single-file examples) */
  content?: string;
  /** Directory entries (for directory-based examples) */
  entries?: string[];
}

/**
 * Result of metadata extraction
 */
export interface ExtractedMetadata<TMetadata extends BaseMetadata = BaseMetadata> {
  /** The extracted metadata */
  metadata: TMetadata;
  /** Files belonging to this example */
  files: ExampleFile[];
  /** Content with metadata removed (for frontmatter extraction) */
  strippedContent?: string;
}

/**
 * Interface for metadata extractors.
 * Implement this to support custom metadata formats.
 */
export interface MetadataExtractor {
  /** Unique name for this extractor */
  readonly name: string;

  /**
   * Check if this extractor can handle the given context.
   * Called before extract() to determine which extractor to use.
   */
  canExtract(context: ExtractionContext): boolean;

  /**
   * Extract metadata from the given context.
   * Only called if canExtract() returned true.
   */
  extract(context: ExtractionContext): Promise<ExtractedMetadata>;
}
