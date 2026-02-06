/**
 * Core type definitions for functional-examples
 */

import type { CLI } from 'cli-forge';
import type { Dirent } from 'node:fs';
import { ConfigWithRoot } from '../config/types.js';

// Re-export utility classes
export { DefaultMap } from './default-map.js';
export {
  asSettled,
  AsyncExtendedIterable,
  asyncIter,
  ExtendedIterable,
  iter,
} from './extended-iterable.js';

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
 * Augmentable registry for example metadata typing.
 *
 * Run `functional-examples generate` to create a declaration file that
 * augments this interface, providing type-safe metadata for your examples.
 *
 * @example Manual augmentation (or use `generate` command):
 * ```typescript
 * declare module 'functional-examples' {
 *   interface ExampleMetadataRegistry {
 *     metadata: {
 *       id: string;
 *       title: string;
 *       tags?: string[];
 *     };
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ExampleMetadataRegistry {}

/**
 * Resolved example metadata type.
 *
 * If `ExampleMetadataRegistry` has been augmented with a `metadata` property,
 * this resolves to that type. Otherwise, falls back to `Record<string, unknown>`.
 *
 * This allows the `generate` command to provide project-specific types that
 * automatically apply to all `Example` types without explicit generic parameters.
 */
export type ExampleMetadata = ExampleMetadataRegistry extends {
  metadata: infer T;
}
  ? T
  : Record<string, unknown>;

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
 * This is the base type returned by extractors.
 *
 * Metadata is typed via `ExampleMetadata` by default, which can be augmented
 * by running `functional-examples generate`. You can also pass an explicit
 * generic parameter for custom typing.
 */
export interface Example<TMetadata = ExampleMetadata> {
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
 * An example after processing by the scanner.
 * Includes computed fields like displayPath that are added during scanning.
 */
export interface ScannedExample<TMetadata = ExampleMetadata>
  extends Example<TMetadata> {
  /**
   * Path relative to the config/scan root, useful for display in errors
   * and snapshots (avoids machine-specific absolute paths).
   */
  displayPath: string;
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
 * Options passed to extractor during extraction
 */
export interface ExtractorOptions {
  /** Absolute path to the config root (for context/relative paths) */
  rootPath: string;
  /** Glob patterns to exclude (for internal filtering within directories) */
  exclude?: string[];
  /** Signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Result from a candidate-based extractor
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
 * Candidate-based extractor interface.
 * Called with pre-filtered candidates (files and/or directories).
 * Extractor decides which candidates it can handle.
 */
export interface Extractor<TMetadata = Record<string, unknown>> {
  /** Unique name for this extractor */
  readonly name: string;

  /**
   * Extract examples from the provided candidates.
   * Candidates are pre-filtered by include/exclude patterns.
   *
   * @param candidates - Dirent entries (files and/or directories) to consider
   * @param options - Extraction options including rootPath for context
   * @returns All examples found and files claimed
   */
  extract(
    candidates: Dirent[],
    options: ExtractorOptions
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
// Configuration Types (defined here to avoid circular dependencies)
// ============================================================================

/**
 * Scan configuration options.
 */
export interface ScanConfig {
  /** Include patterns (applied after extraction) */
  include?: string[];
  /** Exclude patterns (applied after extraction) */
  exclude?: string[];
}

/**
 * Path-to-extractor mapping for conflict resolution.
 */
export interface PathMapping {
  /** Glob pattern for paths */
  pattern: string;
  /** Extractor name that wins for matching paths */
  extractor: string;
}

/**
 * Error from config validation.
 */
export interface ConfigValidationError {
  /** JSON path to the invalid value */
  path: string;
  /** Human-readable error message */
  message: string;
  /** Location code (e.g., Zod issue code) */
  location?: string;
  /** Suggested fix for the error */
  fix?: string;
}

/**
 * Wrapper for a plugin's validator function with plugin name context.
 */
export interface PluginValidatorEntry<T = unknown> {
  pluginName: string;
  validate: (value: T) => ValidationResult;
}

/**
 * Schema entry from a plugin with plugin name context.
 */
export interface PluginSchemaEntry {
  pluginName: string;
  options?: string;
  metadata?: string;
}

/**
 * Plugin registry interface for accessing validators/schemas.
 * Full implementation is in plugins/registry.ts.
 */
export interface PluginRegistryInterface {
  /** Register a plugin */
  register(plugin: Plugin): void;
  /** Get all registered plugins */
  getPlugins(): readonly Plugin[];
  /** Get plugins for a file extension */
  getPluginsForExtension(extension: string): Plugin[];
  /** Get all extractors from plugins */
  getExtractors(): Extractor[];
  /** Get parsers for a file extension */
  getParsersForExtension(extension: string): FileContentsParser[];
  /** Get all options validators */
  getOptionsValidators(): PluginValidatorEntry<unknown>[];
  /** Get all metadata validators */
  getMetadataValidators(): PluginValidatorEntry[];
  /** Get all schemas from plugins */
  getSchemas(): PluginSchemaEntry[];
}

/**
 * Resolved configuration with actual extractor instances.
 * This is the runtime-ready configuration after all plugins are loaded.
 */
export interface ResolvedConfig<TMetadata = Record<string, unknown>>
  extends ConfigWithRoot<TMetadata> {
  /** Resolved extractor instances */
  extractors: Extractor<TMetadata>[];
  /** Resolved plugins */
  plugins: Plugin<TMetadata>[];
  /** Plugin registry for accessing validators/schemas */
  registry: PluginRegistryInterface;
  /** Path mappings for conflict resolution */
  pathMappings: PathMapping[];
  /** Scan configuration with defaults applied */
  scan: Required<ScanConfig>;
  /** Config validation errors (options validation failures) */
  validationErrors: ConfigValidationError[];
  /** Root Path of Config File */
  root: string;
}

// ============================================================================
// Plugin Commands Types
// ============================================================================

/**
 * Plugin commands can be a static array or a function that receives
 * the resolved config and returns commands (sync or async).
 */
export type PluginCommands<TMetadata = Record<string, unknown>> =
  | CLI[]
  | ((config: ResolvedConfig<TMetadata>) => CLI[] | Promise<CLI[]>);

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

  /**
   * CLI commands provided by this plugin.
   * Can be static commands or a function that receives the resolved config.
   * @see PluginCommands
   */
  readonly commands?: PluginCommands<TMetadata>;

  /**
   * Options passed to the plugin factory (for validation introspection).
   * Plugin factories should set this to enable options validation.
   * @internal
   */
  readonly _options?: unknown;
}
