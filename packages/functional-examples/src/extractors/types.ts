/**
 * Types for metadata extraction system (legacy)
 *
 * Note: The main extractor types are now in ../types/index.ts.
 * These types remain for backward compatibility during transition.
 */

import type { BaseMetadata, ExampleFile } from '../types/index.js';

/**
 * Context provided to extractors for metadata extraction (legacy)
 * @deprecated Use the new Extractor interface from ../types/index.js
 */
export interface ExtractionContext {
  /** Absolute path to file or directory being examined */
  path: string;
  /** Whether this is a directory */
  isDirectory: boolean;
  /** File contents (for single-file examples) */
  content?: string;
  /** Directory entries (for directory-based examples) */
  entries?: string[];
}

/**
 * Result of metadata extraction (legacy)
 * @deprecated Use ExtractorResult from ../types/index.js
 */
export interface ExtractedMetadata<
  TMetadata extends BaseMetadata = BaseMetadata
> {
  /** The extracted metadata */
  metadata: TMetadata;
  /** Files belonging to this example */
  files: ExampleFile[];
  /** Content with metadata removed (for frontmatter extraction) */
  strippedContent?: string;
}
