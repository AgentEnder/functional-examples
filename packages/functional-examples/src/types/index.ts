/**
 * Core type definitions for functional-examples
 */

// ============================================================================
// Validation Types
// ============================================================================

/**
 * A single validation error.
 */
export interface ValidationError {
  /** JSON path to the invalid value (e.g., "metadata.tags[0]") */
  path: string;
  /** Human-readable error message */
  message: string;
}

/**
 * Result of a validation operation.
 */
export interface ValidationResult {
  /** Whether validation passed */
  success: boolean;
  /** Validation errors (empty if success is true) */
  errors: ValidationError[];
}

// ============================================================================
// Metadata Types
// ============================================================================

/**
 * Base metadata that all examples should have.
 * Used for type constraints when users want stricter typing.
 */
export interface BaseMetadata {
  /** Unique identifier for the example */
  id: string;
  /** Human-readable title */
  title: string;
  /** Description of what the example demonstrates */
  description?: string;
}

/**
 * Parsed code region from #region markers.
 */
export interface ParsedRegion {
  /** Region identifier from #region <id> */
  id: string;
  /** Content between region markers (markers stripped) */
  content: string;
  /** Line number where #region marker appears (1-based) */
  startLine: number;
  /** Line number where #endregion marker appears (1-based) */
  endLine: number;
}

/**
 * A file within an example, with optional processed content.
 */
export interface ExampleFile {
  /** Absolute path to the file */
  absolutePath: string;
  /** Path relative to example root */
  relativePath: string;
  /** @deprecated Use absolutePath instead */
  path?: string;
  /** Raw file contents (may be lazy-loaded) */
  raw?: string;
  /** Parsed content with metadata/markers stripped */
  parsed?: string;
  /** Extracted code regions */
  hunks?: ParsedRegion[];
}

/**
 * A discovered example with metadata and files.
 * Metadata is loosely typed by default but can be constrained via user schema.
 */
export interface Example<TMetadata = Record<string, unknown>> {
  /** Unique identifier for this example */
  id: string;
  /** Human-readable title */
  title: string;
  /** Optional description */
  description?: string;
  /** Absolute path to the example root (file or directory) */
  rootPath: string;
  /** All files belonging to this example */
  files: ExampleFile[];
  /** Additional metadata (loosely typed unless user provides schema) */
  metadata: TMetadata;
  /** Which extractor produced this example */
  extractorName: string;
}

/**
 * Error encountered during extraction
 */
export interface ExtractorError {
  /** Path where error occurred */
  path: string;
  /** Error message */
  message: string;
  /** Original error if available */
  cause?: Error;
}

/**
 * Options passed to extractor during scan
 */
export interface ExtractorOptions {
  /** Glob patterns to include */
  include?: string[];
  /** Glob patterns to exclude */
  exclude?: string[];
  /** Signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Result from a tree-scan extractor
 */
export interface ExtractorResult<TMetadata = Record<string, unknown>> {
  /** All examples found by this extractor */
  examples: Example<TMetadata>[];
  /** Errors encountered during extraction */
  errors: ExtractorError[];
  /** Files claimed by this extractor (absolute paths, for conflict detection) */
  claimedFiles: Set<string>;
}

/**
 * Tree-scan extractor interface.
 * Called once with root path, scans tree, returns ALL examples found.
 */
export interface Extractor<TMetadata = Record<string, unknown>> {
  /** Unique name for this extractor */
  readonly name: string;

  /**
   * Scan the directory tree starting at rootPath.
   * Extractor owns traversal and file collection.
   *
   * @param rootPath - Absolute path to start scanning
   * @param options - Extraction options
   * @returns All examples found and files claimed
   */
  extract(
    rootPath: string,
    options?: ExtractorOptions
  ): Promise<ExtractorResult<TMetadata>>;
}

/**
 * Factory function to create an extractor with options
 */
export type ExtractorFactory<
  TOptions = Record<string, unknown>,
  TMetadata = Record<string, unknown>
> = (options?: TOptions) => Extractor<TMetadata>;

/**
 * Context passed through the FileContentsParser pipeline.
 * Each parser receives this, transforms it, and returns an updated version.
 */
export interface FileParseContext {
  /** Original file content, never modified */
  raw: string;
  /** Transformed content (frontmatter/markers stripped) */
  parsed: string;
  /** Extracted code regions (only explicit #region blocks) */
  hunks: ParsedRegion[];
  /** Metadata extracted by parsers */
  metadata: Record<string, unknown>;
  /** Absolute path to the file */
  filePath: string;
}

/**
 * Parser that processes file contents in a pipeline.
 * Receives accumulated context, transforms it, returns updated context.
 */
export interface FileContentsParser {
  /** Unique parser name for debugging/logging */
  readonly name: string;

  /**
   * Process file content and return updated context.
   * @param context - Current accumulated parse context
   * @returns Updated context (should not mutate input)
   */
  parse(
    context: FileParseContext
  ): FileParseContext | Promise<FileParseContext>;
}

// ============================================================================
// Plugin Schema and Validation Types
// ============================================================================

/**
 * Schema definitions for a plugin (JSON Schema format).
 * Used for IDE autocomplete and documentation generation.
 */
export interface PluginSchemas {
  /**
   * JSON Schema for plugin options (passed to createPlugin()).
   * Used to generate config file schema for IDE autocomplete.
   */
  options?: string;

  /**
   * JSON Schema for metadata this plugin produces or expects.
   * Used for metadata.d.ts generation and documentation.
   */
  metadata?: string;
}

/**
 * Validator functions for a plugin.
 * Allows plugins to use any validation library (Zod, TypeBox, etc.)
 */
export interface PluginValidators<TMetadata = Record<string, unknown>> {
  /**
   * Validates plugin options before extraction begins.
   * Called during config resolution.
   * @param options - The options passed to the plugin factory
   */
  options?: (options: unknown) => ValidationResult;

  /**
   * Validates extracted metadata after all extractors complete.
   * Called for each example's metadata.
   * @param metadata - The metadata from an extracted example
   */
  metadata?: (metadata: TMetadata) => ValidationResult;
}

// ============================================================================
// Plugin Interface
// ============================================================================

/**
 * Plugin containing optional extractors, parsers, schemas, and validators.
 * Auto-registers for declared file extensions.
 */
export interface Plugin<TMetadata = Record<string, unknown>> {
  /** Unique plugin name */
  readonly name: string;

  /** File extensions this plugin handles (e.g., ['.ts', '.tsx', '.js', '.jsx']) */
  readonly extensions?: string[];

  /** Extractor that finds examples in a directory tree */
  readonly extractor?: Extractor<TMetadata>;

  /** Parser that processes file contents (runs in pipeline order) */
  readonly fileContentsParser?: FileContentsParser;

  /**
   * JSON Schema definitions for IDE tooling.
   * @see PluginSchemas
   */
  readonly schemas?: PluginSchemas;

  /**
   * Runtime validators for options and metadata.
   * @see PluginValidators
   */
  readonly validators?: PluginValidators<TMetadata>;
}
