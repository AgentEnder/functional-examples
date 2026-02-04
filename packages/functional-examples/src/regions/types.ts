/**
 * Types for region extraction
 */

/**
 * Information about a parsed region
 */
export interface RegionInfo {
  /** 1-based line number where the region starts */
  startLine: number;
  /** 1-based line number where the region ends */
  endLine: number;
  /** Content within the region (markers excluded) */
  content: string;
}

/**
 * Map of region IDs to their information
 */
export type RegionMap = Record<string, RegionInfo>;

/**
 * Options for region parsing
 */
export interface RegionOptions {
  /** File extension to determine comment syntax (e.g., 'ts', 'py') */
  extension?: string;
  /** Language name override (e.g., 'typescript', 'python') */
  language?: string;
}

/**
 * Configuration for a programming language's comment syntax
 */
export interface LanguageConfig {
  /** Line comment prefix (e.g., '//' for JS, '#' for Python) */
  lineComment?: string;
  /** Block comment delimiters [start, end] */
  blockComment?: [string, string];
}
